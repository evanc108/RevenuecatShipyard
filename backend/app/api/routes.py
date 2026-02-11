"""API routes for recipe extraction.

Exposes the extraction endpoint that accepts video URLs and
returns extracted recipe data directly.
"""

import asyncio
import json
import logging
import secrets
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, HttpUrl

from app.config import get_settings
from app.schemas import Recipe
from app.services.extraction_pipeline import ExtractionPipeline
from app.services.recipe_populator import RecipePopulator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["extraction"])

# API key security
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(
    header_key: str | None = Security(_api_key_header),
    query_key: str | None = Query(None, alias="key", include_in_schema=False),
) -> str:
    """Verify the API key from header or query param.

    Checks X-API-Key header first, falls back to ?key= query param.
    Query param fallback is needed for SSE/EventSource which can't set headers.
    """
    settings = get_settings()
    if not settings.api_key:
        # No key configured — allow all (dev mode)
        return ""
    provided_key = header_key or query_key
    if not provided_key or not secrets.compare_digest(provided_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key",
        )
    return provided_key


class ExtractRequest(BaseModel):
    """Request payload for recipe extraction."""

    url: HttpUrl


class ExtractResponse(BaseModel):
    """Response containing extracted recipe or error."""

    success: bool
    recipe: Recipe | None = None
    error: str | None = None
    method_used: str | None = None


class SSEProgressEvent(BaseModel):
    """Progress event for SSE stream."""

    type: str = "progress"
    message: str
    percent: float
    tier: str | None = None


class SSECompleteEvent(BaseModel):
    """Completion event for SSE stream."""

    type: str = "complete"
    recipe: Recipe


class SSEErrorEvent(BaseModel):
    """Error event for SSE stream."""

    type: str = "error"
    message: str


def format_sse(event_type: str, data: str) -> str:
    """Format data as Server-Sent Event."""
    return f"event: {event_type}\ndata: {data}\n\n"


async def extraction_event_generator(url: str) -> AsyncGenerator[str, None]:
    """Generate SSE events for recipe extraction progress.

    Yields progress updates as the extraction proceeds,
    then yields the final recipe or error.
    """
    # Queue to collect progress updates
    progress_queue: asyncio.Queue[tuple[str, float]] = asyncio.Queue()
    current_tier: str | None = None

    async def progress_callback(message: str, percent: float) -> None:
        """Callback to receive progress updates from extractors."""
        await progress_queue.put((message, percent))

    # Start extraction in background task
    pipeline = ExtractionPipeline(progress_callback=progress_callback)
    extraction_task = asyncio.create_task(pipeline.execute(url))

    # Yield progress events until extraction completes
    while not extraction_task.done():
        try:
            # Wait for progress update with timeout
            message, percent = await asyncio.wait_for(
                progress_queue.get(),
                timeout=0.5,
            )

            # Determine current tier from message
            if "metadata" in message.lower():
                current_tier = "metadata"
            elif "audio" in message.lower() or "whisper" in message.lower():
                current_tier = "audio"
            elif "vision" in message.lower() or "frame" in message.lower():
                current_tier = "vision"
            elif "webpage" in message.lower() or "website" in message.lower():
                current_tier = "website"

            event = SSEProgressEvent(
                message=message,
                percent=percent,
                tier=current_tier,
            )
            yield format_sse("progress", event.model_dump_json())

        except asyncio.TimeoutError:
            # No progress update, continue waiting
            continue

    # Drain any remaining progress events in the queue
    while not progress_queue.empty():
        try:
            message, percent = progress_queue.get_nowait()
            event = SSEProgressEvent(
                message=message,
                percent=percent,
                tier=current_tier,
            )
            yield format_sse("progress", event.model_dump_json())
        except asyncio.QueueEmpty:
            break

    # Get the result
    try:
        recipe = await extraction_task

        if recipe:
            event = SSECompleteEvent(recipe=recipe)
            yield format_sse("complete", event.model_dump_json())
        else:
            event = SSEErrorEvent(message="Could not extract recipe from this URL")
            yield format_sse("error", event.model_dump_json())

    except Exception as e:
        logger.exception(f"Extraction failed for {url}")
        event = SSEErrorEvent(message=str(e))
        yield format_sse("error", event.model_dump_json())

    # Small delay to ensure the final event is flushed to the client
    await asyncio.sleep(0.1)


@router.get(
    "/extract/stream",
    summary="Extract recipe with streaming progress",
    description="Extracts recipe data with real-time progress updates via SSE.",
)
async def extract_recipe_stream(
    url: str = Query(..., description="URL to extract recipe from"),
    _key: str = Depends(verify_api_key),
) -> StreamingResponse:
    """Extract recipe with streaming progress updates.

    Returns a Server-Sent Events stream with:
    - `progress` events containing message, percent (0-1), and tier
    - `complete` event with the extracted recipe
    - `error` event if extraction fails

    Example client usage:
    ```javascript
    const eventSource = new EventSource('/api/v1/extract/stream?url=...');
    eventSource.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        console.log(`${data.message} (${data.percent * 100}%)`);
    });
    eventSource.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data);
        console.log('Recipe:', data.recipe);
        eventSource.close();
    });
    eventSource.addEventListener('error', (e) => {
        const data = JSON.parse(e.data);
        console.error('Error:', data.message);
        eventSource.close();
    });
    ```
    """
    return StreamingResponse(
        extraction_event_generator(url),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/extract",
    response_model=ExtractResponse,
    summary="Extract recipe from video URL",
    description="Extracts structured recipe data from a video URL using tiered fallback.",
)
async def extract_recipe(request: ExtractRequest, _key: str = Depends(verify_api_key)) -> ExtractResponse:
    """Extract recipe from a video URL.

    Uses a tiered fallback pipeline:
    1. Metadata: Scrapes description/captions, parses with GPT-4o-mini
    2. Audio: Transcribes with Whisper, parses with GPT-4o-mini
    3. Vision: Analyzes frames with GPT-4o-mini

    For website URLs, extracts directly from HTML.

    Returns the extracted recipe directly - frontend saves to Convex.
    """
    try:
        pipeline = ExtractionPipeline()
        recipe = await pipeline.execute(str(request.url))

        if recipe:
            return ExtractResponse(
                success=True,
                recipe=recipe,
                method_used=recipe.method_used.value,
            )
        else:
            return ExtractResponse(
                success=False,
                error="Could not extract recipe from this video",
            )

    except Exception as e:
        logger.exception(f"Extraction failed for {request.url}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}",
        )


@router.get(
    "/health",
    summary="Health check",
    description="Returns service health status",
)
async def health_check() -> dict:
    """Check if the service is running."""
    return {
        "status": "healthy",
        "service": "recipe-extractor",
    }


class PopulateRequest(BaseModel):
    """Request payload for populating discover recipes."""

    count: int = 10
    dietary_restrictions: list[str] | None = None
    exclude_ingredients: list[str] | None = None


class PopulatedRecipeResponse(BaseModel):
    """Single populated recipe in response."""

    sourceId: str
    sourceUrl: str
    title: str
    description: str | None = None
    cuisine: str | None = None
    difficulty: str | None = None
    imageUrl: str | None = None
    servings: int | None = None
    prepTimeMinutes: int | None = None
    cookTimeMinutes: int | None = None
    totalTimeMinutes: int | None = None
    calories: int | None = None
    proteinGrams: float | None = None
    carbsGrams: float | None = None
    fatGrams: float | None = None
    dietaryTags: list[str] = []
    keywords: list[str] = []
    equipment: list[str] = []
    creatorName: str | None = None
    creatorProfileUrl: str | None = None
    ingredients: list[dict]
    instructions: list[dict]


class PopulateResponse(BaseModel):
    """Response for populate recipes endpoint."""

    success: bool
    count: int
    recipes: list[PopulatedRecipeResponse]
    error: str | None = None


@router.post(
    "/populate-discover",
    response_model=PopulateResponse,
    summary="Populate discover recipes",
    description="Fetches recipes from TheMealDB and enriches them with OpenAI for the discover feed.",
)
async def populate_discover_recipes(request: PopulateRequest, _key: str = Depends(verify_api_key)) -> PopulateResponse:
    """Populate discover recipes from TheMealDB.

    Fetches random recipes from TheMealDB API, then processes each
    through the website extractor to get OpenAI-enhanced recipe data.

    This endpoint is meant to be called periodically or when the
    discover feed runs low on recipes.

    Returns:
        List of enriched recipes ready for storage in Convex.
    """
    try:
        populator = RecipePopulator()
        recipes = await populator.populate_recipes(
            count=request.count,
            dietary_restrictions=request.dietary_restrictions,
            exclude_ingredients=request.exclude_ingredients,
        )

        return PopulateResponse(
            success=True,
            count=len(recipes),
            recipes=[PopulatedRecipeResponse(**r.to_dict()) for r in recipes],
        )

    except ValueError as e:
        # Missing API key or configuration
        logger.error(f"Configuration error: {e}")
        return PopulateResponse(
            success=False,
            count=0,
            recipes=[],
            error=str(e),
        )

    except Exception as e:
        logger.exception("Failed to populate discover recipes")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to populate recipes: {str(e)}",
        )
