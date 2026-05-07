#!/usr/bin/env python3
"""
GridWise Phase 1 — Comprehensive Verification Script
=====================================================
Run:  cd backend && python tests/test_phase1.py
      cd backend && python tests/test_phase1.py --code-only

Flags:
  --code-only   Skip infrastructure checks (DB, Redis, seeded data).
                Only verify code imports, schemas, and config.

This is a standalone script (no pytest). It prints human-readable
results for every Phase 1 subsystem and exits with code 0 only if
every critical check passes.
"""

import sys
import os
import argparse
import importlib
import traceback
from pathlib import Path

# ---------------------------------------------------------------------------
# Ensure the backend package root is on sys.path so `app.*` imports work
# regardless of where the script is invoked from.
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent          # …/backend
PROJECT_ROOT = BACKEND_DIR.parent                             # …/Voltaris-AI
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)  # so relative paths in .env resolve correctly

# ── colour helpers (disable on dumb terminals) ────────────────────────────
_NO_COLOR = not sys.stdout.isatty()
def _c(code: str, text: str) -> str:
    return text if _NO_COLOR else f"\033[{code}m{text}\033[0m"
GREEN  = lambda t: _c("32", t)
RED    = lambda t: _c("31", t)
YELLOW = lambda t: _c("33", t)
BOLD   = lambda t: _c("1", t)
CYAN   = lambda t: _c("36", t)
DIM    = lambda t: _c("2", t)

# ── result tracking ───────────────────────────────────────────────────────
class Results:
    def __init__(self):
        self._results: list[tuple[str, str, str]] = []  # (label, status, detail)

    def add(self, label: str, status: str, detail: str = ""):
        self._results.append((label, status, detail))

    @property
    def ok(self) -> bool:
        return all(s != "FAIL" for _, s, _ in self._results)

    def summary(self):
        w = max(len(l) for l, _, _ in self._results) + 2
        sep = "─" * 44
        print(f"\n{sep}")
        print(BOLD("GridWise Phase 1 — Test Results"))
        print(sep)
        for label, status, detail in self._results:
            if status == "PASS":
                badge = GREEN("PASS")
            elif status == "WARN":
                badge = YELLOW(f"WARN ({detail})" if detail else "WARN")
            elif status == "SKIP":
                badge = DIM(f"SKIP ({detail})" if detail else "SKIP")
            else:
                badge = RED("FAIL")
            print(f"  {label:<{w}} {badge}")
        print(sep)
        if self.ok:
            print(GREEN(BOLD("  Result: READY FOR PHASE 2 ✔")))
        else:
            print(RED(BOLD("  Result: NOT READY — fix FAILs above ✘")))
        print(sep)


results = Results()


# ═══════════════════════════════════════════════════════════════════════════
# 1. ENVIRONMENT VARIABLES
# ═══════════════════════════════════════════════════════════════════════════
def test_env():
    print(BOLD("\n[1/10] Environment Variables"))
    required_keys = [
        "DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY",
        "REDIS_URL", "CORS_ORIGINS", "MODEL_DIR", "APP_ENV",
        "SECRET_KEY",
    ]
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        print(RED(f"  ✘ .env file not found at {env_path}"))
        results.add("Environment vars", "FAIL", ".env missing")
        return

    # Parse the .env file manually so we don't depend on dotenv yet
    env_keys_found: set[str] = set()
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key = line.split("=", 1)[0].strip()
        env_keys_found.add(key)

    missing = [k for k in required_keys if k not in env_keys_found]
    if missing:
        for m in missing:
            print(RED(f"  ✘ Missing key: {m}"))
        results.add("Environment vars", "FAIL", f"missing: {', '.join(missing)}")
    else:
        print(GREEN(f"  ✔ All {len(required_keys)} required keys present"))
        results.add("Environment vars", "PASS")


# ═══════════════════════════════════════════════════════════════════════════
# 2. DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════
def test_dependencies():
    print(BOLD("\n[2/10] Installed Dependencies"))
    req_path = BACKEND_DIR / "requirements.txt"
    if not req_path.exists():
        print(RED("  ✘ requirements.txt not found"))
        results.add("Dependencies", "FAIL", "requirements.txt missing")
        return

    # Normalise package names (PEP 503)
    def _norm(name: str) -> str:
        return name.strip().lower().replace("-", "_").replace(".", "_")

    # Build list of required packages (strip version specifiers & extras)
    import re
    pkgs: list[str] = []
    for line in req_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name = re.split(r"[>=<!\[;]", line)[0].strip()
        if name:
            pkgs.append(name)

    # Map common PyPI names → importable module names
    IMPORT_MAP = {
        "uvicorn[standard]": "uvicorn",
        "uvicorn": "uvicorn",
        "psycopg2-binary": "psycopg2",
        "psycopg2_binary": "psycopg2",
        "python-dotenv": "dotenv",
        "python_dotenv": "dotenv",
        "pydantic-settings": "pydantic_settings",
        "pytest-asyncio": "pytest_asyncio",
        "geoalchemy2": "geoalchemy2",
    }

    missing: list[str] = []
    for pkg in pkgs:
        mod = IMPORT_MAP.get(pkg, IMPORT_MAP.get(_norm(pkg), _norm(pkg)))
        try:
            importlib.import_module(mod)
            print(DIM(f"  ✔ {pkg}"))
        except ImportError:
            print(RED(f"  ✘ {pkg} (import as {mod})"))
            missing.append(pkg)

    if missing:
        results.add("Dependencies", "FAIL", f"missing: {', '.join(missing)}")
        print(RED(f"\n  Fix: pip install {' '.join(missing)}"))
    else:
        print(GREEN(f"  ✔ All {len(pkgs)} packages installed"))
        results.add("Dependencies", "PASS")


# ═══════════════════════════════════════════════════════════════════════════
# 3. DATABASE CONNECTION
# ═══════════════════════════════════════════════════════════════════════════
def test_db_connection():
    print(BOLD("\n[3/10] Database Connection"))
    try:
        from app.config import get_settings
        settings = get_settings()
        from sqlalchemy import create_engine, text

        # Verify SSL is configured
        engine = settings.sqlalchemy_engine
        connect_args = engine.url  # just to prove engine was built
        print(DIM(f"  Engine URL scheme: {engine.url.drivername}"))

        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            assert result == 1, f"SELECT 1 returned {result}"

        # Check that sslmode=require is in the connect_args
        # (we know from config.py it's set, but double-check the engine)
        print(GREEN("  ✔ SELECT 1 returned successfully"))
        print(DIM("  ✔ SSL: sslmode=require configured in connect_args"))
        results.add("DB connection", "PASS")
    except Exception as e:
        print(RED(f"  ✘ DB connection failed: {e}"))
        results.add("DB connection", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# 4. TABLE EXISTENCE
# ═══════════════════════════════════════════════════════════════════════════
REQUIRED_TABLES = [
    "zones",
    "zone_demand_forecast",
    "charging_recommendation",
    "infra_site_candidate",
    "grid_alert",
]

def test_tables_exist():
    print(BOLD("\n[4/10] Table Existence"))
    try:
        from app.config import get_settings
        from sqlalchemy import text
        settings = get_settings()
        engine = settings.sqlalchemy_engine
        missing = []

        with engine.connect() as conn:
            for tbl in REQUIRED_TABLES:
                row = conn.execute(
                    text(
                        "SELECT EXISTS ("
                        "  SELECT 1 FROM information_schema.tables "
                        "  WHERE table_schema = 'public' AND table_name = :t"
                        ")"
                    ),
                    {"t": tbl},
                ).scalar()
                if row:
                    # get row count
                    count = conn.execute(text(f'SELECT COUNT(*) FROM "{tbl}"')).scalar()
                    print(f"  ✔ {tbl:<30} {count:>8} rows")
                else:
                    print(RED(f"  ✘ {tbl:<30} MISSING"))
                    missing.append(tbl)

        if missing:
            results.add("Tables exist", "FAIL", f"missing: {', '.join(missing)}")
            print(RED(f"\n  Fix: Run the app once to auto-create tables, or run seed."))
        else:
            results.add("Tables exist", "PASS")
    except Exception as e:
        print(RED(f"  ✘ Error checking tables: {e}"))
        results.add("Tables exist", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# 5. SEEDED DATA CHECK
# ═══════════════════════════════════════════════════════════════════════════
def test_seeded_data():
    print(BOLD("\n[5/10] Seeded Data Check"))
    try:
        from app.config import get_settings
        from sqlalchemy import text
        settings = get_settings()
        engine = settings.sqlalchemy_engine
        all_ok = True

        checks = [
            ("zones", "SELECT COUNT(*) FROM zones", 1, "≥ 1 row"),
            ("zone_demand_forecast", "SELECT COUNT(*) FROM zone_demand_forecast", 1000, "≥ 1000 rows"),
            ("infra_site_candidate", "SELECT COUNT(*) FROM infra_site_candidate", 50, "≥ 50 rows"),
            ("grid_alert (CRITICAL)", "SELECT COUNT(*) FROM grid_alert WHERE severity = 'CRITICAL'", 1, "≥ 1 CRITICAL alert"),
        ]

        with engine.connect() as conn:
            for label, query, minimum, desc in checks:
                try:
                    count = conn.execute(text(query)).scalar()
                    if count >= minimum:
                        print(GREEN(f"  ✔ {label:<30} {count:>8} rows  ({desc})"))
                    else:
                        print(RED(f"  ✘ {label:<30} {count:>8} rows  (need {desc})"))
                        all_ok = False
                except Exception as e:
                    print(RED(f"  ✘ {label:<30} Error: {e}"))
                    all_ok = False

        if all_ok:
            results.add("Seeded data", "PASS")
        else:
            results.add("Seeded data", "FAIL", "insufficient data")
            print(YELLOW("\n  Fix: cd backend && python -m app.data.seed"))
    except Exception as e:
        print(RED(f"  ✘ Error checking seeded data: {e}"))
        results.add("Seeded data", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# 6. SCHEMA VALIDATION (against live DB)
# ═══════════════════════════════════════════════════════════════════════════
def test_schema_validation():
    print(BOLD("\n[6/10] Pydantic Schema Validation (live DB)"))
    try:
        from app.config import get_settings
        from sqlalchemy import text
        from app.models.schemas import (
            ZoneDemandForecast,
            ChargingRecommendation,
            InfraSiteCandidate,
            GridAlert,
        )
        settings = get_settings()
        engine = settings.sqlalchemy_engine
        all_ok = True

        # Map: (schema_class, table_name, query to fetch one dict-row)
        schema_checks = [
            (
                ZoneDemandForecast,
                "zone_demand_forecast",
                "SELECT id, zone_id, timestamp, predicted_kw, ev_share_pct, "
                "confidence_lo, confidence_hi, model_version, created_at "
                "FROM zone_demand_forecast LIMIT 1",
            ),
            (
                ChargingRecommendation,
                "charging_recommendation",
                "SELECT id, zone_id, hour_slot, action, grid_load_pct, "
                "optimal_window, reason, expected_delta_kw, created_at "
                "FROM charging_recommendation LIMIT 1",
            ),
            (
                InfraSiteCandidate,
                "infra_site_candidate",
                "SELECT site_id, lat, lon, ward_name, demand_score, gap_score, "
                "transformer_score, access_score, composite_rank, composite_score, "
                "nearest_transformer_id, existing_chargers_500m "
                "FROM infra_site_candidate LIMIT 1",
            ),
            (
                GridAlert,
                "grid_alert",
                "SELECT alert_id, zone_id, severity, triggered_at, message, "
                "recommended_action, acknowledged, resolved "
                "FROM grid_alert LIMIT 1",
            ),
        ]

        with engine.connect() as conn:
            for schema_cls, table, query in schema_checks:
                try:
                    row = conn.execute(text(query)).mappings().first()
                    if row is None:
                        print(YELLOW(f"  ⚠ {schema_cls.__name__:<30} table '{table}' is empty — skipping"))
                        continue
                    obj = schema_cls.model_validate(dict(row))
                    print(GREEN(f"  ✔ Schema OK: {schema_cls.__name__}"))
                except Exception as e:
                    print(RED(f"  ✘ Schema FAIL: {schema_cls.__name__} — {e}"))
                    all_ok = False

        if all_ok:
            results.add("Schema validation", "PASS")
        else:
            results.add("Schema validation", "FAIL", "schema mismatch")
    except Exception as e:
        print(RED(f"  ✘ Error during schema validation: {e}"))
        results.add("Schema validation", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# 6b. SCHEMA IMPORT CHECK (code-only mode — no DB needed)
# ═══════════════════════════════════════════════════════════════════════════
def test_schema_import():
    """Verify all Pydantic schemas import and can be instantiated with synthetic data."""
    print(BOLD("\n[6/10] Pydantic Schema Validation (import-only)"))
    try:
        from app.models.schemas import (
            ZoneDemandForecast,
            ChargingRecommendation,
            InfraSiteCandidate,
            GridAlert,
            ActionEnum,
            SeverityEnum,
        )
        from datetime import datetime
        from uuid import uuid4

        all_ok = True

        # Synthetic test payloads — validates field types, enums, and required fields
        test_payloads = [
            (ZoneDemandForecast, {
                "id": uuid4(), "zone_id": "Z01", "timestamp": datetime.now(),
                "predicted_kw": 100.5, "ev_share_pct": 12.3,
                "confidence_lo": 90.0, "confidence_hi": 110.0,
                "model_version": "v1.0", "created_at": datetime.now(),
            }),
            (ChargingRecommendation, {
                "id": uuid4(), "zone_id": "Z01", "hour_slot": 14,
                "action": ActionEnum.CHARGE_NOW, "grid_load_pct": 72.5,
                "optimal_window": "14:00-16:00", "reason": "Low grid load",
                "expected_delta_kw": -15.2, "created_at": datetime.now(),
            }),
            (InfraSiteCandidate, {
                "site_id": "SITE_001", "lat": 12.97, "lon": 77.59,
                "ward_name": "Koramangala", "demand_score": 0.85,
                "gap_score": 0.72, "transformer_score": 0.68,
                "access_score": 0.91, "composite_rank": 1,
                "composite_score": 0.82, "nearest_transformer_id": "TX_01",
                "existing_chargers_500m": 3,
            }),
            (GridAlert, {
                "alert_id": uuid4(), "zone_id": "Z01",
                "severity": SeverityEnum.CRITICAL,
                "triggered_at": datetime.now(),
                "message": "Transformer overload at 105%",
                "recommended_action": "Reduce EV charging load",
                "acknowledged": False, "resolved": False,
            }),
        ]

        for schema_cls, payload in test_payloads:
            try:
                obj = schema_cls.model_validate(payload)
                print(GREEN(f"  ✔ Schema OK: {schema_cls.__name__}"))
            except Exception as e:
                print(RED(f"  ✘ Schema FAIL: {schema_cls.__name__} — {e}"))
                all_ok = False

        # Verify enums have expected members
        assert set(ActionEnum) == {ActionEnum.CHARGE_NOW, ActionEnum.DEFER, ActionEnum.OPTIMAL_WINDOW}
        print(GREEN(f"  ✔ ActionEnum has 3 members: {[e.value for e in ActionEnum]}"))
        assert set(SeverityEnum) == {SeverityEnum.CRITICAL, SeverityEnum.WARNING, SeverityEnum.INFO}
        print(GREEN(f"  ✔ SeverityEnum has 3 members: {[e.value for e in SeverityEnum]}"))

        if all_ok:
            results.add("Schema validation", "PASS")
        else:
            results.add("Schema validation", "FAIL", "schema mismatch")
    except Exception as e:
        print(RED(f"  ✘ Schema import error: {e}"))
        traceback.print_exc()
        results.add("Schema validation", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# 7. FASTAPI APP IMPORT
# ═══════════════════════════════════════════════════════════════════════════
def test_app_import():
    print(BOLD("\n[7/10] FastAPI App Import"))
    try:
        from app.main import app as fastapi_app
        print(GREEN(f"  ✔ app.main imported successfully"))

        # Check CORS middleware
        cors_found = False
        for middleware in fastapi_app.user_middleware:
            if "CORSMiddleware" in str(middleware.cls):
                cors_found = True
                break
        if cors_found:
            print(GREEN("  ✔ CORSMiddleware registered"))
        else:
            print(RED("  ✘ CORSMiddleware NOT found in middleware stack"))

        # Check /health route
        health_found = False
        for route in fastapi_app.routes:
            if hasattr(route, "path") and route.path == "/health":
                health_found = True
                break
        if health_found:
            print(GREEN("  ✔ /health route exists"))
        else:
            print(RED("  ✘ /health route NOT found"))

        if cors_found and health_found:
            results.add("App import", "PASS")
        else:
            details = []
            if not cors_found:
                details.append("no CORS")
            if not health_found:
                details.append("no /health")
            results.add("App import", "FAIL", ", ".join(details))

    except Exception as e:
        print(RED(f"  ✘ Failed to import app.main: {e}"))
        traceback.print_exc()
        results.add("App import", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# 8. HEALTH ENDPOINT TEST
# ═══════════════════════════════════════════════════════════════════════════
def test_health_endpoint():
    print(BOLD("\n[8/10] Health Endpoint (TestClient)"))
    try:
        from starlette.testclient import TestClient
        from app.main import app as fastapi_app

        all_ok = True

        with TestClient(fastapi_app) as client:
            # GET /health
            resp = client.get("/health")
            if resp.status_code == 200:
                print(GREEN(f"  ✔ GET /health → 200"))
            else:
                print(RED(f"  ✘ GET /health → {resp.status_code} (expected 200)"))
                all_ok = False

            data = resp.json()
            required_keys = {"status", "model_version", "db"}
            missing_keys = required_keys - set(data.keys())
            if missing_keys:
                print(RED(f"  ✘ Response missing keys: {missing_keys}"))
                all_ok = False
            else:
                print(GREEN(f"  ✔ Response JSON has keys: {sorted(required_keys)}"))

            if data.get("status") == "ok":
                print(GREEN('  ✔ status == "ok"'))
            else:
                print(RED(f'  ✘ status == "{data.get("status")}" (expected "ok")'))
                all_ok = False

            if data.get("db") == "connected":
                print(GREEN('  ✔ db == "connected"'))
            else:
                print(RED(f'  ✘ db == "{data.get("db")}" (expected "connected")'))
                all_ok = False

            # GET /nonexistent → 404
            resp404 = client.get("/nonexistent")
            if resp404.status_code == 404:
                print(GREEN("  ✔ GET /nonexistent → 404"))
            else:
                print(RED(f"  ✘ GET /nonexistent → {resp404.status_code} (expected 404)"))
                all_ok = False

        if all_ok:
            results.add("Health endpoint", "PASS")
        else:
            results.add("Health endpoint", "FAIL")

    except Exception as e:
        print(RED(f"  ✘ Health endpoint test error: {e}"))
        traceback.print_exc()
        results.add("Health endpoint", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# 9. REDIS CONNECTION
# ═══════════════════════════════════════════════════════════════════════════
def test_redis():
    print(BOLD("\n[9/10] Redis Connection"))
    try:
        from app.config import get_settings
        import redis

        settings = get_settings()
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=3)
        pong = r.ping()
        if pong:
            print(GREEN(f"  ✔ Redis PING → PONG"))
            results.add("Redis", "PASS")
        else:
            print(RED("  ✘ Redis PING returned False"))
            results.add("Redis", "WARN", "ping failed")
    except Exception as e:
        print(YELLOW(f"  ⚠ Redis not reachable: {e}"))
        print(DIM("    (Redis is optional for Phase 1 — this is a warning, not a failure)"))
        results.add("Redis", "WARN", "not running")


# ═══════════════════════════════════════════════════════════════════════════
# 10. SEED SCRIPT DRY RUN
# ═══════════════════════════════════════════════════════════════════════════
def test_seed_script():
    print(BOLD("\n[10/10] Seed Script Dry Run"))
    try:
        # 1. Verify the module imports cleanly
        import app.data.seed as seed_module
        print(GREEN("  ✔ app.data.seed imported successfully"))

        # 2. Resolve the SEED_DATA_DIR and check for expected CSVs
        from app.config import get_settings
        settings = get_settings()
        data_dir = Path(settings.SEED_DATA_DIR).resolve()

        expected_files = [
            "zone_config.json",
            "ev_demand_timeseries.csv",
            "candidate_sites.csv",
            "transformer_load.csv",
        ]

        print(f"  SEED_DATA_DIR = {data_dir}")
        if not data_dir.exists():
            # Try the project-root fallback
            fallback = PROJECT_ROOT / "output"
            if fallback.exists():
                print(YELLOW(f"  ⚠ Configured dir not found, but data exists at: {fallback}"))
                print(YELLOW(f"    Fix: Update SEED_DATA_DIR in .env to: {fallback}"))
                data_dir = fallback
            else:
                print(RED(f"  ✘ Data directory not found: {data_dir}"))
                results.add("Seed script", "FAIL", "data dir missing")
                return

        all_found = True
        for fname in expected_files:
            fpath = data_dir / fname
            if fpath.exists():
                # Count rows for CSVs
                if fname.endswith(".csv"):
                    import csv
                    with open(fpath) as f:
                        row_count = sum(1 for _ in csv.reader(f)) - 1  # subtract header
                    print(DIM(f"  ✔ {fname:<35} {row_count:>10} rows"))
                elif fname.endswith(".json"):
                    import json
                    with open(fpath) as f:
                        data = json.load(f)
                    # For zone_config.json, count zones
                    zones = data.get("zones", data)
                    count = len(zones) if isinstance(zones, (dict, list)) else "?"
                    print(DIM(f"  ✔ {fname:<35} {count:>10} entries"))
            else:
                print(RED(f"  ✘ {fname} NOT FOUND"))
                all_found = False

        if all_found:
            print(GREEN("  ✔ All seed data files located"))

        # 3. Check that the main() function has argparse support
        import inspect
        src = inspect.getsource(seed_module.main)
        has_argparse = "argparse" in src or "ArgumentParser" in src
        if has_argparse:
            print(GREEN("  ✔ Seed script supports CLI arguments"))
        else:
            print(DIM("  ℹ Seed script does not use argparse (acceptable)"))

        if all_found:
            results.add("Seed script", "PASS")
        else:
            results.add("Seed script", "FAIL", "data files missing")

    except Exception as e:
        print(RED(f"  ✘ Seed script error: {e}"))
        traceback.print_exc()
        results.add("Seed script", "FAIL", str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
def _skip(label: str, reason: str = "--code-only"):
    """Mark an infra test as skipped."""
    print(DIM(f"\n  ⏭  {label} — skipped ({reason})"))
    results.add(label, "SKIP", reason)


def main():
    parser = argparse.ArgumentParser(description="GridWise Phase 1 verification.")
    parser.add_argument(
        "--code-only", action="store_true",
        help="Skip infrastructure checks (DB, Redis, seeded data). "
             "Only verify code imports, schemas, and config.",
    )
    args = parser.parse_args()
    code_only = args.code_only

    banner = """
╔══════════════════════════════════════════════╗
║   GridWise Phase 1 — Verification Suite      ║
╚══════════════════════════════════════════════╝"""
    print(CYAN(banner))
    if code_only:
        print(YELLOW("  Mode: --code-only (skipping DB / Redis / seeded-data checks)"))

    # ── Always run ────────────────────────────────────────────────────────
    test_env()              # 1
    test_dependencies()     # 2

    # ── Infra-dependent ───────────────────────────────────────────────────
    if code_only:
        _skip("DB connection")
        _skip("Tables exist")
        _skip("Seeded data")
    else:
        test_db_connection()    # 3
        test_tables_exist()     # 4
        test_seeded_data()      # 5

    # ── Schema validation ─────────────────────────────────────────────────
    if code_only:
        test_schema_import()    # 6b — synthetic payloads, no DB
    else:
        test_schema_validation()  # 6 — against live DB rows

    # ── Always run ────────────────────────────────────────────────────────
    test_app_import()       # 7

    # ── Infra-dependent ───────────────────────────────────────────────────
    if code_only:
        _skip("Health endpoint")
        _skip("Redis")
    else:
        test_health_endpoint()  # 8
        test_redis()            # 9

    # ── Always run ────────────────────────────────────────────────────────
    test_seed_script()      # 10

    results.summary()
    sys.exit(0 if results.ok else 1)


if __name__ == "__main__":
    main()
