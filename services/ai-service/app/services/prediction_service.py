"""Prediction service with ML model"""

import logging
import joblib
import time
from pathlib import Path
from typing import Dict
import numpy as np

from app.schemas.prediction import (
    ConfidenceLevelEnum,
    DayTypeEnum,
    DemandLevelEnum,
    PredictionRequest,
    TimeOfDayEnum,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class PredictionService:
    """Service for making predictions using trained ML model"""
    
    def __init__(self):
        """Initialize service and load model"""
        self.model = None
        self.scaler = None
        self.load_model()
    
    def load_model(self):
        """Load trained model from disk"""
        try:
            model_path = Path(settings.MODEL_PATH)
            if not model_path.is_absolute():
                service_root = Path(__file__).resolve().parents[2]
                model_path = service_root / model_path

            model_data = joblib.load(model_path)
            self.model = model_data['model']
            self.scaler = model_data['scaler']
            logger.info(f"Model loaded successfully from {model_path}")
        except FileNotFoundError:
            logger.error(f"Model file not found at {settings.MODEL_PATH}")
            raise RuntimeError(f"Model file not found at {settings.MODEL_PATH}")
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            raise RuntimeError(f"Error loading model: {str(e)}")
    
    def _encode_features(self, request: PredictionRequest) -> np.ndarray:
        """
        Encode request features for model input
        
        Features:
        - distance_km (continuous)
        - time_of_day (categorical: 0=OFF_PEAK, 1=RUSH_HOUR)
        - day_type (categorical: 0=WEEKDAY, 1=WEEKEND)
        
        Returns:
            numpy array of shape (1, 3) with scaled features
        """
        # One-hot encode categorical features
        time_of_day_encoded = 1 if request.time_of_day == TimeOfDayEnum.RUSH_HOUR else 0
        day_type_encoded = 1 if request.day_type == DayTypeEnum.WEEKEND else 0
        
        # Create feature array: [distance_km, time_of_day, day_type]
        features = np.array([
            request.distance_km,
            time_of_day_encoded,
            day_type_encoded
        ]).reshape(1, -1)
        
        # Scale features using fitted scaler
        features_scaled = self.scaler.transform(features)
        
        return features_scaled
    
    def predict(self, request: PredictionRequest) -> Dict[str, float]:
        """
        Make prediction for ETA and price multiplier
        
        Args:
            request: PredictionRequest with distance, time_of_day, day_type
            
        Returns:
            Dictionary with eta_minutes and price_multiplier
        """
        start_time = time.perf_counter()
        try:
            # Encode features
            features_scaled = self._encode_features(request)
            
            # Make prediction (model outputs eta and price_multiplier)
            predictions = self.model.predict(features_scaled)[0]
            
            # Extract predictions
            eta_minutes = int(max(1, min(120, predictions[0])))  # Clamp to [1, 120]
            price_multiplier = float(max(1.0, min(2.0, predictions[1])))  # Clamp to [1.0, 2.0]
            confidence_score = self._compute_confidence_score(request, eta_minutes, price_multiplier)
            bounded_radius = self._compute_recommended_radius(request, eta_minutes, price_multiplier)
            bounded_surge_hint = float(
                max(settings.SUGGESTED_SURGE_MIN, min(settings.SUGGESTED_SURGE_MAX, round(price_multiplier, 2)))
            )
            inference_ms = int((time.perf_counter() - start_time) * 1000)
            
            logger.info(
                f"Prediction: distance={request.distance_km}km, "
                f"time={request.time_of_day}, day={request.day_type} "
                f"-> ETA={eta_minutes}min, multiplier={price_multiplier}"
            )
            
            return {
                'eta_minutes': eta_minutes,
                'price_multiplier': round(price_multiplier, 2),
                'recommended_driver_radius_km': bounded_radius,
                'surge_hint': bounded_surge_hint,
                'confidence_score': confidence_score,
                'reason_code': 'AI_OK',
                'model_version': settings.MODEL_VERSION,
                'feature_version': settings.FEATURE_VERSION,
                'inference_ms': inference_ms,
                'insights': self._build_operational_insights(
                    request,
                    eta_minutes=eta_minutes,
                    price_multiplier=round(price_multiplier, 2),
                ),
            }
            
        except Exception as e:
            logger.error(f"Error making prediction: {str(e)}")
            raise RuntimeError(f"Prediction inference failed: {str(e)}") from e

    def _compute_confidence_score(
        self,
        request: PredictionRequest,
        eta_minutes: int,
        price_multiplier: float,
    ) -> float:
        score = 0.75

        if request.distance_km <= 8:
            score += 0.15
        elif request.distance_km > 20:
            score -= 0.15

        if request.time_of_day == TimeOfDayEnum.RUSH_HOUR:
            score -= 0.05

        if eta_minutes > 45:
            score -= 0.10

        if price_multiplier >= 1.6:
            score -= 0.08

        return round(max(0.05, min(0.99, score)), 2)

    def _compute_recommended_radius(
        self,
        request: PredictionRequest,
        eta_minutes: int,
        price_multiplier: float,
    ) -> float:
        radius = 2.5

        if request.time_of_day == TimeOfDayEnum.RUSH_HOUR:
            radius += 0.7

        if request.day_type == DayTypeEnum.WEEKEND:
            radius += 0.3

        if request.distance_km >= 12:
            radius += 0.4

        if eta_minutes >= 30:
            radius += 0.6

        if price_multiplier >= 1.4:
            radius += 0.4

        return round(
            max(settings.SUGGESTED_RADIUS_MIN_KM, min(settings.SUGGESTED_RADIUS_MAX_KM, radius)),
            1,
        )

    def _build_operational_insights(
        self,
        request: PredictionRequest,
        eta_minutes: int,
        price_multiplier: float,
    ) -> Dict[str, object]:
        demand_score = 0

        if request.time_of_day == TimeOfDayEnum.RUSH_HOUR:
          demand_score += 2
        if request.day_type == DayTypeEnum.WEEKEND:
          demand_score += 1
        if request.distance_km >= 12:
          demand_score += 1
        if price_multiplier >= 1.3:
          demand_score += 1

        if demand_score >= 4:
            demand_level = DemandLevelEnum.HIGH
        elif demand_score >= 2:
            demand_level = DemandLevelEnum.MEDIUM
        else:
            demand_level = DemandLevelEnum.LOW

        if request.distance_km <= 8 and request.time_of_day == TimeOfDayEnum.OFF_PEAK:
            eta_confidence = ConfidenceLevelEnum.HIGH
        elif request.distance_km <= 20:
            eta_confidence = ConfidenceLevelEnum.MEDIUM
        else:
            eta_confidence = ConfidenceLevelEnum.LOW

        recommended_radius = 2.5
        if demand_level == DemandLevelEnum.MEDIUM:
            recommended_radius = 4.0
        elif demand_level == DemandLevelEnum.HIGH:
            recommended_radius = 6.0

        if eta_minutes >= 35:
            recommended_radius = min(recommended_radius + 1.0, 10.0)

        if price_multiplier >= 1.5:
            surge_reason = 'Demand is significantly above normal supply expectations'
        elif request.time_of_day == TimeOfDayEnum.RUSH_HOUR:
            surge_reason = 'Rush hour demand is increasing ETA and fare pressure'
        elif request.day_type == DayTypeEnum.WEEKEND:
            surge_reason = 'Weekend travel pattern is raising pickup competition'
        else:
            surge_reason = 'Normal traffic and supply conditions'

        return {
            'demand_level': demand_level.value,
            'eta_confidence': eta_confidence.value,
            'recommended_driver_radius_km': round(recommended_radius, 1),
            'surge_reason': surge_reason,
        }


# Global instance
prediction_service = PredictionService()
