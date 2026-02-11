"""Application configuration using Pydantic Settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # OpenAI Configuration (GPT + Whisper)
    openai_api_key: str

    # Convex Configuration (for posting recipes)
    convex_url: str = ""

    # API Key for authenticating client requests
    api_key: str = ""

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Processing Configuration
    max_video_duration_seconds: int = 600

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.debug


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
