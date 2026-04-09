"""
Train Accept Probability model (GradientBoostingClassifier)

Features (15 total after encoding):
  - eta_minutes          : log1p normalised
  - distance_km          : log1p normalised  
  - fare_estimate_k      : fare / 1000, log1p normalised
  - surge_multiplier     : raw (1.0–3.0)
  - driver_accept_rate   : raw (0–1)
  - driver_cancel_rate   : raw (0–1)
  - hour_sin             : sin(2π*h/24) cyclical
  - hour_cos             : cos(2π*h/24) cyclical
  - zone_A               : one-hot pickup zone A
  - zone_B               : one-hot pickup zone B
  - zone_C               : one-hot pickup zone C
  - demand_score         : ordinal (0=LOW,1=MEDIUM,2=HIGH)
  - avail_driver_log     : log1p(available_driver_count)
  - fare_per_eta         : fare_k / max(1, eta_minutes)
  - demand_supply_ratio  : demand_score / max(1, avail_driver_log)

Label:  accept = 1  if driver accepts the offer, else 0

Synthetic label generation rules (realistic patterns):
  P_base = 0.75
  - eta < 5  min  → +0.15  (driver loves short trips)
  - eta > 15 min  → -0.20
  - accept_rate   → shifted by (accept_rate - 0.75)
  - cancel_rate   → -1.5 * cancel_rate
  - demand HIGH   → +0.10
  - demand LOW    → -0.05
  - fare > 80k    → +0.08
  - fare < 30k    → -0.10
  → sigmoid(P_sum) → Bernoulli sample
"""

import numpy as np
import pandas as pd
import joblib
import logging
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

ACCEPT_MODEL_PATH = "app/models/accept_model.joblib"
ACCEPT_MODEL_VERSION = "accept-gbm-v1"
N_SAMPLES = 5000


def _zone_from_idx(idx: int) -> str:
    """Assign pickup zone by index bucket for variety."""
    r = idx % 4
    return ["A", "B", "C", "D"][r]


def _demand_from_hour(hour: int, surge: float) -> str:
    is_rush = (7 <= hour <= 9) or (17 <= hour <= 20)
    if is_rush and surge >= 1.2:
        return "HIGH"
    if is_rush or surge >= 1.1:
        return "MEDIUM"
    return "LOW"


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def generate_synthetic_data(n: int = N_SAMPLES) -> pd.DataFrame:
    logger.info(f"Generating {n} synthetic accept-probability samples…")
    np.random.seed(7)

    # ── Raw features ───────────────────────────────────────────────────────
    eta = np.random.uniform(1, 30, n)
    distance = np.random.uniform(0.5, 30, n)
    fare = np.random.uniform(15_000, 300_000, n)
    surge = np.random.uniform(1.0, 2.0, n)
    accept_rate = np.random.beta(8, 2, n)          # skewed high (realistic drivers)
    cancel_rate = np.random.beta(1.5, 10, n)       # skewed low
    hour = np.random.randint(0, 24, n)
    zones = np.array([_zone_from_idx(i) for i in range(n)])
    demand = np.array([_demand_from_hour(int(hour[i]), float(surge[i])) for i in range(n)])
    avail_drivers = np.random.randint(1, 20, n)

    # ── Synthetic label ────────────────────────────────────────────────────
    logit = np.zeros(n)
    logit += 0.75

    logit += np.where(eta < 5, 0.15, 0.0)
    logit += np.where(eta > 15, -0.20, 0.0)
    logit += (accept_rate - 0.75)
    logit -= 1.5 * cancel_rate
    logit += np.where(demand == "HIGH", 0.10, np.where(demand == "LOW", -0.05, 0.0))
    logit += np.where(fare > 80_000, 0.08, np.where(fare < 30_000, -0.10, 0.0))

    p_accept = np.vectorize(_sigmoid)(logit)
    accept = np.random.binomial(1, p_accept, n)

    df = pd.DataFrame({
        "eta_minutes": eta,
        "distance_km": distance,
        "fare_estimate": fare,
        "surge_multiplier": surge,
        "driver_accept_rate": accept_rate,
        "driver_cancel_rate": cancel_rate,
        "hour_of_day": hour,
        "pickup_zone": zones,
        "demand_level": demand,
        "available_driver_count": avail_drivers,
        "accept": accept,
    })

    logger.info(f"Class balance: {accept.mean():.2%} accept rate in synthetic data")
    return df


def encode_features(df: pd.DataFrame) -> np.ndarray:
    """Build 15-column feature matrix."""
    fare_k = df["fare_estimate"] / 1_000

    hour_sin = np.sin(2 * np.pi * df["hour_of_day"] / 24)
    hour_cos = np.cos(2 * np.pi * df["hour_of_day"] / 24)

    zone_A = (df["pickup_zone"] == "A").astype(float)
    zone_B = (df["pickup_zone"] == "B").astype(float)
    zone_C = (df["pickup_zone"] == "C").astype(float)

    demand_map = {"LOW": 0.0, "MEDIUM": 1.0, "HIGH": 2.0}
    demand_score = df["demand_level"].map(demand_map).fillna(1.0).values

    avail_log = np.log1p(df["available_driver_count"])

    fare_per_eta = np.log1p(fare_k) / np.maximum(1, df["eta_minutes"])
    demand_supply_ratio = demand_score / np.maximum(1, avail_log)

    X = np.column_stack([
        np.log1p(df["eta_minutes"]),
        np.log1p(df["distance_km"]),
        np.log1p(fare_k),
        df["surge_multiplier"],
        df["driver_accept_rate"],
        df["driver_cancel_rate"],
        hour_sin,
        hour_cos,
        zone_A,
        zone_B,
        zone_C,
        demand_score,
        avail_log,
        fare_per_eta,
        demand_supply_ratio,
    ])
    return X


def train_model(df: pd.DataFrame, output_path: str = ACCEPT_MODEL_PATH) -> None:
    X = encode_features(df)
    y = df["accept"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    logger.info(f"Training GBM accept model  —  train={len(X_train)}, test={len(X_test)}")

    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=20,
        random_state=42,
    )
    clf.fit(X_train, y_train)

    auc = roc_auc_score(y_test, clf.predict_proba(X_test)[:, 1])
    logger.info(f"Test ROC-AUC: {auc:.4f}")
    logger.info("\n" + classification_report(y_test, clf.predict(X_test)))

    feature_names = [
        "eta_log", "distance_log", "fare_k_log", "surge",
        "accept_rate", "cancel_rate",
        "hour_sin", "hour_cos",
        "zone_A", "zone_B", "zone_C",
        "demand_score", "avail_log",
        "fare_per_eta", "demand_supply_ratio",
    ]

    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(
        {
            "model": clf,
            "feature_names": feature_names,
            "model_version": ACCEPT_MODEL_VERSION,
            "p_clamp_min": 0.3,
            "p_clamp_max": 1.2,
        },
        output_path,
    )
    logger.info(f"Accept model saved → {output_path}")


def main() -> None:
    logger.info("=== Accept Probability Model Training ===")
    df = generate_synthetic_data(N_SAMPLES)
    train_model(df)
    logger.info("✅ Done")


if __name__ == "__main__":
    main()
