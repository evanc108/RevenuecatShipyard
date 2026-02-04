"""Tiered extraction pipeline orchestrator.

Coordinates the extraction system:
- Website URLs: Direct extraction from HTML
- Video URLs: Three-tier fallback system:
  1. Metadata Tier - Fastest, uses video description/captions
  2. Audio Tier - Transcribes speech with Whisper API
  3. Vision Tier - Analyzes frames with GPT-4o (deep fallback)
"""

import logging
from urllib.parse import urlparse

from app.schemas import Recipe
from app.services.extractors import (
    AudioExtractor,
    MetadataExtractor,
    ProgressCallback,
    VisionExtractor,
    WebsiteExtractor,
)
from app.services.extractors.base import BaseExtractor

logger = logging.getLogger(__name__)

# Domains known to host video content
VIDEO_DOMAINS = {
    # YouTube
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "m.youtube.com",
    # TikTok
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",
    # Instagram
    "instagram.com",
    "www.instagram.com",
    # Facebook
    "facebook.com",
    "www.facebook.com",
    "fb.watch",
    # Twitter/X
    "twitter.com",
    "x.com",
    # Vimeo
    "vimeo.com",
    "www.vimeo.com",
    # Twitch (clips)
    "twitch.tv",
    "www.twitch.tv",
    "clips.twitch.tv",
}

# Path patterns that indicate video content
VIDEO_PATH_PATTERNS = [
    "/reel/",
    "/reels/",
    "/shorts/",
    "/video/",
    "/watch",
    "/v/",
    "/p/",  # Instagram posts (can be video)
    "/status/",  # Twitter posts (can be video)
]


def is_video_url(url: str) -> bool:
    """Determine if a URL points to video content.

    Args:
        url: URL to check

    Returns:
        True if URL is likely a video, False for regular websites
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Remove www. prefix for comparison
        if domain.startswith("www."):
            domain_clean = domain[4:]
        else:
            domain_clean = domain

        # Check if domain is a known video platform
        if domain in VIDEO_DOMAINS or domain_clean in VIDEO_DOMAINS:
            return True

        # Check for video path patterns
        path_lower = parsed.path.lower()
        for pattern in VIDEO_PATH_PATTERNS:
            if pattern in path_lower:
                return True

        return False

    except Exception:
        # If we can't parse the URL, assume it's not a video
        return False


class ExtractionPipeline:
    """Orchestrates the extraction pipeline.

    Routes URLs to appropriate extractors:
    - Video URLs go through metadata → audio → vision tiers
    - Website URLs go directly to website extractor
    """

    def __init__(self, progress_callback: ProgressCallback | None = None) -> None:
        """Initialize the pipeline with optional progress callback.

        Args:
            progress_callback: Async function to report progress updates
        """
        self._progress_callback = progress_callback

    def _create_video_tiers(self) -> list[BaseExtractor]:
        """Create the video extraction tier chain."""
        return [
            MetadataExtractor(self._progress_callback),
            AudioExtractor(self._progress_callback),
            VisionExtractor(self._progress_callback),
        ]

    async def execute(self, url: str) -> Recipe | None:
        """Execute the extraction pipeline for a given URL.

        Routes to website or video extraction based on URL.

        Args:
            url: URL to extract recipe from

        Returns:
            Extracted Recipe or None if extraction fails
        """
        if is_video_url(url):
            logger.info(f"Detected video URL: {url}")
            return await self._extract_from_video(url)
        else:
            logger.info(f"Detected website URL: {url}")
            return await self._extract_from_website(url)

    async def _extract_from_website(self, url: str) -> Recipe | None:
        """Extract recipe from a website URL.

        Args:
            url: Website URL to extract from

        Returns:
            Extracted Recipe or None if extraction fails
        """
        extractor = WebsiteExtractor(self._progress_callback)
        logger.info(f"Trying {extractor.tier_name} extractor for {url}")

        result = await extractor.extract(url)

        if result.success and result.recipe:
            logger.info("=== EXTRACTION SUCCESSFUL ===")
            logger.info(f"Tier: {extractor.tier_name}")
            logger.info(f"Title: {result.recipe.title}")
            logger.info(f"Cuisine: {result.recipe.cuisine}")
            logger.info(f"Difficulty: {result.recipe.difficulty}")
            logger.info(f"Ingredients: {len(result.recipe.ingredients)}")
            logger.info(f"Instructions: {len(result.recipe.instructions)}")
            logger.info(f"Servings: {result.recipe.servings}")
            logger.info(f"Total time: {result.recipe.total_time_minutes} min")
            return result.recipe

        logger.warning(f"Website extraction failed for {url}: {result.error}")
        return None

    async def _extract_from_video(self, url: str) -> Recipe | None:
        """Extract recipe from a video URL using tiered fallback.

        Attempts each tier in order, falling back to the next
        if the current tier fails or signals fallback.

        Args:
            url: Video URL to extract from

        Returns:
            Extracted Recipe or None if all tiers fail
        """
        tiers = self._create_video_tiers()
        last_error: str | None = None

        for extractor in tiers:
            logger.info(f"Trying {extractor.tier_name} tier for {url}")

            result = await extractor.extract(url)

            if result.success and result.recipe:
                logger.info("=== EXTRACTION SUCCESSFUL ===")
                logger.info(f"Tier: {extractor.tier_name}")
                logger.info(f"Title: {result.recipe.title}")
                logger.info(f"Cuisine: {result.recipe.cuisine}")
                logger.info(f"Difficulty: {result.recipe.difficulty}")
                logger.info(f"Ingredients: {len(result.recipe.ingredients)}")
                logger.info(f"Instructions: {len(result.recipe.instructions)}")
                logger.info(f"Servings: {result.recipe.servings}")
                logger.info(f"Total time: {result.recipe.total_time_minutes} min")
                return result.recipe

            last_error = result.error
            logger.info(f"{extractor.tier_name} tier failed - {result.error}")

            if not result.should_fallback:
                # Tier explicitly signals no fallback (e.g., vision tier is last)
                break

        # All tiers exhausted
        logger.warning(f"All extraction tiers failed for {url}. Last error: {last_error}")
        return None
