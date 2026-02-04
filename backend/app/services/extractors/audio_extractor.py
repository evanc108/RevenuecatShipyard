"""Audio tier extraction.

Downloads audio from video, transcribes with OpenAI Whisper API,
then parses the transcript with GPT-4o-mini.
"""

import json
import logging
import re
import tempfile
from pathlib import Path

import yt_dlp
from openai import OpenAI

from app.config import get_settings
from app.schemas import ExtractionMethod, Ingredient, Instruction, Recipe
from app.services.extractors.base import BaseExtractor, ExtractionResult, ProgressCallback

logger = logging.getLogger(__name__)

TRANSCRIPT_EXTRACTION_PROMPT = """You are a professional chef and recipe extraction expert. Analyze the following video transcript to extract a comprehensive, detailed recipe.

This is a TRANSCRIPTION of spoken audio from a cooking video. The creator is explaining their recipe as they cook.

TRANSCRIPT:
{transcript}

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
            "text": "Detailed instruction that captures the creator's technique, visual cues they describe, and their tips",
            "time_seconds": 300,
            "temperature": "350°F / 175°C",
            "tip": "Pro tip or insight the creator shared"
        }}
    ]
}}

If no recipe found:
{{"has_recipe": false}}

CRITICAL - LISTEN TO THE CREATOR:
This transcript captures everything the creator said while cooking. Pay attention to:
- Exact measurements ("about two cups", "a generous pinch")
- Technique descriptions ("fold gently", "really get in there and mix")
- Visual cues they describe ("you'll see it start to bubble", "nice and golden")
- Their personal tips ("my grandma taught me this trick", "the secret is...")
- Warnings ("don't skip this step", "be careful not to...")
- Timing ("this takes about five minutes", "let it rest for a bit")

INSTRUCTION WRITING GUIDELINES:
1. CAPTURE THE CREATOR'S VOICE - preserve their explanations and personality
2. Include VISUAL CUES they describe: "you want to see little bubbles forming"
3. Include TEXTURE CUES: "it should feel smooth, not sticky"
4. Include TIMING mentioned: "cook for about 3-4 minutes", "let it rest"
5. Include TEMPERATURES: cooking temps and internal temps for proteins
6. PRESERVE THEIR TIPS - when they say "the trick is" or "here's a tip", capture it!
7. Note SUBSTITUTIONS they mention
8. Include WARNINGS: "don't overcook or it'll be tough"
9. Capture SENSORY CUES: "you'll smell it when it's ready", "listen for the sizzle"
10. If they explain WHY something works, include that insight

INGREDIENT GUIDELINES:
- Listen for ALL ingredients mentioned throughout the video
- Creators often say amounts conversationally ("a couple tablespoons", "good handful")
- Estimate reasonable quantities when they're vague
- Note preparation ("diced", "at room temperature", "freshly cracked")
- Capture optional ingredients and substitutions mentioned

EXAMPLE OF A GOOD INSTRUCTION:
"Now here's the important part - don't rush this! Add your aromatics to the pan and let them really soften up, stirring occasionally. You want the onions to be translucent and just starting to get some color on the edges. This takes a solid 8-10 minutes. I know it seems like a long time but this is where all the flavor builds. You'll smell when they're ready - your kitchen should smell amazing."
"""


def _normalize_name(name: str) -> str:
    """Convert ingredient name to normalized format."""
    normalized = name.lower().strip()
    normalized = re.sub(r"[^a-z0-9\s-]", "", normalized)
    normalized = re.sub(r"\s+", "-", normalized)
    return normalized


class AudioExtractor(BaseExtractor):
    """Extracts recipe using OpenAI Whisper + GPT-4o-mini."""

    def __init__(self, progress_callback: ProgressCallback | None = None) -> None:
        super().__init__(progress_callback)
        settings = get_settings()
        self._max_duration = settings.max_video_duration_seconds
        self._openai = OpenAI(api_key=settings.openai_api_key)

    @property
    def tier_name(self) -> str:
        return "audio"

    async def extract(self, url: str) -> ExtractionResult:
        """Extract recipe by transcribing video audio."""
        try:
            await self._report_progress("Downloading audio...", 0.1)

            audio_path = await self._download_audio(url)
            if not audio_path:
                return ExtractionResult(
                    success=False,
                    should_fallback=True,
                    error="Failed to download audio",
                )

            try:
                await self._report_progress("Transcribing audio with Whisper...", 0.3)

                transcript = await self._transcribe(audio_path)
                if not transcript or len(transcript.strip()) < 50:
                    logger.info(f"Insufficient speech in audio for {url}")
                    return ExtractionResult(
                        success=False,
                        should_fallback=True,
                        error="No significant speech detected",
                    )

                await self._report_progress("Analyzing transcript with AI...", 0.7)

                recipe = await self._parse_transcript(transcript)
                if not recipe:
                    return ExtractionResult(
                        success=False,
                        should_fallback=True,
                        error="No recipe found in transcript",
                    )

                await self._report_progress("Recipe extracted successfully", 1.0)

                recipe.source_url = url
                return ExtractionResult(success=True, recipe=recipe)

            finally:
                Path(audio_path).unlink(missing_ok=True)

        except Exception as e:
            logger.exception(f"Audio extraction failed for {url}")
            return ExtractionResult(
                success=False,
                should_fallback=True,
                error=str(e),
            )

    async def _download_audio(self, url: str) -> str | None:
        """Download audio from video using yt-dlp."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            output_path = tmp.name

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": output_path.replace(".mp3", ""),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "128",
                }
            ],
            "quiet": True,
            "no_warnings": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)

                duration = info.get("duration", 0)
                if duration > self._max_duration:
                    logger.warning(f"Video too long: {duration}s > {self._max_duration}s")
                    return None

            if Path(output_path).exists():
                return output_path
            if Path(f"{output_path}.mp3").exists():
                return f"{output_path}.mp3"

            return None

        except Exception as e:
            logger.warning(f"Audio download failed: {e}")
            return None

    async def _transcribe(self, audio_path: str) -> str:
        """Transcribe audio using OpenAI Whisper API."""
        logger.info("=== TRANSCRIBING AUDIO ===")
        logger.info(f"Audio file: {audio_path}")

        with open(audio_path, "rb") as audio_file:
            transcript = self._openai.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )

        logger.info("=== TRANSCRIPT ===")
        logger.info(f"Length: {len(transcript)} characters")
        logger.info(f"Content (first 1000 chars): {transcript[:1000]}...")

        return transcript

    async def _parse_transcript(self, transcript: str) -> Recipe | None:
        """Use GPT-4o-mini to parse transcript into structured recipe."""
        prompt = TRANSCRIPT_EXTRACTION_PROMPT.format(transcript=transcript)

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

        logger.info("=== AUDIO LLM RESPONSE ===")
        logger.info(f"has_recipe: {data.get('has_recipe')}")
        logger.info(f"title: {data.get('title')}")
        logger.info(f"ingredients count: {len(data.get('ingredients', []))}")
        logger.info(f"instructions count: {len(data.get('instructions', []))}")

        if not data.get("has_recipe"):
            logger.info("LLM determined no recipe in transcript")
            return None

        # Validate we have actual recipe content
        if not data.get("ingredients") or not data.get("instructions"):
            logger.info("LLM returned has_recipe=true but missing ingredients or instructions")
            return None

        logger.info("=== EXTRACTED INGREDIENTS (from audio) ===")
        for i, ing in enumerate(data.get("ingredients", [])[:5]):
            logger.info(f"  {i+1}. {ing.get('raw_text', ing.get('name', 'unknown'))}")
        if len(data.get("ingredients", [])) > 5:
            logger.info(f"  ... and {len(data['ingredients']) - 5} more")

        logger.info("=== EXTRACTED INSTRUCTIONS (from audio) ===")
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
            method_used=ExtractionMethod.AUDIO,
        )
