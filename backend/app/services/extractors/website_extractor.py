"""Website tier extraction.

Extracts recipes from recipe blogs and websites by fetching HTML,
cleaning it, and using OpenAI to parse the recipe content.
"""

import json
import logging
import re

import httpx
from openai import OpenAI

from app.config import get_settings
from app.schemas import ExtractionMethod, Ingredient, Instruction, Recipe
from app.services.extractors.base import BaseExtractor, ExtractionResult, ProgressCallback

logger = logging.getLogger(__name__)

WEBSITE_EXTRACTION_PROMPT = """You are a professional chef and recipe extraction expert. Analyze the following webpage content to extract a comprehensive, detailed recipe that a home cook could follow perfectly.

WEBPAGE CONTENT:
{content}

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
    "dietary_tags": ["vegetarian", "gluten-free", "dairy-free", "vegan", "keto", "low-carb", etc],
    "keywords": ["pasta", "quick", "weeknight", "comfort food", "one-pot", etc],
    "equipment": ["large skillet", "mixing bowl", "whisk", "baking sheet", etc],
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
            "text": "Detailed instruction text that explains not just WHAT to do but HOW to do it properly. Include specific techniques, visual cues to look for (e.g., 'until golden brown', 'until bubbles form'), and any warnings about common mistakes.",
            "time_seconds": 300,
            "temperature": "350°F / 175°C",
            "tip": "Pro tip or note about this step, such as 'Don't overmix or the cookies will be tough' or 'You can prepare this ahead and refrigerate overnight'"
        }}
    ]
}}

If no recipe found:
{{"has_recipe": false}}

INSTRUCTION WRITING GUIDELINES:
1. Write DETAILED instructions - explain the "why" behind techniques, not just the "what"
2. Include VISUAL CUES: "cook until edges are set but center is still jiggly", "sauté until translucent and fragrant"
3. Include TEXTURE CUES: "mix until just combined and slightly shaggy", "knead until smooth and elastic"
4. Include TIMING: both active time and passive time (e.g., "let rest for 10 minutes")
5. Include TEMPERATURES: both cooking temp and target internal temps for meats
6. Add TIPS for each step when relevant: common mistakes to avoid, make-ahead options, substitutions
7. Break complex steps into clear sub-actions within the text
8. Note when to START PREPARING the next ingredient (mise en place timing)
9. Include SAFETY notes where relevant (hot oil, sharp knives, food safety temps)
10. Describe what SUCCESS looks like at each stage

INGREDIENT GUIDELINES:
- Extract EVERY ingredient with precise measurements
- Include preparation notes (diced, minced, room temperature, etc.)
- Note which ingredients are optional
- Categorize: produce, protein, dairy, pantry, spices, etc.

EXAMPLE OF A GOOD INSTRUCTION:
"Heat olive oil in a large skillet over medium-high heat until shimmering and you see the first wisps of smoke, about 2 minutes. Add the chicken thighs skin-side down (you should hear an aggressive sizzle - if not, wait for the pan to get hotter). Don't move them! Let them cook undisturbed for 6-7 minutes until the skin is deeply golden and releases easily from the pan. If it sticks, it's not ready yet."
"""


def _normalize_name(name: str) -> str:
    """Convert ingredient name to normalized format."""
    normalized = name.lower().strip()
    normalized = re.sub(r"[^a-z0-9\s-]", "", normalized)
    normalized = re.sub(r"\s+", "-", normalized)
    return normalized


def _clean_html(html: str) -> str:
    """Clean HTML content for LLM processing.

    Removes navigation, scripts, styles, ads, and other non-content elements.
    Extracts main content from article or main tags when possible.
    """
    # Remove script and style tags with their content
    html = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<noscript[^>]*>[\s\S]*?</noscript>", "", html, flags=re.IGNORECASE)

    # Remove navigation, header, footer, aside elements
    html = re.sub(r"<nav[^>]*>[\s\S]*?</nav>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<header[^>]*>[\s\S]*?</header>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<footer[^>]*>[\s\S]*?</footer>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<aside[^>]*>[\s\S]*?</aside>", "", html, flags=re.IGNORECASE)

    # Remove comments
    html = re.sub(r"<!--[\s\S]*?-->", "", html)

    # Remove divs with ad/sidebar/comment classes
    ad_patterns = [
        r'<div[^>]*class="[^"]*(?:ad|advertisement|sidebar|comment|social|share)[^"]*"[^>]*>[\s\S]*?</div>',
    ]
    for pattern in ad_patterns:
        html = re.sub(pattern, "", html, flags=re.IGNORECASE)

    # Try to extract main/article content
    main_match = re.search(r"<main[^>]*>([\s\S]*?)</main>", html, re.IGNORECASE)
    if main_match:
        html = main_match.group(1)
    else:
        article_match = re.search(r"<article[^>]*>([\s\S]*?)</article>", html, re.IGNORECASE)
        if article_match:
            html = article_match.group(1)

    # Convert common block elements to newlines for readability
    html = re.sub(r"<(?:p|div|br|li|h[1-6])[^>]*>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"</(?:p|div|li|h[1-6])>", "\n", html, flags=re.IGNORECASE)

    # Remove remaining HTML tags
    html = re.sub(r"<[^>]+>", " ", html)

    # Decode HTML entities
    html = html.replace("&nbsp;", " ")
    html = html.replace("&amp;", "&")
    html = html.replace("&lt;", "<")
    html = html.replace("&gt;", ">")
    html = html.replace("&quot;", '"')
    html = html.replace("&#39;", "'")
    html = html.replace("&rsquo;", "'")
    html = html.replace("&lsquo;", "'")
    html = html.replace("&rdquo;", '"')
    html = html.replace("&ldquo;", '"')
    html = html.replace("&mdash;", "—")
    html = html.replace("&ndash;", "–")
    html = html.replace("&deg;", "°")
    html = html.replace("&frac12;", "½")
    html = html.replace("&frac14;", "¼")
    html = html.replace("&frac34;", "¾")

    # Clean up whitespace
    html = re.sub(r"\s+", " ", html)
    html = re.sub(r"\n\s*\n", "\n\n", html)
    html = html.strip()

    return html


def _extract_og_image(html: str) -> str | None:
    """Extract og:image meta tag from HTML."""
    # Try og:image first
    match = re.search(
        r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)

    # Try reverse order (content before property)
    match = re.search(
        r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']',
        html,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)

    # Try twitter:image as fallback
    match = re.search(
        r'<meta[^>]*(?:name|property)=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)

    return None


class WebsiteExtractor(BaseExtractor):
    """Extracts recipe from website HTML using OpenAI."""

    def __init__(self, progress_callback: ProgressCallback | None = None) -> None:
        super().__init__(progress_callback)
        settings = get_settings()
        self._openai = OpenAI(api_key=settings.openai_api_key)

    @property
    def tier_name(self) -> str:
        return "website"

    async def extract(self, url: str) -> ExtractionResult:
        """Extract recipe from website URL."""
        try:
            await self._report_progress("Fetching webpage...", 0.1)

            html, og_image = await self._fetch_page(url)
            if not html:
                return ExtractionResult(
                    success=False,
                    should_fallback=False,
                    error="Failed to fetch webpage",
                )

            await self._report_progress("Cleaning HTML content...", 0.3)

            cleaned_content = _clean_html(html)
            logger.info(f"Cleaned content length: {len(cleaned_content)} characters")
            logger.info(f"Cleaned content preview: {cleaned_content[:500]}...")

            if len(cleaned_content) < 100:
                logger.warning(f"Insufficient content after cleaning: {len(cleaned_content)} chars")
                return ExtractionResult(
                    success=False,
                    should_fallback=False,
                    error=f"Insufficient content found on page ({len(cleaned_content)} chars)",
                )

            await self._report_progress("Analyzing content with AI...", 0.5)

            recipe = await self._parse_with_openai(cleaned_content)
            if not recipe:
                logger.info(f"No recipe found on website {url}")
                return ExtractionResult(
                    success=False,
                    should_fallback=False,
                    error="No recipe found on webpage - LLM could not extract recipe content",
                )

            await self._report_progress("Recipe extracted successfully", 1.0)

            recipe.source_url = url
            recipe.thumbnail_url = og_image

            return ExtractionResult(success=True, recipe=recipe)

        except Exception as e:
            logger.exception(f"Website extraction failed for {url}")
            return ExtractionResult(
                success=False,
                should_fallback=False,
                error=str(e),
            )

    async def _fetch_page(self, url: str) -> tuple[str | None, str | None]:
        """Fetch webpage HTML and extract og:image.

        Returns:
            Tuple of (html_content, og_image_url)
        """
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers=headers,
            ) as client:
                response = await client.get(url)
                logger.info(f"HTTP Status: {response.status_code}")
                response.raise_for_status()
                html = response.text

            logger.info("=== WEBPAGE FETCHED ===")
            logger.info(f"URL: {url}")
            logger.info(f"Content length: {len(html)} characters")
            logger.info(f"HTML preview: {html[:500]}...")

            og_image = _extract_og_image(html)
            if og_image:
                logger.info(f"Found og:image: {og_image}")

            return html, og_image

        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error fetching webpage: {e.response.status_code} - {e}")
            return None, None
        except httpx.RequestError as e:
            logger.warning(f"Request error fetching webpage: {e}")
            return None, None
        except Exception as e:
            logger.warning(f"Failed to fetch webpage: {type(e).__name__}: {e}")
            return None, None

    async def _parse_with_openai(self, content: str) -> Recipe | None:
        """Use OpenAI to parse webpage content into structured recipe."""
        # Limit content length for LLM context
        content_limited = content[:15000]

        prompt = WEBSITE_EXTRACTION_PROMPT.format(content=content_limited)

        response = self._openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        result = response.choices[0].message.content
        if not result:
            return None

        data = json.loads(result)

        logger.info("=== WEBSITE LLM RESPONSE ===")
        logger.info(f"Raw response: {result[:500]}...")
        logger.info(f"has_recipe: {data.get('has_recipe')}")
        logger.info(f"title: {data.get('title')}")
        logger.info(f"ingredients count: {len(data.get('ingredients', []))}")
        logger.info(f"instructions count: {len(data.get('instructions', []))}")

        if not data.get("has_recipe"):
            logger.info("LLM determined no recipe on webpage")
            return None

        # Validate we have actual recipe content
        if not data.get("ingredients") or not data.get("instructions"):
            logger.info(f"LLM returned has_recipe=true but missing content. ingredients={len(data.get('ingredients', []))}, instructions={len(data.get('instructions', []))}")
            return None

        logger.info("=== EXTRACTED INGREDIENTS (from website) ===")
        for i, ing in enumerate(data.get("ingredients", [])[:5]):
            logger.info(f"  {i+1}. {ing.get('raw_text', ing.get('name', 'unknown'))}")
        if len(data.get("ingredients", [])) > 5:
            logger.info(f"  ... and {len(data['ingredients']) - 5} more")

        logger.info("=== EXTRACTED INSTRUCTIONS (from website) ===")
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
            method_used=ExtractionMethod.WEBSITE,
        )
