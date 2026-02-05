"""Prediction service with ML model"""

import logging
import joblib
from typing import Dict, Tuple
import numpy as np

from app.schemas.prediction import PredictionRequest, TimeOfDayEnum, DayTypeEnum
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
            model_data = joblib.load(settings.MODEL_PATH)
            self.model = model_data['model']
            self.scaler = model_data['scaler']
            logger.info(f"Model loaded successfully from {settings.MODEL_PATH}")
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
        try:
            # Encode features
            features_scaled = self._encode_features(request)
            
            # Make prediction (model outputs eta and price_multiplier)
            predictions = self.model.predict(features_scaled)[0]
            
            # Extract predictions
            eta_minutes = int(max(1, min(120, predictions[0])))  # Clamp to [1, 120]
            price_multiplier = float(max(1.0, min(2.0, predictions[1])))  # Clamp to [1.0, 2.0]
            
            logger.info(
                f"Prediction: distance={request.distance_km}km, "
                f"time={request.time_of_day}, day={request.day_type} "
                f"-> ETA={eta_minutes}min, multiplier={price_multiplier}"
            )
            
            return {
                'eta_minutes': eta_minutes,
                'price_multiplier': round(price_multiplier, 2)
            }
            
        except Exception as e:
            logger.error(f"Error making prediction: {str(e)}")
            # Return default values on error instead of crashing
            logger.warning("Returning default values due to prediction error")
            return {
                'eta_minutes': 20,
                'price_multiplier': 1.0
            }


# Global instance
prediction_service = PredictionService()
