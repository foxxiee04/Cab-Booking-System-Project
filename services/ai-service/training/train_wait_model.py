"""
Train Wait Time Prediction model (GradientBoostingRegressor with Huber loss)

Definition:
  WaitTime = minutes from ride.finding_driver_requested → ride.accepted

Features (12 total):
  0  demand_score         ordinal {0=LOW, 1=MEDIUM, 2=HIGH}
  1  active_booking_log   log1p(active_booking_count)
  2  avail_driver_log     log1p(available_driver_count)
  3  hour_sin             sin(2π * h / 24)
  4  hour_cos             cos(2π * h / 24)
  5  dow_sin              sin(2π * d / 7)
  6  dow_cos              cos(2π * d / 7)
  7  surge_multiplier     raw [1.0–3.0]
  8  avg_accept_rate      raw [0–1]
  9  historical_wait_p50  minutes [1–15]
  10 zone_A               one-hot pickup zone A (central)
  11 demand_supply_ratio  demand_score − avail_driver_log (engineered)

Label:
  wait_time_minutes ∈ [1, 15]

Synthetic label rule:
  base = 3.0
  + 3.5 if demand HIGH,  +1.5 if MEDIUM
  − 0.5 * log1p(available_drivers)
  + 0.3 * log1p(active_bookings)
  + 2.0 if rush hour (7–9 or 17–20)
  + 2.0 * (1 − avg_accept_rate)        # low accept rate → more rounds
  − 0.8 * (surge − 1.0)               # surge attracts drivers
  = 0.6 * base + 0.4 * historical_wait # blend with history
  + N(0, 0.8) noise
  → clamp([1, 15])
"""

import numpy as np
import pandas as pd
import joblib
import logging
from pathlib import Path
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

WAIT_MODEL_PATH = "app/models/wait_model.joblib"
WAIT_MODEL_VERSION = "wait-gbr-v1"
N_SAMPLES = 6000

_DEMAND_ORDINAL = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def _zone_from_idx(idx: int) -> str:
    return ["A", "B", "C", "D"][idx % 4]


def _demand_from_score(score: int) -> str:
    return ["LOW", "MEDIUM", "HIGH"][score]


def generate_synthetic_data(n: int = N_SAMPLES) -> pd.DataFrame:
    logger.info(f"Generating {n} synthetic wait-time samples…")
    np.random.seed(13)

    # ── Raw features ───────────────────────────────────────────────────────
    demands = np.random.choice([0, 1, 2], size=n, p=[0.3, 0.45, 0.25])  # ordinal
    active_bookings = np.random.randint(0, 80, n).astype(float)
    available_drivers = np.random.randint(0, 40, n).astype(float)
    hours = np.random.randint(0, 24, n)
    days = np.random.randint(0, 7, n)
    surges = np.random.uniform(1.0, 2.0, n)
    accept_rates = np.random.uniform(0.5, 1.0, n)
    zones = np.array([_zone_from_idx(i) for i in range(n)])
    historical_p50 = np.random.uniform(2.0, 10.0, n)

    # ── Engineered features ────────────────────────────────────────────────
    is_rush = ((hours >= 7) & (hours <= 9)) | ((hours >= 17) & (hours <= 20))
    avail_log = np.log1p(available_drivers)
    active_log = np.log1p(active_bookings)
    hour_sin = np.sin(2 * np.pi * hours / 24)
    hour_cos = np.cos(2 * np.pi * hours / 24)
    dow_sin = np.sin(2 * np.pi * days / 7)
    dow_cos = np.cos(2 * np.pi * days / 7)
    demand_supply_ratio = demands.astype(float) - avail_log
    zone_A = (zones == "A").astype(float)

    # ── Synthetic wait time ────────────────────────────────────────────────
    base = np.full(n, 3.0)
    base += np.where(demands == 2, 3.5, np.where(demands == 1, 1.5, 0.0))
    base -= 0.5 * avail_log
    base += 0.3 * active_log
    base += 2.0 * is_rush.astype(float)
    base += 2.0 * (1.0 - accept_rates)
    base -= 0.8 * (surges - 1.0)
    base = 0.6 * base + 0.4 * historical_p50
    base += np.random.normal(0, 0.8, n)
    wait_time = np.clip(base, 1.0, 15.0)

    df = pd.DataFrame({
        "demand_score":         demands.astype(float),
        "active_booking_log":   active_log,
        "avail_driver_log":     avail_log,
        "hour_sin":             hour_sin,
        "hour_cos":             hour_cos,
        "dow_sin":              dow_sin,
        "dow_cos":              dow_cos,
        "surge_multiplier":     surges,
        "avg_accept_rate":      accept_rates,
        "historical_wait_p50":  historical_p50,
        "zone_A":              zone_A,
        "demand_supply_ratio":  demand_supply_ratio,
        "wait_time_minutes":    wait_time,
    })

    logger.info(f"Generated {len(df)} samples — wait_time: "
                f"mean={wait_time.mean():.2f} std={wait_time.std():.2f} "
                f"min={wait_time.min():.2f} max={wait_time.max():.2f}")
    return df


def train_model(df: pd.DataFrame, output_path: str = WAIT_MODEL_PATH) -> None:
    feature_cols = [
        "demand_score", "active_booking_log", "avail_driver_log",
        "hour_sin", "hour_cos", "dow_sin", "dow_cos",
        "surge_multiplier", "avg_accept_rate", "historical_wait_p50",
        "zone_A", "demand_supply_ratio",
    ]
    X = df[feature_cols].values
    y = df["wait_time_minutes"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=13)
    logger.info(f"Train={len(X_train)}  Test={len(X_test)}")

    model = GradientBoostingRegressor(
        loss="huber",
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        min_samples_leaf=10,
        random_state=13,
    )
    logger.info("Training GradientBoostingRegressor (Huber loss)…")
    model.fit(X_train, y_train)

    # ── Evaluation ────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    y_pred = np.clip(y_pred, 1.0, 15.0)
    mae = mean_absolute_error(y_test, y_pred)
    mape = mean_absolute_percentage_error(y_test, y_pred) * 100
    logger.info(f"MAE={mae:.3f} min  MAPE={mape:.1f}%")

    # ── Save ──────────────────────────────────────────────────────────────
    service_root = Path(__file__).resolve().parents[1]
    abs_path = service_root / output_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "model": model,
        "feature_cols": feature_cols,
        "model_version": WAIT_MODEL_VERSION,
        "mae": round(mae, 3),
        "mape": round(mape, 1),
    }
    joblib.dump(payload, abs_path)
    size_kb = abs_path.stat().st_size // 1024
    logger.info(f"Saved {abs_path}  ({size_kb} KB)")


if __name__ == "__main__":
    df = generate_synthetic_data()
    train_model(df)
    logger.info("Wait-time model training complete.")
