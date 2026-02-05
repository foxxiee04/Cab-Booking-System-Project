"""AI Service configuration"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Service
    APP_NAME: str = "AI Prediction Service"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "AI service for ETA and price multiplier prediction"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # Model path
    MODEL_PATH: str = "app/models/eta_price_model.joblib"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
