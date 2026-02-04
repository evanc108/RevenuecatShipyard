"""Base extractor interface and shared types."""

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from app.schemas import Recipe

# Progress callback type: (message, percent) -> None
# percent is 0.0 to 1.0
ProgressCallback = Callable[[str, float], Awaitable[None]]


@dataclass
class ExtractionResult:
    """Result from an extraction attempt.

    Attributes:
        success: Whether extraction succeeded
        recipe: The extracted recipe (if successful)
        should_fallback: Whether to try the next tier
        error: Error message if failed
    """

    success: bool
    recipe: Recipe | None = None
    should_fallback: bool = False
    error: str | None = None


class BaseExtractor(ABC):
    """Abstract base class for extraction tiers.

    Each tier implements this interface and decides whether
    to allow fallback to the next tier on failure.
    """

    def __init__(self, progress_callback: ProgressCallback | None = None) -> None:
        """Initialize extractor with optional progress callback.

        Args:
            progress_callback: Async function to report progress updates
        """
        self._progress_callback = progress_callback

    async def _report_progress(self, message: str, percent: float) -> None:
        """Report progress to the callback if one is registered.

        Args:
            message: Human-readable progress message
            percent: Progress percentage (0.0 to 1.0)
        """
        if self._progress_callback:
            await self._progress_callback(message, percent)

    @abstractmethod
    async def extract(self, url: str) -> ExtractionResult:
        """Attempt to extract recipe from the given URL.

        Args:
            url: Video URL to extract from

        Returns:
            ExtractionResult with recipe data or fallback signal
        """
        ...

    @property
    @abstractmethod
    def tier_name(self) -> str:
        """Human-readable name for this extraction tier."""
        ...
