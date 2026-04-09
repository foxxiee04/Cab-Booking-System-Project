"""Accept probability prediction service (GradientBoostingClassifier)"""

import logging
import time
from pathlib import Path
from typing import List

import joblib
import numpy as np

from app.schemas.accept_prediction import (
    AcceptPredictionBatchRequest,
    AcceptPredictionBatchResponse,
    AcceptPredictionContext,
    AcceptPredictionDriverInput,
    AcceptPredictionDriverResult,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

# Demand level ordinal mapping
_DEMAND_ORDINAL = {"LOW": 0.0, "MEDIUM": 1.0, "HIGH": 2.0}


def _encode_single(
    ctx: AcceptPredictionContext,
    drv: AcceptPredictionDriverInput,
) -> np.ndarray:
    """
    Build a 15-feature vector for one (context, driver) pair.

    Features:
      0  eta_log              log1p(eta_minutes)
      1  distance_log         log1p(distance_km)
      2  fare_k_log           log1p(fare_estimate / 1000)
      3  surge                surge_multiplier (raw)
      4  accept_rate          driver_accept_rate (raw)
      5  cancel_rate          driver_cancel_rate (raw)
      6  hour_sin             sin(2π * hour / 24)
      7  hour_cos             cos(2π * hour / 24)
      8  zone_A               pickup_zone == 'A'
      9  zone_B               pickup_zone == 'B'
      10 zone_C               pickup_zone == 'C'
      11 demand_score         ordinal demand level (0/1/2)
      12 avail_log            log1p(available_driver_count)
      13 fare_per_eta         log1p(fare_k) / max(1, eta_minutes)
      14 demand_supply_ratio  demand_score / max(1, avail_log)
    """
    fare_k = ctx.fare_estimate / 1_000
    h = ctx.hour_of_day
    hour_sin = np.sin(2 * np.pi * h / 24)
    hour_cos = np.cos(2 * np.pi * h / 24)

    zone = ctx.pickup_zone.upper()
    zone_A = 1.0 if zone == "A" else 0.0
    zone_B = 1.0 if zone == "B" else 0.0
    zone_C = 1.0 if zone == "C" else 0.0

    demand_score = _DEMAND_ORDINAL.get(ctx.demand_level.upper(), 1.0)
    avail_log = np.log1p(max(0, ctx.available_driver_count))

    eta_clamped = max(0.0, drv.eta_minutes)
    fare_per_eta = np.log1p(fare_k) / max(1.0, eta_clamped)
    demand_supply_ratio = demand_score / max(1.0, avail_log)

    return np.array([
        np.log1p(eta_clamped),
        np.log1p(max(0.0, ctx.distance_km)),
        np.log1p(max(0.0, fare_k)),
        ctx.surge_multiplier,
        drv.driver_accept_rate,
        drv.driver_cancel_rate,
        hour_sin,
        hour_cos,
        zone_A,
        zone_B,
        zone_C,
        demand_score,
        avail_log,
        fare_per_eta,
        demand_supply_ratio,
    ], dtype=float)


class AcceptPredictionService:
    """Service that loads the GBM accept model and serves batch predictions."""

    def __init__(self) -> None:
        self._model = None
        self._model_version = "accept-gbm-v1"
        self._p_clamp_min = 0.3
        self._p_clamp_max = 1.2
        self._load_model()

    def _load_model(self) -> None:
        model_path = Path(settings.ACCEPT_MODEL_PATH)
        if not model_path.is_absolute():
            service_root = Path(__file__).resolve().parents[2]
            model_path = service_root / model_path

        try:
            data = joblib.load(model_path)
            self._model = data["model"]
            self._model_version = data.get("model_version", self._model_version)
            self._p_clamp_min = data.get("p_clamp_min", 0.3)
            self._p_clamp_max = data.get("p_clamp_max", 1.2)
            logger.info(f"Accept model loaded: {model_path} ({self._model_version})")
        except FileNotFoundError:
            logger.warning(
                f"Accept model not found at {model_path}. "
                "Service will return fallback p_accept=1.0 until model is available."
            )
        except Exception as exc:
            logger.error(f"Failed to load accept model: {exc}")

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    def predict_batch(
        self, request: AcceptPredictionBatchRequest
    ) -> AcceptPredictionBatchResponse:
        start_ms = time.perf_counter()

        if not self.is_ready:
            # Return neutral fallback (multiplier=1 → no effect on score)
            fallback = [
                AcceptPredictionDriverResult(
                    driver_id=d.driver_id,
                    p_accept=1.0,
                    p_accept_clamped=1.0,
                    confidence=0.0,
                )
                for d in request.drivers
            ]
            return AcceptPredictionBatchResponse(
                results=fallback,
                model_version=self._model_version,
                reason_code="AI_FALLBACK",
                inference_ms=0,
            )

        ctx = request.context
        results: List[AcceptPredictionDriverResult] = []

        # Build feature matrix (one row per driver) for vectorised predict_proba
        feature_rows = np.array([
            _encode_single(ctx, drv) for drv in request.drivers
        ])

        proba_matrix = self._model.predict_proba(feature_rows)  # shape (N, 2)
        p_accept_raw: np.ndarray = proba_matrix[:, 1]           # P(class=1)

        for i, drv in enumerate(request.drivers):
            p = float(p_accept_raw[i])
            clamped = max(self._p_clamp_min, min(self._p_clamp_max, p))
            # Confidence = distance from decision boundary (0.5)
            confidence = float(abs(p - 0.5) * 2)  # [0,1], 1=very confident

            results.append(
                AcceptPredictionDriverResult(
                    driver_id=drv.driver_id,
                    p_accept=round(p, 4),
                    p_accept_clamped=round(clamped, 4),
                    confidence=round(confidence, 3),
                )
            )

        inference_ms = int((time.perf_counter() - start_ms) * 1000)
        logger.debug(
            f"Accept batch predict: {len(request.drivers)} drivers, "
            f"inference={inference_ms}ms, zone={ctx.pickup_zone}, demand={ctx.demand_level}"
        )

        return AcceptPredictionBatchResponse(
            results=results,
            model_version=self._model_version,
            reason_code="AI_OK",
            inference_ms=inference_ms,
        )


# Global singleton — loaded once at startup
accept_service = AcceptPredictionService()
