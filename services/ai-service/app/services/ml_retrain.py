"""Run offline training scripts and hot-reload joblib models into running services."""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

SERVICE_ROOT = Path(__file__).resolve().parents[2]

_SCRIPTS = (
    "training/train_model.py",
    "training/train_accept_model.py",
    "training/train_wait_model.py",
)


def run_training_scripts_and_reload_models(timeout_sec: int = 900) -> dict:
    """
    Run training/*.py in order, then reload Prediction / Accept / Wait weights from disk.

    Scripts generate synthetic data today; swap `training/` + datasets later for real ML ops.
    """
    py = sys.executable
    logs: list[str] = []

    for script in _SCRIPTS:
        cmd = [py, str(SERVICE_ROOT / script)]
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(SERVICE_ROOT),
                capture_output=True,
                text=True,
                timeout=timeout_sec,
            )
        except subprocess.TimeoutExpired:
            return {"ok": False, "detail": f"{script} timed out after {timeout_sec}s"}

        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "")[-1200:]
            logger.error("Training failed %s: %s", script, tail)
            return {
                "ok": False,
                "detail": f"{script} exit {proc.returncode}",
                "stderr_tail": tail,
            }

        logs.append(f"{script}: ok")
        logger.info("Training step OK: %s", script)

    from app.services.accept_service import accept_service
    from app.services.prediction_service import prediction_service
    from app.services.wait_service import wait_service

    pr_ok = prediction_service.reload_model()
    acc_ok = accept_service.reload_model()
    wait_ok = wait_service.reload_model()

    return {
        "ok": True,
        "detail": "; ".join(logs),
        "reload": {"prediction": pr_ok, "accept": acc_ok, "wait": wait_ok},
    }
