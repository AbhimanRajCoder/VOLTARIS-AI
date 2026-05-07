import pandas as pd
import json
import os
import logging
import time
import argparse
import uuid
import psycopg2
from psycopg2.extras import execute_values
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

def get_db_connection():
    """Get a raw psycopg2 connection through SQLAlchemy's engine.
    This avoids URI-parsing issues when the password contains special chars."""
    engine = settings.sqlalchemy_engine
    return engine.raw_connection()

def seed_zones(conn, data_dir):
    logger.info("Seeding zones...")
    start_time = time.time()
    with open(os.path.join(data_dir, "zone_config.json"), "r") as f:
        config = json.load(f)
    
    zones_data = config.get("zones", {})
    rows = []
    for zone_id, info in zones_data.items():
        rows.append((
            zone_id,
            info["name"],
            float(info["transformer_capacity_kw"])
        ))
    
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO zones (zone_id, zone_name, transformer_capacity_kw) VALUES %s ON CONFLICT DO NOTHING",
            rows
        )
    conn.commit()
    logger.info(f"Seeded {len(rows)} zones in {time.time() - start_time:.2f}s.")

def seed_demand_forecast(conn, data_dir, limit=None):
    logger.info("Seeding zone demand forecasts...")
    start_time = time.time()
    df = pd.read_csv(os.path.join(data_dir, "ev_demand_timeseries.csv"))
    
    if limit:
        df = df.head(limit)
    
    total_rows = len(df)
    rows = []
    for _, row in df.iterrows():
        rows.append((
            str(uuid.uuid4()),
            row["zone_id"],
            pd.to_datetime(row["timestamp"]),
            float(row["total_load_kw"]),
            float(row["ev_share_pct"]),
            float(row["total_load_kw"]) * 0.9,
            float(row["total_load_kw"]) * 1.1,
            "v1.0"
        ))
    
    with conn.cursor() as cur:
        # Using execute_values for high-speed bulk insert
        query = """
            INSERT INTO zone_demand_forecast 
            (id, zone_id, timestamp, predicted_kw, ev_share_pct, confidence_lo, confidence_hi, model_version) 
            VALUES %s ON CONFLICT DO NOTHING
        """
        
        # Batch processing with progress logging
        page_size = 5000
        for i in range(0, len(rows), page_size):
            batch = rows[i : i + page_size]
            execute_values(cur, query, batch, page_size=page_size)
            elapsed = time.time() - start_time
            logger.info(f"Inserting zone_demand_forecast... {min(i + page_size, total_rows)}/{total_rows} rows ({elapsed:.1f}s elapsed)")
    
    conn.commit()
    logger.info(f"Demand forecast seeding complete in {time.time() - start_time:.2f}s.")

def seed_infra_candidates(conn, data_dir):
    logger.info("Seeding infra site candidates...")
    start_time = time.time()
    df = pd.read_csv(os.path.join(data_dir, "candidate_sites.csv"))
    
    rows = []
    for _, row in df.iterrows():
        rows.append((
            row["candidate_id"],
            float(row["lat"]),
            float(row["lon"]),
            row.get("ward_name", "Unknown"),
            float(row["demand_score"]),
            float(row["charger_gap_score"]),
            float(row["transformer_score"]),
            float(row.get("road_score", 0.5)),
            int(row["composite_rank"]),
            float(row["composite_score"]),
            row["nearest_transformer_id"],
            int(row["existing_chargers_500m"])
        ))
    
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO infra_site_candidate 
            (site_id, lat, lon, ward_name, demand_score, gap_score, transformer_score, access_score, composite_rank, composite_score, nearest_transformer_id, existing_chargers_500m) 
            VALUES %s 
            ON CONFLICT (site_id) DO UPDATE SET 
                ward_name = EXCLUDED.ward_name,
                demand_score = EXCLUDED.demand_score,
                gap_score = EXCLUDED.gap_score,
                transformer_score = EXCLUDED.transformer_score,
                access_score = EXCLUDED.access_score,
                composite_rank = EXCLUDED.composite_rank,
                composite_score = EXCLUDED.composite_score
            """,
            rows
        )
    conn.commit()
    logger.info(f"Infra candidate seeding complete in {time.time() - start_time:.2f}s.")

def seed_grid_alerts(conn, data_dir):
    logger.info("Seeding grid alerts from transformer load...")
    start_time = time.time()
    df = pd.read_csv(os.path.join(data_dir, "transformer_load.csv"))
    
    alerts_df = df[df["load_pct"] > 85].copy()
    alerts_df["severity"] = alerts_df["load_pct"].apply(lambda x: "CRITICAL" if x >= 95 else "WARNING")
    
    rows = []
    for _, row in alerts_df.iterrows():
        rows.append((
            str(uuid.uuid4()),
            row["zone_id"],
            row["severity"],
            pd.to_datetime(row["timestamp"]),
            f"Transformer {row['transformer_id']} load at {row['load_pct']:.1f}%",
            "Reduce EV charging load" if row["severity"] == "CRITICAL" else "Monitor load closely"
        ))
    
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO grid_alert (alert_id, zone_id, severity, triggered_at, message, recommended_action) 
            VALUES %s ON CONFLICT DO NOTHING
            """,
            rows
        )
    conn.commit()
    logger.info(f"Grid alert seeding complete in {time.time() - start_time:.2f}s.")

def main():
    parser = argparse.ArgumentParser(description="Seed GridWise database.")
    parser.add_argument("--limit", type=int, help="Limit number of rows for large tables (dev mode).")
    parser.add_argument("--quick", action="store_true", help="Quick mode: seed only necessary data for Phase 2.")
    args = parser.parse_args()

    data_dir = settings.SEED_DATA_DIR
    conn = None
    try:
        conn = get_db_connection()
        
        # Always seed zones first
        seed_zones(conn, data_dir)
        
        # Handle flags
        forecast_limit = args.limit
        if args.quick:
            forecast_limit = 5000
            logger.info("Quick mode enabled: limiting forecast data to 5000 rows.")
        
        seed_demand_forecast(conn, data_dir, limit=forecast_limit)
        seed_infra_candidates(conn, data_dir)
        seed_grid_alerts(conn, data_dir)
        
        logger.info("Database seeding successfully completed!")
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
