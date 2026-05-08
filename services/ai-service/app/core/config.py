"""AI Service configuration"""

from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""

    # Service
    APP_NAME: str = "AI Prediction Service"
    APP_VERSION: str = "1.1.0"
    APP_DESCRIPTION: str = "AI service for ETA and price multiplier prediction"
    MODEL_VERSION: str = "eta-rf-v2"
    FEATURE_VERSION: str = "features-v1"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # Model paths
    MODEL_PATH: str = "app/models/eta_price_model.joblib"
    ACCEPT_MODEL_PATH: str = "app/models/accept_model.joblib"
    WAIT_MODEL_PATH: str = "app/models/wait_model.joblib"

    # Bounded suggestion defaults (downstream services still clamp again)
    SUGGESTED_RADIUS_MIN_KM: float = 2.0
    SUGGESTED_RADIUS_MAX_KM: float = 5.0
    SUGGESTED_SURGE_MIN: float = 1.0
    SUGGESTED_SURGE_MAX: float = 2.0

    # Background maintenance (0 = disabled)
    AI_AUTO_RELOAD_RAG_SEC: int = 0
    AI_AUTO_RETRAIN_SEC: int = 0
    AI_AUTO_RETRAIN_ENABLED: bool = False
    # Bearer token for POST /api/internal/refresh — empty = endpoint returns 404
    AI_INTERNAL_TOKEN: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
