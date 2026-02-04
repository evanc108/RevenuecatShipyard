"""Extraction-related Pydantic models.

These schemas define the contract between the API and consumers,
ensuring type safety and validation at runtime.
"""

from enum import StrEnum

from pydantic import BaseModel, Field, HttpUrl


class ExtractionStatus(StrEnum):
    """Current state of an extraction job."""

    PENDING = "pending"
    SCRAPING = "scraping"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    COMPLETE = "complete"
    FAILED = "failed"


class ExtractionMethod(StrEnum):
    """The tier that successfully extracted the recipe."""

    METADATA = "metadata"
    AUDIO = "audio"
    VISION = "vision"
    WEBSITE = "website"


class Ingredient(BaseModel):
    """A single ingredient with structured data."""

    raw_text: str = Field(..., description="Original ingredient text from source")
    name: str = Field(..., description="Ingredient name", examples=["olive oil", "garlic"])
    normalized_name: str = Field(
        ..., description="Standardized name for matching", examples=["olive-oil", "garlic"]
    )
    quantity: float = Field(..., description="Numeric quantity", ge=0)
    unit: str = Field(
        ..., description="Unit of measurement", examples=["cups", "tablespoons", "cloves", ""]
    )
    preparation: str = Field(default="", description="Prep instructions", examples=["minced", "diced"])
    category: str = Field(
        default="", description="Ingredient category", examples=["produce", "dairy", "protein"]
    )
    optional: bool = Field(default=False, description="Whether ingredient is optional")
    sort_order: int = Field(default=0, description="Display order in ingredients list")


class Instruction(BaseModel):
    """A single cooking instruction step."""

    step_number: int = Field(..., description="Step number (1-indexed)", ge=1)
    text: str = Field(..., description="Instruction text")
    time_seconds: int | None = Field(None, description="Duration for this step in seconds", ge=0)
    temperature: str | None = Field(None, description="Temperature if applicable", examples=["350°F", "180°C"])
    tip: str | None = Field(None, description="Optional tip for this step")


class Recipe(BaseModel):
    """Fully extracted recipe with comprehensive structured data.

    This is the output schema that all extraction tiers must produce.
    """

    # Core identification
    title: str = Field(..., description="Recipe title", examples=["Garlic Butter Pasta"])
    description: str = Field(default="", description="Recipe description/summary")
    cuisine: str = Field(default="", description="Cuisine type", examples=["Italian", "Mexican", "Asian"])
    difficulty: str = Field(
        default="", description="Difficulty level", examples=["easy", "medium", "hard"]
    )

    # Servings and timing
    servings: int | None = Field(None, description="Number of servings", ge=1)
    prep_time_minutes: int | None = Field(None, description="Prep time in minutes", ge=0)
    cook_time_minutes: int | None = Field(None, description="Cook time in minutes", ge=0)
    total_time_minutes: int | None = Field(None, description="Total time in minutes", ge=0)

    # Nutrition (optional - may not be extractable)
    calories: int | None = Field(None, description="Calories per serving", ge=0)
    protein_grams: float | None = Field(None, description="Protein per serving in grams", ge=0)
    carbs_grams: float | None = Field(None, description="Carbs per serving in grams", ge=0)
    fat_grams: float | None = Field(None, description="Fat per serving in grams", ge=0)

    # Tags and metadata
    dietary_tags: list[str] = Field(
        default_factory=list,
        description="Dietary tags",
        examples=[["vegetarian", "gluten-free"]],
    )
    keywords: list[str] = Field(
        default_factory=list, description="Search keywords", examples=[["pasta", "quick", "weeknight"]]
    )
    equipment: list[str] = Field(
        default_factory=list,
        description="Required equipment",
        examples=[["pot", "pan", "cutting board"]],
    )

    # Creator information
    creator_name: str = Field(default="", description="Content creator name")
    creator_profile_url: str | None = Field(None, description="Creator's profile URL")

    # Recipe content
    ingredients: list[Ingredient] = Field(
        ..., description="List of ingredients with amounts", min_length=1
    )
    instructions: list[Instruction] = Field(
        ..., description="Step-by-step cooking instructions", min_length=1
    )

    # Extraction metadata
    method_used: ExtractionMethod = Field(..., description="Which extraction tier succeeded")
    source_url: str | None = Field(None, description="Original video URL")
    thumbnail_url: str | None = Field(None, description="Video thumbnail URL")


class ExtractionRequest(BaseModel):
    """Request payload for initiating recipe extraction."""

    url: HttpUrl = Field(..., description="Video URL to extract recipe from")
    user_id: str = Field(..., description="Convex user ID for associating the extraction job")


class ExtractionJobResponse(BaseModel):
    """Response returned immediately after job submission."""

    job_id: str = Field(..., description="Unique identifier for tracking this extraction")
    status: ExtractionStatus = Field(
        default=ExtractionStatus.PENDING, description="Current job status"
    )
    message: str = Field(default="Extraction job queued", description="Human-readable status")
