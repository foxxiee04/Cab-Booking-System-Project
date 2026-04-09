"""Wait time prediction service (GradientBoostingRegressor — Huber loss)"""

import logging
import time
from pathlib import Path
from typing import Dict

import joblib
import numpy as np

from app.schemas.wait_prediction import (
    WaitTimePredictionRequest,
    WaitTimePredictionResponse,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

_DEMAND_ORDINAL: Dict[str, float] = {"LOW": 0.0, "MEDIUM": 1.0, "HIGH": 2.0}

# Feature order must match training/train_wait_model.py
_FEATURE_COLS = [
    "demand_score",
    "active_booking_log",
    "avail_driver_log",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "surge_multiplier",
    "avg_accept_rate",
    "historical_wait_p50",
    "zone_A",
    "demand_supply_ratio",
]


def _encode_features(req: WaitTimePredictionRequest) -> np.ndarray:
    """Build a 12-feature row vector from the request."""
    demand_score = _DEMAND_ORDINAL.get(req.demand_level.upper(), 1.0)
    active_log = np.log1p(max(0, req.active_booking_count))
    avail_log = np.log1p(max(0, req.available_driver_count))

    h = req.hour_of_day
    d = req.day_of_week
    hour_sin = np.sin(2 * np.pi * h / 24)
    hour_cos = np.cos(2 * np.pi * h / 24)
    dow_sin = np.sin(2 * np.pi * d / 7)
    dow_cos = np.cos(2 * np.pi * d / 7)

    zone_A = 1.0 if req.pickup_zone.upper() == "A" else 0.0
    demand_supply_ratio = demand_score - avail_log

    return np.array([[
        demand_score,
        active_log,
        avail_log,
        hour_sin,
        hour_cos,
        dow_sin,
        dow_cos,
        req.surge_multiplier,
        req.avg_accept_rate,
        req.historical_wait_p50,
        zone_A,
        demand_supply_ratio,
    ]])


def _heuristic_wait(req: WaitTimePredictionRequest) -> float:
    """Simple fallback: demand/supply ratio × base wait."""
    demand_score = _DEMAND_ORDINAL.get(req.demand_level.upper(), 1.0)
    avail = max(1, req.available_driver_count)
    base = 3.0 + demand_score * 1.5
    base -= 0.4 * np.log1p(avail)
    base += 1.5 * (1.0 - req.avg_accept_rate)
    return float(np.clip(base, 1.0, 15.0))


class WaitTimeService:
    """Load + serve the wait-time GBR model."""

    def __init__(self) -> None:
        self.model = None
        self.model_version = "heuristic-v1"
        self._load_model()

    def _load_model(self) -> None:
        try:
            model_path = Path(settings.WAIT_MODEL_PATH)
            if not model_path.is_absolute():
                service_root = Path(__file__).resolve().parents[2]
                model_path = service_root / model_path

            payload = joblib.load(model_path)
            self.model = payload["model"]
            self.model_version = payload.get("model_version", "wait-gbr-v1")
            logger.info(f"Wait-time model loaded from {model_path} (version={self.model_version})")
        except Exception as exc:
            logger.warning(f"Wait-time model not loaded ({exc}) — heuristic fallback active")
            self.model = None

    def predict(self, req: WaitTimePredictionRequest) -> WaitTimePredictionResponse:
        start = time.perf_counter()

        if self.model is None:
            wait = _heuristic_wait(req)
            return WaitTimePredictionResponse(
                wait_time_minutes=round(wait, 1),
                confidence=0.40,
                model_version="heuristic-v1",
                reason_code="AI_FALLBACK",
                inference_ms=int((time.perf_counter() - start) * 1000),
            )

        try:
            x = _encode_features(req)

            # GBR final prediction (aggregates all stages correctly)
            raw_pred = float(self.model.predict(x)[0])
            clamped = float(np.clip(raw_pred, 1.0, 15.0))

            # Confidence: higher when prediction is in comfortable middle range [2, 10],
            # lower near boundaries (1 or 15) and for extreme demand/supply conditions.
            dist_from_boundary = min(clamped - 1.0, 15.0 - clamped) / 7.0  # 0→0, 7→1
            demand_factor = 1.0 - abs(_DEMAND_ORDINAL.get(req.demand_level.upper(), 1.0) - 1.0) * 0.1
            avail_factor = min(1.0, np.log1p(req.available_driver_count) / 4.0)
            confidence = float(np.clip(
                0.45 + 0.25 * dist_from_boundary + 0.15 * avail_factor + 0.15 * demand_factor,
                0.0, 1.0,
            ))

            return WaitTimePredictionResponse(
                wait_time_minutes=round(clamped, 1),
                confidence=round(confidence, 3),
                model_version=self.model_version,
                reason_code="AI_OK",
                inference_ms=int((time.perf_counter() - start) * 1000),
            )
        except Exception as exc:
            logger.warning(f"Wait-time model prediction failed: {exc} — using heuristic")
            wait = _heuristic_wait(req)
            return WaitTimePredictionResponse(
                wait_time_minutes=round(wait, 1),
                confidence=0.35,
                model_version="heuristic-v1",
                reason_code="AI_MODEL_ERROR",
                inference_ms=int((time.perf_counter() - start) * 1000),
            )


# Global singleton loaded at import time
wait_service = WaitTimeService()
