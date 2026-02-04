"""Vision tier extraction (deep fallback).

Uses GPT-4o to analyze video frames for text overlays
and visual recipe content when metadata and audio fail.
"""

import base64
import json
import logging
import re
import subprocess
import tempfile
from pathlib import Path

import yt_dlp
from openai import OpenAI

from app.config import get_settings
from app.schemas import ExtractionMethod, Ingredient, Instruction, Recipe
from app.services.extractors.base import BaseExtractor, ExtractionResult, ProgressCallback

logger = logging.getLogger(__name__)

VISION_EXTRACTION_PROMPT = """You are a professional chef and recipe extraction expert analyzing video frames from a cooking video.

Carefully examine each frame to extract a comprehensive recipe. Look for:

1. TEXT OVERLAYS: Recipe title, ingredient lists, step numbers, measurements, timing
2. ON-SCREEN GRAPHICS: Recipe cards, ingredient callouts, temperature displays
3. VISIBLE INGREDIENTS: What's being used, approximate quantities, preparation state
4. COOKING PROCESS: Techniques being demonstrated, equipment used, visual doneness cues
5. PACKAGING/LABELS: Brand names, specific product types, measurements on packages

Extract a structured recipe with ALL available information.

Respond with valid JSON:
{
    "has_recipe": true,
    "title": "Recipe Name",
    "description": "Appetizing 2-3 sentence description based on what you see being prepared",
    "cuisine": "Italian/Mexican/Asian/American/French/etc or empty string if unknown",
    "difficulty": "easy/medium/hard based on techniques observed",
    "servings": null or number (estimate from portion sizes if visible),
    "prep_time_minutes": null or number,
    "cook_time_minutes": null or number,
    "total_time_minutes": null or number,
    "calories": number (REQUIRED - estimate per serving based on ingredients),
    "protein_grams": number (REQUIRED - estimate per serving based on ingredients),
    "carbs_grams": number (REQUIRED - estimate per serving based on ingredients),
    "fat_grams": number (REQUIRED - estimate per serving based on ingredients),
    "dietary_tags": ["vegetarian", "gluten-free", "dairy-free", etc - based on visible ingredients],
    "keywords": ["pasta", "quick", "stir-fry", "baked", etc],
    "equipment": ["wok", "stand mixer", "cast iron skillet", etc - what you see being used],
    "ingredients": [
        {
            "raw_text": "2 cups all-purpose flour",
            "name": "all-purpose flour",
            "normalized_name": "all-purpose-flour",
            "quantity": 2.0,
            "unit": "cups",
            "preparation": "sifted",
            "category": "baking",
            "optional": false,
            "sort_order": 1
        }
    ],
    "instructions": [
        {
            "step_number": 1,
            "text": "Detailed instruction describing what you observe happening in the video, including technique and visual cues for doneness",
            "time_seconds": 300,
            "temperature": "350°F / 175°C",
            "tip": "Tip based on technique observed or text shown"
        }
    ]
}

If no recipe found:
{"has_recipe": false}

NUTRITION ESTIMATION (REQUIRED):
You MUST calculate and provide nutrition values (calories, protein_grams, carbs_grams, fat_grams) per serving based on the ingredients you identify. Use standard nutritional values:
- Proteins: chicken breast ~165 cal/4oz, 31g protein; ground beef ~290 cal/4oz, 19g protein; salmon ~230 cal/4oz, 25g protein; eggs ~70 cal each, 6g protein; tofu ~80 cal/4oz, 9g protein
- Carbs: rice ~200 cal/cup cooked, 45g carbs; pasta ~200 cal/cup cooked, 40g carbs; bread ~80 cal/slice, 15g carbs; flour ~455 cal/cup, 95g carbs
- Fats: butter ~100 cal/tbsp, 11g fat; olive oil ~120 cal/tbsp, 14g fat; cheese ~110 cal/oz, 9g fat
- Vegetables: most are ~25-50 cal/cup; potatoes ~160 cal/medium, 37g carbs
- Sum up all ingredients, then divide by number of servings to get per-serving values. Round to whole numbers.

INSTRUCTION WRITING GUIDELINES:
1. DESCRIBE WHAT YOU SEE: "The butter is added to a hot pan and swirled until foaming"
2. NOTE VISUAL CUES FOR DONENESS: "Cook until the edges turn golden brown like shown in frame 3"
3. IDENTIFY TECHNIQUES: "Using a folding motion to incorporate the flour gently"
4. NOTE EQUIPMENT: "Transfer to a cast iron skillet for even heat distribution"
5. ESTIMATE TIMING: Based on visual progression between frames
6. INCLUDE TEMPERATURES: From oven displays, thermometers, or text overlays
7. DESCRIBE TEXTURE/COLOR: "The mixture should look smooth and glossy"
8. NOTE PORTION SIZES: "Divide into 12 equal balls as shown"
9. CAPTURE TEXT TIPS: Any tips shown as text overlays
10. DESCRIBE FINAL RESULT: What the finished dish looks like

INGREDIENT GUIDELINES:
- Identify ALL ingredients visible in the frames
- Estimate quantities from visual size (handful, small bowl, etc.)
- Note the state of ingredients (chopped, whole, melted, room temperature)
- Read any visible labels or text overlays for exact measurements
- Categorize by type: proteins, vegetables, dairy, seasonings, etc.

EXAMPLE OF A GOOD INSTRUCTION:
"Heat oil in a large wok until shimmering (you can see the oil moving in the pan). Add the marinated chicken pieces in a single layer - notice how they sizzle immediately on contact. Let them cook undisturbed until the bottom is golden and slightly charred, about 2-3 minutes based on the color change visible between frames. The chicken should release easily from the wok when ready to flip."
"""


def _normalize_name(name: str) -> str:
    """Convert ingredient name to normalized format."""
    normalized = name.lower().strip()
    normalized = re.sub(r"[^a-z0-9\s-]", "", normalized)
    normalized = re.sub(r"\s+", "-", normalized)
    return normalized


class VisionExtractor(BaseExtractor):
    """Extracts recipe by analyzing video frames with GPT-4o."""

    def __init__(self, progress_callback: ProgressCallback | None = None) -> None:
        super().__init__(progress_callback)
        settings = get_settings()
        self._openai = OpenAI(api_key=settings.openai_api_key)
        self._max_duration = settings.max_video_duration_seconds

    @property
    def tier_name(self) -> str:
        return "vision"

    async def extract(self, url: str) -> ExtractionResult:
        """Extract recipe by analyzing video frames with GPT-4o."""
        try:
            await self._report_progress("Downloading video...", 0.1)

            video_path = await self._download_video(url)
            if not video_path:
                return ExtractionResult(
                    success=False,
                    should_fallback=False,
                    error="Failed to download video",
                )

            try:
                await self._report_progress("Extracting video frames...", 0.3)

                frames = await self._extract_frames(video_path)
                if not frames:
                    return ExtractionResult(
                        success=False,
                        should_fallback=False,
                        error="Failed to extract video frames",
                    )

                await self._report_progress("Analyzing frames with AI vision...", 0.6)

                recipe = await self._analyze_with_gpt4o(frames)
                if not recipe:
                    return ExtractionResult(
                        success=False,
                        should_fallback=False,
                        error="No recipe found in video frames",
                    )

                await self._report_progress("Recipe extracted successfully", 1.0)

                recipe.source_url = url
                return ExtractionResult(success=True, recipe=recipe)

            finally:
                Path(video_path).unlink(missing_ok=True)

        except Exception as e:
            logger.exception(f"Vision extraction failed for {url}")
            return ExtractionResult(
                success=False,
                should_fallback=False,
                error=str(e),
            )

    async def _download_video(self, url: str) -> str | None:
        """Download video using yt-dlp."""
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            output_path = tmp.name

        ydl_opts = {
            "format": "worst[ext=mp4]/worst",
            "outtmpl": output_path,
            "quiet": True,
            "no_warnings": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)

                duration = info.get("duration", 0)
                if duration > self._max_duration:
                    logger.warning(f"Video too long: {duration}s")
                    return None

            if Path(output_path).exists():
                return output_path
            return None

        except Exception as e:
            logger.warning(f"Video download failed: {e}")
            return None

    async def _extract_frames(self, video_path: str, num_frames: int = 6) -> list[bytes]:
        """Extract evenly-spaced frames from video using ffmpeg."""
        frames = []
        with tempfile.TemporaryDirectory() as tmpdir:
            # Get video duration first
            probe_cmd = [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", video_path
            ]
            try:
                result = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
                duration = float(result.stdout.strip())
            except Exception:
                duration = 60  # Default if probe fails

            # Calculate frame interval
            interval = max(1, int(duration / num_frames))

            # Extract frames at intervals
            cmd = [
                "ffmpeg",
                "-i", video_path,
                "-vf", f"fps=1/{interval},scale=512:-1",
                "-frames:v", str(num_frames),
                f"{tmpdir}/frame_%03d.jpg",
                "-y",
                "-loglevel", "error",
            ]

            try:
                subprocess.run(cmd, check=True, capture_output=True)
            except subprocess.CalledProcessError as e:
                logger.warning(f"ffmpeg frame extraction failed: {e}")
                return []

            for frame_path in sorted(Path(tmpdir).glob("frame_*.jpg")):
                frames.append(frame_path.read_bytes())

        logger.info("=== FRAMES EXTRACTED ===")
        logger.info(f"Extracted {len(frames)} frames from video")
        for i, frame in enumerate(frames):
            logger.info(f"  Frame {i+1}: {len(frame)} bytes")
        return frames

    async def _analyze_with_gpt4o(self, frames: list[bytes]) -> Recipe | None:
        """Use GPT-4o to analyze frames for recipe content."""
        # Build messages with images
        content = [{"type": "text", "text": VISION_EXTRACTION_PROMPT}]

        for frame_bytes in frames:
            base64_image = base64.b64encode(frame_bytes).decode("utf-8")
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}",
                    "detail": "low",
                },
            })

        response = self._openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": content}],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=4096,
        )

        text = response.choices[0].message.content
        if not text:
            return None

        data = json.loads(text)

        logger.info("=== VISION LLM RESPONSE ===")
        logger.info(f"has_recipe: {data.get('has_recipe')}")
        logger.info(f"title: {data.get('title')}")
        logger.info(f"ingredients count: {len(data.get('ingredients', []))}")
        logger.info(f"instructions count: {len(data.get('instructions', []))}")

        if not data.get("has_recipe"):
            logger.info("LLM determined no recipe in video frames")
            return None

        # Validate we have actual recipe content
        if not data.get("ingredients") or not data.get("instructions"):
            logger.info("LLM returned has_recipe=true but missing ingredients or instructions")
            return None

        logger.info("=== EXTRACTED INGREDIENTS (from vision) ===")
        for i, ing in enumerate(data.get("ingredients", [])[:5]):
            logger.info(f"  {i+1}. {ing.get('raw_text', ing.get('name', 'unknown'))}")
        if len(data.get("ingredients", [])) > 5:
            logger.info(f"  ... and {len(data['ingredients']) - 5} more")

        logger.info("=== EXTRACTED INSTRUCTIONS (from vision) ===")
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
            method_used=ExtractionMethod.VISION,
        )
