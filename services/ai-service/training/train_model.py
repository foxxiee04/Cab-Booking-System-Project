"""Train ML model for ETA and price multiplier prediction"""

import numpy as np
import pandas as pd
import joblib
import logging
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.multioutput import MultiOutputRegressor
from sklearn.ensemble import RandomForestRegressor
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def generate_synthetic_data(n_samples: int = 1000) -> pd.DataFrame:
    """
    Generate synthetic training data for ETA and price multiplier prediction
    
    Features:
    - distance_km: 2-50 km
    - time_of_day: 0 (OFF_PEAK) or 1 (RUSH_HOUR)
    - day_type: 0 (WEEKDAY) or 1 (WEEKEND)
    
    Targets:
    - eta_minutes: based on distance and time_of_day
    - price_multiplier: based on time_of_day and day_type
    
    Args:
        n_samples: Number of training samples to generate
        
    Returns:
        DataFrame with features and targets
    """
    logger.info(f"Generating {n_samples} synthetic training samples...")
    
    # Generate features
    np.random.seed(42)
    
    distance_km = np.random.uniform(2, 50, n_samples)
    time_of_day = np.random.randint(0, 2, n_samples)  # 0: OFF_PEAK, 1: RUSH_HOUR
    day_type = np.random.randint(0, 2, n_samples)  # 0: WEEKDAY, 1: WEEKEND
    
    # Create features dataframe
    df = pd.DataFrame({
        'distance_km': distance_km,
        'time_of_day': time_of_day,
        'day_type': day_type
    })
    
    # Generate targets based on features (with realistic patterns)
    
    # ETA calculation:
    # - Base speed: 30 km/h off-peak, 20 km/h rush hour
    # - ETA = distance / speed (in minutes)
    base_speed = np.where(df['time_of_day'] == 1, 20, 30)  # Rush hour slower
    df['eta_minutes'] = (df['distance_km'] / base_speed * 60).astype(int)
    df['eta_minutes'] = df['eta_minutes'].clip(1, 120)
    
    # Price multiplier calculation:
    # - Base multiplier: 1.0
    # - Add 0.10-0.15 for rush hour (time_of_day == 1)
    # - Add 0.05 for weekend (day_type == 1, lower demand)
    df['price_multiplier'] = 1.0
    df.loc[df['time_of_day'] == 1, 'price_multiplier'] += np.random.uniform(0.10, 0.15, (df['time_of_day'] == 1).sum())
    df.loc[df['day_type'] == 1, 'price_multiplier'] -= 0.05  # Weekend discount
    df['price_multiplier'] = df['price_multiplier'].clip(1.0, 2.0)
    
    logger.info(f"Data shape: {df.shape}")
    logger.info(f"\nData sample:\n{df.head(10)}")
    logger.info(f"\nData statistics:\n{df.describe()}")
    
    return df


def train_model(
    df: pd.DataFrame,
    model_output_path: str = "app/models/eta_price_model.joblib"
):
    """
    Train Multi-Output Regression model
    
    Args:
        df: DataFrame with features and targets
        model_output_path: Path to save the trained model
    """
    logger.info("Preparing data for training...")
    
    # Separate features and targets
    X = df[['distance_km', 'time_of_day', 'day_type']].values
    y_eta = df['eta_minutes'].values.reshape(-1, 1)
    y_multiplier = df['price_multiplier'].values.reshape(-1, 1)
    y = np.hstack([y_eta, y_multiplier])
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    logger.info(f"Training set size: {X_train.shape[0]}")
    logger.info(f"Test set size: {X_test.shape[0]}")
    
    # Scale features
    logger.info("Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Multi-Output Regression model
    logger.info("Training Random Forest model...")
    model = MultiOutputRegressor(
        RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
    )
    model.fit(X_train_scaled, y_train)
    
    # Evaluate model
    logger.info("Evaluating model...")
    train_score = model.score(X_train_scaled, y_train)
    test_score = model.score(X_test_scaled, y_test)
    
    logger.info(f"Train R² score: {train_score:.4f}")
    logger.info(f"Test R² score: {test_score:.4f}")
    
    # Make some sample predictions
    logger.info("\nSample predictions:")
    sample_indices = [0, 100, 500, 999]
    for idx in sample_indices:
        if idx < len(X_test):
            X_sample = X_test_scaled[idx:idx+1]
            pred = model.predict(X_sample)[0]
            actual = y_test[idx]
            logger.info(
                f"  Distance: {X_test[idx][0]:.1f}km, "
                f"Time: {int(X_test[idx][1])}, "
                f"Day: {int(X_test[idx][2])} -> "
                f"ETA: {int(pred[0])}min (actual: {int(actual[0])}min), "
                f"Multiplier: {pred[1]:.2f} (actual: {actual[1]:.2f})"
            )
    
    # Save model and scaler
    logger.info(f"\nSaving model to {model_output_path}...")
    output_dir = Path(model_output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    joblib.dump({
        'model': model,
        'scaler': scaler,
        'feature_names': ['distance_km', 'time_of_day', 'day_type'],
        'output_names': ['eta_minutes', 'price_multiplier']
    }, model_output_path)
    
    logger.info(f"Model saved successfully to {model_output_path}")
    
    return model, scaler


def main():
    """Main training pipeline"""
    logger.info("Starting AI Model Training Pipeline...")
    
    # Generate synthetic data
    df = generate_synthetic_data(n_samples=1000)
    
    # Train model
    model, scaler = train_model(df)
    
    logger.info("\n✅ Training completed successfully!")


if __name__ == "__main__":
    main()
