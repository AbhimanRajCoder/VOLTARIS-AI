#!/usr/bin/env python3
"""
Pre-train ML models using synthetic data.
Run this script once before starting the server to avoid cold-start training.

Usage:
    python pretrain_models.py

This is also called automatically during Docker image build.
"""
import sys
import os
import logging

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main():
    from app.ml.forecast import forecast_service, _MODEL_DIR

    logger.info("Pre-training forecast models into %s …", _MODEL_DIR)
    metrics = forecast_service.train()
    logger.info(
        "Done — MAE=%.2f kW | RMSE=%.2f kW | R²=%.4f | train=%d rows",
        metrics["mae_kw"], metrics["rmse_kw"], metrics["r2"], metrics["train_rows"],
    )
    print(f"\n✅ Models saved to: {_MODEL_DIR}")


if __name__ == "__main__":
    main()
