import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "3006"))
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
    SURGE_THRESHOLD: float = float(os.getenv("SURGE_THRESHOLD", "0.8"))
    MAX_SURGE_MULTIPLIER: float = float(os.getenv("MAX_SURGE_MULTIPLIER", "3.0"))

config = Config()
