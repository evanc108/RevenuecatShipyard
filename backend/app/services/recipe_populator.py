"""Recipe populator service.

Fetches recipes from TheMealDB API and enriches them using
the website extractor to get OpenAI-enhanced recipe data.
"""

import asyncio
import hashlib
import logging
from dataclasses import dataclass

import httpx

from app.schemas import Recipe
from app.services.extractors.website_extractor import WebsiteExtractor

logger = logging.getLogger(__name__)

THEMEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1"


@dataclass
class TheMealDBMeal:
    """Minimal meal data from TheMealDB."""

    id: str
    title: str
    source_url: str
    image: str
    category: str
    area: str


@dataclass
class PopulatedRecipe:
    """Recipe ready for storage in Convex discoverRecipes table."""

    source_id: str
    source_url: str
    title: str
    description: str | None
    cuisine: str | None
    difficulty: str | None
    image_url: str | None
    servings: int | None
    prep_time_minutes: int | None
    cook_time_minutes: int | None
    total_time_minutes: int | None
    calories: int | None
    protein_grams: float | None
    carbs_grams: float | None
    fat_grams: float | None
    dietary_tags: list[str]
    keywords: list[str]
    equipment: list[str]
    creator_name: str | None
    creator_profile_url: str | None
    ingredients: list[dict]
    instructions: list[dict]

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "sourceId": self.source_id,
            "sourceUrl": self.source_url,
            "title": self.title,
            "description": self.description,
            "cuisine": self.cuisine,
            "difficulty": self.difficulty,
            "imageUrl": self.image_url,
            "servings": self.servings,
            "prepTimeMinutes": self.prep_time_minutes,
            "cookTimeMinutes": self.cook_time_minutes,
            "totalTimeMinutes": self.total_time_minutes,
            "calories": self.calories,
            "proteinGrams": self.protein_grams,
            "carbsGrams": self.carbs_grams,
            "fatGrams": self.fat_grams,
            "dietaryTags": self.dietary_tags,
            "keywords": self.keywords,
            "equipment": self.equipment,
            "creatorName": self.creator_name,
            "creatorProfileUrl": self.creator_profile_url,
            "ingredients": self.ingredients,
            "instructions": self.instructions,
        }


def _generate_source_id(url: str) -> str:
    """Generate a unique source ID from URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _recipe_to_populated(recipe: Recipe, source_url: str, image_url: str | None, area: str | None) -> PopulatedRecipe:
    """Convert extraction Recipe to PopulatedRecipe."""
    return PopulatedRecipe(
        source_id=_generate_source_id(source_url),
        source_url=source_url,
        title=recipe.title,
        description=recipe.description or None,
        cuisine=recipe.cuisine or area or None,
        difficulty=recipe.difficulty or None,
        image_url=recipe.thumbnail_url or image_url,
        servings=recipe.servings,
        prep_time_minutes=recipe.prep_time_minutes,
        cook_time_minutes=recipe.cook_time_minutes,
        total_time_minutes=recipe.total_time_minutes,
        calories=recipe.calories,
        protein_grams=recipe.protein_grams,
        carbs_grams=recipe.carbs_grams,
        fat_grams=recipe.fat_grams,
        dietary_tags=recipe.dietary_tags,
        keywords=recipe.keywords,
        equipment=recipe.equipment,
        creator_name=recipe.creator_name or "TheMealDB",
        creator_profile_url=recipe.creator_profile_url,
        ingredients=[
            {
                "rawText": ing.raw_text,
                "name": ing.name,
                "normalizedName": ing.normalized_name,
                "quantity": ing.quantity,
                "unit": ing.unit,
                "preparation": ing.preparation or None,
                "category": ing.category or None,
                "optional": ing.optional,
                "sortOrder": ing.sort_order,
            }
            for ing in recipe.ingredients
        ],
        instructions=[
            {
                "stepNumber": inst.step_number,
                "text": inst.text,
                "timeSeconds": inst.time_seconds,
                "temperature": inst.temperature,
                "tip": inst.tip,
            }
            for inst in recipe.instructions
        ],
    )


def _matches_dietary_restrictions(category: str, restrictions: list[str] | None) -> bool:
    """Check if meal category matches dietary restrictions."""
    if not restrictions:
        return True

    category_lower = category.lower()

    for restriction in restrictions:
        r = restriction.lower()

        if r == "vegetarian":
            meat_categories = ["beef", "chicken", "lamb", "pork", "goat", "seafood"]
            if any(c in category_lower for c in meat_categories):
                return False

        if r == "vegan":
            non_vegan_categories = ["beef", "chicken", "lamb", "pork", "goat", "seafood", "dessert"]
            if any(c in category_lower for c in non_vegan_categories):
                return False

    return True


class RecipePopulator:
    """Service for populating discover recipes from TheMealDB."""

    def __init__(self) -> None:
        self._extractor = WebsiteExtractor()

    async def fetch_random_meal(self) -> TheMealDBMeal | None:
        """Fetch a single random meal from TheMealDB.

        Returns:
            TheMealDBMeal with basic info or None if fetch fails
        """
        url = f"{THEMEALDB_BASE_URL}/random.php"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                meals = data.get("meals", [])
                if not meals:
                    return None

                meal = meals[0]
                source_url = meal.get("strSource") or f"https://www.themealdb.com/meal/{meal['idMeal']}"

                return TheMealDBMeal(
                    id=meal["idMeal"],
                    title=meal["strMeal"],
                    source_url=source_url,
                    image=meal.get("strMealThumb", ""),
                    category=meal.get("strCategory", ""),
                    area=meal.get("strArea", ""),
                )

            except Exception as e:
                logger.error(f"Error fetching random meal: {e}")
                return None

    async def fetch_themealdb_recipes(
        self,
        count: int = 10,
        dietary_restrictions: list[str] | None = None,
        exclude_ingredients: list[str] | None = None,
    ) -> list[TheMealDBMeal]:
        """Fetch random recipes from TheMealDB API.

        Note: TheMealDB only returns 1 random meal at a time, so we make
        multiple requests to get the desired count.

        Args:
            count: Number of recipes to fetch
            dietary_restrictions: List of dietary restrictions (e.g., vegetarian, vegan)
            exclude_ingredients: List of ingredients to exclude

        Returns:
            List of TheMealDBMeal with basic info
        """
        recipes: list[TheMealDBMeal] = []
        seen_ids: set[str] = set()
        max_attempts = count * 5  # Limit API calls

        for _ in range(max_attempts):
            if len(recipes) >= count:
                break

            meal = await self.fetch_random_meal()
            if not meal:
                continue

            # Skip duplicates
            if meal.id in seen_ids:
                continue
            seen_ids.add(meal.id)

            # Apply dietary restrictions filter
            if not _matches_dietary_restrictions(meal.category, dietary_restrictions):
                continue

            # Apply ingredient exclusion filter (basic check - full check done during enrichment)
            # TheMealDB random endpoint doesn't include ingredients in the response

            recipes.append(meal)

        logger.info(f"Fetched {len(recipes)} recipes from TheMealDB")
        return recipes

    async def enrich_recipe(self, meal: TheMealDBMeal) -> PopulatedRecipe | None:
        """Enrich a TheMealDB recipe using the website extractor.

        Args:
            meal: Basic meal info from TheMealDB

        Returns:
            Fully enriched PopulatedRecipe or None if extraction fails
        """
        logger.info(f"Enriching recipe: {meal.title} from {meal.source_url}")

        try:
            result = await self._extractor.extract(meal.source_url)

            if not result.success or not result.recipe:
                logger.warning(f"Failed to extract recipe from {meal.source_url}: {result.error}")
                return None

            populated = _recipe_to_populated(
                result.recipe,
                meal.source_url,
                meal.image,
                meal.area,
            )

            logger.info(f"Successfully enriched recipe: {populated.title}")
            return populated

        except Exception as e:
            logger.exception(f"Error enriching recipe {meal.title}: {e}")
            return None

    async def populate_recipes(
        self,
        count: int = 10,
        dietary_restrictions: list[str] | None = None,
        exclude_ingredients: list[str] | None = None,
        max_concurrent: int = 3,
    ) -> list[PopulatedRecipe]:
        """Fetch and enrich recipes from TheMealDB.

        Args:
            count: Number of recipes to attempt to populate
            dietary_restrictions: Dietary filters
            exclude_ingredients: Ingredients to exclude
            max_concurrent: Max concurrent extraction tasks

        Returns:
            List of successfully enriched recipes
        """
        # Fetch more than needed since some extractions may fail
        fetch_count = min(count * 2, 50)
        meals = await self.fetch_themealdb_recipes(
            count=fetch_count,
            dietary_restrictions=dietary_restrictions,
            exclude_ingredients=exclude_ingredients,
        )

        if not meals:
            logger.warning("No recipes fetched from TheMealDB")
            return []

        # Process recipes with limited concurrency
        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_with_semaphore(meal: TheMealDBMeal) -> PopulatedRecipe | None:
            async with semaphore:
                return await self.enrich_recipe(meal)

        # Create tasks for all meals
        tasks = [process_with_semaphore(m) for m in meals]

        # Wait for results
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter successful results
        populated_recipes = []
        for result in results:
            if isinstance(result, PopulatedRecipe):
                # Apply ingredient exclusion filter on enriched recipe
                if exclude_ingredients:
                    ingredients_text = " ".join(
                        ing.get("name", "").lower() for ing in result.ingredients
                    )
                    if any(ex.lower() in ingredients_text for ex in exclude_ingredients):
                        continue

                populated_recipes.append(result)
                if len(populated_recipes) >= count:
                    break
            elif isinstance(result, Exception):
                logger.error(f"Recipe enrichment error: {result}")

        logger.info(f"Successfully populated {len(populated_recipes)} recipes")
        return populated_recipes
