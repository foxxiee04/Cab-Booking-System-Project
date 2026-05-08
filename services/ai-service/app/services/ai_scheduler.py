"""Periodic RAG re-index and optional ML retrain loops."""

from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.services.ml_retrain import run_training_scripts_and_reload_models
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)


async def start_ai_maintenance_background() -> None:
    if settings.AI_AUTO_RELOAD_RAG_SEC > 0:
        asyncio.create_task(_periodic_rag_reload(settings.AI_AUTO_RELOAD_RAG_SEC))
        logger.info("AI auto RAG reload every %ss", settings.AI_AUTO_RELOAD_RAG_SEC)
    if settings.AI_AUTO_RETRAIN_ENABLED and settings.AI_AUTO_RETRAIN_SEC > 0:
        asyncio.create_task(_periodic_ml_retrain(settings.AI_AUTO_RETRAIN_SEC))
        logger.info(
            "AI auto ML retrain every %ss (AI_AUTO_RETRAIN_ENABLED=true)",
            settings.AI_AUTO_RETRAIN_SEC,
        )


async def _periodic_rag_reload(interval_sec: int) -> None:
    while True:
        await asyncio.sleep(interval_sec)
        try:
            result = await asyncio.to_thread(rag_service.reload_knowledge_from_disk)
            if result.get("ok"):
                logger.info("Periodic RAG reload: %s", result)
            else:
                logger.warning("Periodic RAG reload: %s", result)
        except Exception:
            logger.exception("Periodic RAG reload crashed")


async def _periodic_ml_retrain(interval_sec: int) -> None:
    while True:
        await asyncio.sleep(interval_sec)
        try:
            result = await asyncio.to_thread(run_training_scripts_and_reload_models)
            if result.get("ok"):
                logger.info("Periodic ML retrain: %s", result.get("detail"))
            else:
                logger.warning("Periodic ML retrain: %s", result)
        except Exception:
            logger.exception("Periodic ML retrain crashed")
