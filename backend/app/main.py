"""Universal Recipe Extractor - FastAPI Application.

A tiered extraction pipeline that extracts structured recipes from
video content (TikTok, Instagram Reels, YouTube Shorts).

Architecture:
    Tier 1 (Metadata): Scrapes description/comments, parses with LLM
    Tier 2 (Audio): Transcribes with Whisper, parses transcript
    Tier 3 (Vision): Analyzes frames with GPT-4o-mini

All jobs run asynchronously via BackgroundTasks, with status updates
pushed to Convex for real-time frontend polling.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager.

    Handles startup and shutdown events.
    """
    settings = get_settings()
    logger.info(f"Starting Recipe Extractor (debug={settings.debug})")
    yield
    logger.info("Shutting down Recipe Extractor")


def create_app() -> FastAPI:
    """Application factory for the FastAPI app.

    Returns:
        Configured FastAPI application instance
    """
    settings = get_settings()

    app = FastAPI(
        title="Universal Recipe Extractor",
        description=(
            "Extracts structured recipes from video content using a tiered "
            "fallback pipeline: Metadata → Audio → Vision."
        ),
        version="1.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # CORS configuration for Expo/React Native
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:8081",  # Expo dev
            "http://localhost:19006",  # Expo web
            "exp://localhost:19000",  # Expo Go
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # Register routes
    app.include_router(router)

    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
