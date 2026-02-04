"""Metadata tier extraction.

Scrapes video description and captions using yt-dlp,
then uses OpenAI to parse recipe information.
"""

import json
import logging
import re

import httpx
import yt_dlp
from openai import OpenAI

from app.config import get_settings
from app.schemas import ExtractionMethod, Ingredient, Instruction, Recipe
from app.services.extractors.base import BaseExtractor, ExtractionResult, ProgressCallback

logger = logging.getLogger(__name__)

RECIPE_EXTRACTION_PROMPT = """You are a professional chef and recipe extraction expert. Analyze the following video metadata (title, description, and captions) to extract a comprehensive, detailed recipe.

VIDEO METADATA:
Title: {title}

Description:
{description}

Captions/Subtitles (SPOKEN CONTENT - PRIMARY SOURCE):
{captions}

Creator: {creator}
Creator URL: {creator_url}

Respond with valid JSON in this exact format:
{{
    "has_recipe": true,
    "title": "Recipe Name",
    "description": "Appetizing 2-3 sentence description of the dish, what makes it special, and what to expect",
    "cuisine": "Italian/Mexican/Asian/American/French/etc or empty string if unknown",
    "difficulty": "easy/medium/hard based on technique complexity",
    "servings": null or number,
    "prep_time_minutes": null or number,
    "cook_time_minutes": null or number,
    "total_time_minutes": null or number,
    "calories": null or number,
    "protein_grams": null or number,
    "carbs_grams": null or number,
    "fat_grams": null or number,
    "dietary_tags": ["vegetarian", "gluten-free", "dairy-free", "vegan", "keto", etc],
    "keywords": ["pasta", "quick", "weeknight", "comfort food", "viral", etc],
    "equipment": ["large skillet", "mixing bowl", "whisk", "blender", etc],
    "ingredients": [
        {{
            "raw_text": "2 cups all-purpose flour, sifted",
            "name": "all-purpose flour",
            "normalized_name": "all-purpose-flour",
            "quantity": 2.0,
            "unit": "cups",
            "preparation": "sifted",
            "category": "baking",
            "optional": false,
            "sort_order": 1
        }}
    ],
    "instructions": [
        {{
            "step_number": 1,
            "text": "Detailed instruction that explains the technique, visual cues, and what success looks like at this stage",
            "time_seconds": 300,
            "temperature": "350°F / 175°C",
            "tip": "Pro tip or common mistake to avoid"
        }}
    ]
}}

If no recipe found:
{{"has_recipe": false}}

CRITICAL - CAPTIONS ARE YOUR PRIMARY SOURCE:
The captions contain exactly what the creator said in the video. Pay close attention to:
- Exact measurements and quantities mentioned verbally
- Cooking techniques described ("fold gently", "whisk vigorously")
- Visual cues they mention ("until it looks like this", "you want it golden")
- Tips and tricks they share
- Warnings about common mistakes

INSTRUCTION WRITING GUIDELINES:
1. Write DETAILED instructions based on what the creator explains in the video
2. Include VISUAL CUES mentioned: "cook until edges are set", "it should be fragrant"
3. Include TEXTURE CUES: "mix until just combined", "should be smooth and glossy"
4. Include TIMING from the video: both active and passive time
5. Include TEMPERATURES mentioned for cooking and target internal temps
6. Add TIPS the creator mentions - these are valuable insights!
7. If the creator says "this is the secret" or "the trick is" - capture that as a tip
8. Note any SUBSTITUTIONS the creator suggests
9. Include SAFETY notes if mentioned
10. Capture the creator's personality and unique tips

INGREDIENT GUIDELINES:
- Extract EVERY ingredient mentioned (listen carefully to the captions)
- If exact amounts aren't given, make reasonable estimates based on context
- Include preparation notes mentioned (diced, room temperature, etc.)
- Note optional ingredients or substitutions mentioned

EXAMPLE OF A GOOD INSTRUCTION (based on what a creator might say):
"Add your butter to a cold pan - this is key, don't heat the pan first! Turn the heat to medium and let the butter melt slowly, swirling occasionally. You want it to foam up and then the foam will subside. Keep watching for little brown specks at the bottom and that nutty smell - that's when you know it's browned butter. This takes about 4-5 minutes. Don't walk away or it'll burn!"
"""


def _normalize_name(name: str) -> str:
    """Convert ingredient name to normalized format."""
    normalized = name.lower().strip()
    normalized = re.sub(r"[^a-z0-9\s-]", "", normalized)
    normalized = re.sub(r"\s+", "-", normalized)
    return normalized


def _parse_vtt_to_text(vtt_content: str) -> str:
    """Parse VTT subtitle content to plain text.

    Removes timestamps, cue identifiers, and HTML-like tags.
    """
    lines = []
    for line in vtt_content.split("\n"):
        line = line.strip()
        # Skip WEBVTT header
        if line.startswith("WEBVTT"):
            continue
        # Skip timestamp lines (00:00:00.000 --> 00:00:05.000)
        if "-->" in line:
            continue
        # Skip numeric cue identifiers
        if line.isdigit():
            continue
        # Skip empty lines and NOTE lines
        if not line or line.startswith("NOTE"):
            continue
        # Remove HTML-like tags (<c>, </c>, <b>, etc.)
        line = re.sub(r"<[^>]+>", "", line)
        # Skip if empty after tag removal
        if line:
            lines.append(line)

    # Remove consecutive duplicates (common in VTT)
    deduped = []
    for line in lines:
        if not deduped or line != deduped[-1]:
            deduped.append(line)

    return " ".join(deduped)


class MetadataExtractor(BaseExtractor):
    """Extracts recipe from video metadata using yt-dlp and OpenAI."""

    def __init__(self, progress_callback: ProgressCallback | None = None) -> None:
        super().__init__(progress_callback)
        settings = get_settings()
        self._openai = OpenAI(api_key=settings.openai_api_key)

    @property
    def tier_name(self) -> str:
        return "metadata"

    async def extract(self, url: str) -> ExtractionResult:
        """Extract recipe from video metadata."""
        try:
            await self._report_progress("Fetching video metadata...", 0.1)

            metadata = await self._fetch_metadata(url)
            if not metadata:
                return ExtractionResult(
                    success=False,
                    should_fallback=True,
                    error="Failed to fetch video metadata",
                )

            await self._report_progress("Extracting captions...", 0.3)

            captions = await self._extract_captions(metadata.get("_info", {}))
            metadata["captions"] = captions

            await self._report_progress("Analyzing content with AI...", 0.5)

            recipe = await self._parse_with_openai(metadata)
            if not recipe:
                logger.info(f"No recipe found in metadata for {url}")
                return ExtractionResult(
                    success=False,
                    should_fallback=True,
                    error="No recipe found in metadata",
                )

            await self._report_progress("Recipe extracted successfully", 1.0)

            recipe.source_url = url
            recipe.thumbnail_url = metadata.get("thumbnail")
            recipe.creator_name = metadata.get("creator", "")
            recipe.creator_profile_url = metadata.get("creator_url")

            return ExtractionResult(success=True, recipe=recipe)

        except Exception as e:
            logger.exception(f"Metadata extraction failed for {url}")
            return ExtractionResult(
                success=False,
                should_fallback=True,
                error=str(e),
            )

    async def _fetch_metadata(self, url: str) -> dict | None:
        """Fetch video metadata using yt-dlp."""
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "skip_download": True,
            # Caption extraction options
            "writeautomaticsub": True,
            "writesubtitles": True,
            "subtitleslangs": ["en", "en-US", "en-GB", "en-orig"],
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            if not info:
                return None

            creator = info.get("uploader") or info.get("channel") or ""
            creator_url = info.get("uploader_url") or info.get("channel_url")

            title = info.get("title", "")
            description = info.get("description", "")

            logger.info("=== METADATA FETCHED ===")
            logger.info(f"Title: {title}")
            logger.info(f"Creator: {creator}")
            logger.info(f"Description (first 500 chars): {description[:500]}...")

            # Check for available subtitles
            subtitles = info.get("subtitles", {})
            auto_captions = info.get("automatic_captions", {})
            logger.info(f"Manual subtitles available: {list(subtitles.keys())}")
            logger.info(f"Auto captions available: {list(auto_captions.keys())}")

            return {
                "title": title,
                "description": description,
                "thumbnail": info.get("thumbnail"),
                "creator": creator,
                "creator_url": creator_url,
                "_info": info,  # Keep full info for caption extraction
            }

        except Exception as e:
            logger.warning(f"yt-dlp metadata fetch failed: {e}")
            return None

    async def _extract_captions(self, info: dict) -> str:
        """Extract captions/subtitles from video info.

        Priority:
        1. Manual subtitles (creator-provided)
        2. Auto-generated captions
        """
        if not info:
            return ""

        subtitles = info.get("subtitles", {})
        auto_captions = info.get("automatic_captions", {})

        # Try manual subtitles first (higher quality)
        caption_url = None
        caption_source = None

        for lang in ["en", "en-US", "en-GB", "en-orig"]:
            if lang in subtitles:
                formats = subtitles[lang]
                caption_url = self._get_best_caption_url(formats)
                if caption_url:
                    caption_source = f"manual ({lang})"
                    break

        # Fall back to auto captions
        if not caption_url:
            for lang in ["en", "en-US", "en-GB", "en-orig"]:
                if lang in auto_captions:
                    formats = auto_captions[lang]
                    caption_url = self._get_best_caption_url(formats)
                    if caption_url:
                        caption_source = f"auto ({lang})"
                        break

        if not caption_url:
            logger.info("No captions available for this video")
            return ""

        logger.info(f"Fetching {caption_source} captions from: {caption_url[:100]}...")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(caption_url)
                response.raise_for_status()
                content = response.text

            # Parse VTT/SRT to plain text
            text = _parse_vtt_to_text(content)

            logger.info(f"Extracted {len(text)} characters of caption text")
            logger.info(f"Caption preview: {text[:500]}...")

            return text

        except Exception as e:
            logger.warning(f"Failed to fetch captions: {e}")
            return ""

    def _get_best_caption_url(self, formats: list[dict]) -> str | None:
        """Get the best caption URL from available formats.

        Prefers VTT, then SRT, then any other format.
        """
        vtt_url = None
        srt_url = None
        any_url = None

        for fmt in formats:
            url = fmt.get("url")
            if not url:
                continue

            ext = fmt.get("ext", "")
            if ext == "vtt":
                vtt_url = url
            elif ext == "srt":
                srt_url = url
            elif not any_url:
                any_url = url

        return vtt_url or srt_url or any_url

    async def _parse_with_openai(self, metadata: dict) -> Recipe | None:
        """Use OpenAI to parse metadata into structured recipe."""
        captions_text = metadata.get("captions", "")

        # If we have good captions, they're the primary source
        if len(captions_text) > 100:
            captions_display = captions_text[:8000]  # Limit for context
        else:
            captions_display = "No captions available"

        prompt = RECIPE_EXTRACTION_PROMPT.format(
            title=metadata.get("title", ""),
            description=metadata.get("description", ""),
            captions=captions_display,
            creator=metadata.get("creator", "Unknown"),
            creator_url=metadata.get("creator_url", ""),
        )

        response = self._openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        content = response.choices[0].message.content
        if not content:
            return None

        data = json.loads(content)

        logger.info("=== LLM RESPONSE ===")
        logger.info(f"has_recipe: {data.get('has_recipe')}")
        logger.info(f"title: {data.get('title')}")
        logger.info(f"ingredients count: {len(data.get('ingredients', []))}")
        logger.info(f"instructions count: {len(data.get('instructions', []))}")

        if not data.get("has_recipe"):
            logger.info("LLM determined no recipe in metadata")
            return None

        # Validate we have actual recipe content
        if not data.get("ingredients") or not data.get("instructions"):
            logger.info("LLM returned has_recipe=true but missing ingredients or instructions")
            return None

        logger.info("=== EXTRACTED INGREDIENTS ===")
        for i, ing in enumerate(data.get("ingredients", [])[:5]):
            logger.info(f"  {i+1}. {ing.get('raw_text', ing.get('name', 'unknown'))}")
        if len(data.get("ingredients", [])) > 5:
            logger.info(f"  ... and {len(data['ingredients']) - 5} more")

        logger.info("=== EXTRACTED INSTRUCTIONS ===")
        for i, inst in enumerate(data.get("instructions", [])[:3]):
            logger.info(f"  Step {inst.get('step_number', i+1)}: {inst.get('text', '')[:100]}...")
        if len(data.get("instructions", [])) > 3:
            logger.info(f"  ... and {len(data['instructions']) - 3} more steps")

        ingredients = []
        for idx, i in enumerate(data.get("ingredients", [])):
            quantity = i.get("quantity")
            ingredients.append(
                Ingredient(
                    raw_text=i.get("raw_text") or f"{quantity or ''} {i.get('unit', '')} {i.get('name', '')}".strip(),
                    name=i.get("name") or "",
                    normalized_name=i.get("normalized_name") or _normalize_name(i.get("name") or ""),
                    quantity=float(quantity) if quantity is not None else 0.0,
                    unit=i.get("unit") or "",
                    preparation=i.get("preparation") or "",
                    category=i.get("category") or "",
                    optional=bool(i.get("optional")),
                    sort_order=i.get("sort_order") or idx + 1,
                )
            )

        instructions = []
        for idx, inst in enumerate(data.get("instructions", [])):
            instructions.append(
                Instruction(
                    step_number=inst.get("step_number", idx + 1),
                    text=inst.get("text", ""),
                    time_seconds=inst.get("time_seconds"),
                    temperature=inst.get("temperature"),
                    tip=inst.get("tip"),
                )
            )

        return Recipe(
            title=data["title"],
            description=data.get("description", ""),
            cuisine=data.get("cuisine", ""),
            difficulty=data.get("difficulty", ""),
            servings=data.get("servings"),
            prep_time_minutes=data.get("prep_time_minutes"),
            cook_time_minutes=data.get("cook_time_minutes"),
            total_time_minutes=data.get("total_time_minutes"),
            calories=data.get("calories"),
            protein_grams=data.get("protein_grams"),
            carbs_grams=data.get("carbs_grams"),
            fat_grams=data.get("fat_grams"),
            dietary_tags=data.get("dietary_tags", []),
            keywords=data.get("keywords", []),
            equipment=data.get("equipment", []),
            ingredients=ingredients,
            instructions=instructions,
            method_used=ExtractionMethod.METADATA,
        )
