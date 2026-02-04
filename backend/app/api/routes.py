"""API routes for recipe extraction.

Exposes the extraction endpoint that accepts video URLs and
returns extracted recipe data directly.
"""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl

from app.schemas import Recipe
from app.services.extraction_pipeline import ExtractionPipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["extraction"])


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
async def extract_recipe(request: ExtractRequest) -> ExtractResponse:
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
