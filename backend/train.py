#!/usr/bin/env python3
"""
GridWise Model Training Script
Usage: python train.py
"""

import sys
import os
import logging

# Ensure app imports work
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    print("\n╔══════════════════════════════════════════════╗")
    print("║   GridWise — XGBoost Model Training          ║")
    print("╚══════════════════════════════════════════════╝\n")

    from app.ml.forecast import forecast_service
    from app.config import get_settings

    settings = get_settings()

    logger.info("Connecting to Supabase …")
    logger.info("MODEL_DIR = %s", settings.MODEL_DIR)

    metrics = forecast_service.train()

    print("\n────────────────────────────────────────────")
    print("  Training Results")
    print("────────────────────────────────────────────")
    print(f"  MAE:           {metrics['mae_kw']:.2f} kW")
    print(f"  RMSE:          {metrics['rmse_kw']:.2f} kW")
    print(f"  R²:            {metrics['r2']:.4f}")
    print(f"  Train rows:    {metrics['train_rows']}")
    print(f"  Test rows:     {metrics['test_rows']}")
    print("────────────────────────────────────────────")
    print(f"  Models saved to: {settings.MODEL_DIR}/")
    print("  Training complete. Run the API to use the model.")
    print("────────────────────────────────────────────\n")


if __name__ == "__main__":
    main()
