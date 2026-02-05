"""Dummy model for local tests when a real model file is unavailable."""

from __future__ import annotations

import numpy as np


class DummyScaler:
    """Identity scaler used for tests."""

    def transform(self, x):
        return x


class DummyModel:
    """Simple deterministic predictor for tests."""

    def predict(self, x):
        x = np.array(x)
        distance = x[:, 0]
        eta = np.clip(distance * 2 + 5, 1, 120)
        price = np.clip(1 + distance * 0.02, 1, 2)
        return np.stack([eta, price], axis=1)
