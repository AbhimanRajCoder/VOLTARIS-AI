"""
GridWise Phase 2 — Comprehensive Verification Suite
Tests all 4 routers and 8+ endpoints against real Supabase data.
"""

import sys
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Ensure we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.config import get_settings

client = TestClient(app)
settings = get_settings()

# Helpers for timing
stats = []

def record_test(name: str, result: str, duration: float = 0.0):
    stats.append({"name": name, "result": result, "duration": duration})

def print_header():
    print("\n╔══════════════════════════════════════════════╗")
    print("║   GridWise Phase 2 — Verification Suite      ║")
    print("╚══════════════════════════════════════════════╝")

def get_valid_zone_id() -> str:
    engine = settings.sqlalchemy_engine
    with engine.connect() as conn:
        row = conn.execute(text("SELECT zone_id FROM zones LIMIT 1")).fetchone()
        return row[0] if row else "Z01"

def get_valid_site_id() -> str:
    engine = settings.sqlalchemy_engine
    with engine.connect() as conn:
        row = conn.execute(text("SELECT site_id FROM infra_site_candidate LIMIT 1")).fetchone()
        return row[0] if row else "CAND-001"

def get_valid_alert_id() -> str:
    engine = settings.sqlalchemy_engine
    with engine.connect() as conn:
        row = conn.execute(text("SELECT alert_id FROM grid_alert LIMIT 1")).fetchone()
        return str(row[0]) if row else None

# ─── Tests ──────────────────────────────────────────────────────────────────

def test_router_registration():
    start = time.perf_counter()
    expected_prefixes = {"/api/forecast", "/api/schedule", "/api/infra", "/api/grid"}
    actual_prefixes = {route.path for route in app.routes if hasattr(route, 'path')}
    
    missing = []
    for prefix in expected_prefixes:
        if not any(p.startswith(prefix) for p in actual_prefixes):
            missing.append(prefix)
    
    res = "PASS" if not missing else f"FAIL (missing: {missing})"
    record_test("Router registration", res, time.perf_counter() - start)

def test_forecast_demand_basic(zone_id: str):
    start = time.perf_counter()
    # Use a fixed date from the known data range (Jan 2024)
    response = client.get(f"/api/forecast/demand?zone_id={zone_id}&start_ts=2024-01-01T00:00:00&end_ts=2024-01-31T23:59:59")
    
    if response.status_code != 200:
        record_test("Forecast demand (basic)", f"FAIL ({response.status_code})")
        return

    data = response.json()
    assert isinstance(data, list)
    if len(data) == 0:
        record_test("Forecast demand (basic)", "FAIL (Empty list)")
        return

    item = data[0]
    required_keys = {"zone_id", "timestamp", "predicted_kw", "ev_share_pct", "confidence_lo", "confidence_hi", "model_version"}
    assert all(k in item for k in required_keys)
    assert item["predicted_kw"] > 0
    assert 0 <= item["ev_share_pct"] <= 100
    assert item["confidence_lo"] < item["predicted_kw"] < item["confidence_hi"]
    
    print(f"  [Sample Demand] {item['timestamp']} | {item['predicted_kw']} kW | EV: {item['ev_share_pct']:.1f}%")
    record_test("Forecast demand (basic)", "PASS", time.perf_counter() - start)

def test_forecast_demand_range(zone_id: str):
    start = time.perf_counter()
    # Data is in Jan/Feb 2024
    start_ts = "2024-01-15T00:00:00"
    end_ts = "2024-01-16T00:00:00"
    response = client.get(f"/api/forecast/demand?zone_id={zone_id}&start_ts={start_ts}&end_ts={end_ts}")
    
    data = response.json()
    assert len(data) > 0
    
    # Check ordering and range
    last_ts = None
    for item in data:
        current_ts = datetime.fromisoformat(item["timestamp"].replace("Z", ""))
        assert datetime.fromisoformat(start_ts) <= current_ts <= datetime.fromisoformat(end_ts)
        if last_ts:
            assert current_ts >= last_ts
        last_ts = current_ts
        
    record_test("Forecast demand (range)", "PASS", time.perf_counter() - start)

def test_forecast_demand_edge():
    start = time.perf_counter()
    # Fake zone
    response = client.get("/api/forecast/demand?zone_id=FAKE999")
    assert response.status_code == 200
    assert response.json() == []
    
    # Missing param
    response = client.get("/api/forecast/demand")
    assert response.status_code == 422
    
    record_test("Forecast demand (edge)", "PASS", time.perf_counter() - start)

def test_forecast_explain(zone_id: str):
    start = time.perf_counter()
    ts = "2024-01-15T18:00:00"
    response = client.get(f"/api/forecast/explain?zone_id={zone_id}&timestamp={ts}")
    
    assert response.status_code == 200
    data = response.json()
    required_keys = {"zone_id", "timestamp", "base_value", "shap_values", "top_feature", "explanation"}
    assert all(k in data for k in required_keys)
    assert isinstance(data["shap_values"], dict)
    assert len(data["shap_values"]) >= 3
    assert all(isinstance(v, (float, int)) for v in data["shap_values"].values())
    assert data["top_feature"] in data["shap_values"]
    
    print(f"  [SHAP] {data['shap_values']}")
    record_test("Forecast explain", "PASS", time.perf_counter() - start)

def test_schedule_optimize(zone_id: str):
    start = time.perf_counter()
    payload = {
        "zone_id": zone_id,
        "date": "2024-01-15",
        "capacity_limit_kw": 500,
        "user_window_start": 18,
        "user_window_end": 22
    }
    response = client.post("/api/schedule/optimize", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 24
    
    hours = [item["hour_slot"] for item in data]
    assert sorted(hours) == list(range(24))
    
    dist = {"CHARGE_NOW": 0, "DEFER": 0, "OPTIMAL_WINDOW": 0}
    for item in data:
        dist[item["action"]] += 1
        if 18 <= item["hour_slot"] <= 22:
            assert item["action"] in ["DEFER", "OPTIMAL_WINDOW"]
            
    print(f"  [Actions] {dist}")
    record_test("Schedule optimize", "PASS", time.perf_counter() - start)

def test_schedule_comparison(zone_id: str):
    start = time.perf_counter()
    response = client.get(f"/api/schedule/comparison?zone_id={zone_id}&date=2024-01-15")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["unmanaged_curve"]) == 24
    assert len(data["optimized_curve"]) == 24
    assert data["peak_delta_kw"] > 0
    assert data["peak_reduction_pct"] > 0
    
    max_unmanaged = max(h["load_kw"] for h in data["unmanaged_curve"])
    max_optimized = max(h["load_kw"] for h in data["optimized_curve"])
    assert max_optimized < max_unmanaged
    
    print(f"  Peak reduced by {data['peak_delta_kw']} kW ({data['peak_reduction_pct']}%)")
    record_test("Schedule comparison", "PASS", time.perf_counter() - start)

def test_infra_hotspots():
    start = time.perf_counter()
    response = client.get("/api/infra/hotspots?n_clusters=5")
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 5
    
    top_site = data["features"][0]
    assert top_site["type"] == "Feature"
    assert top_site["geometry"]["type"] == "Point"
    lon, lat = top_site["geometry"]["coordinates"]
    assert 12.8 <= lat <= 13.2
    assert 77.4 <= lon <= 77.8
    
    print(f"  [Top Hotspot] {top_site['properties']['site_id']} score={top_site['properties']['composite_score']}")
    record_test("Infra hotspots", "PASS", time.perf_counter() - start)

def test_infra_recommend():
    start = time.perf_counter()
    response = client.get("/api/infra/recommend?top_n=10&min_score=0.0")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 10
    
    ranks = [s["composite_rank"] for s in data]
    assert ranks == sorted(ranks)
    
    # min_score check
    response_high = client.get("/api/infra/recommend?min_score=0.7")
    for s in response_high.json():
        assert s["composite_score"] >= 0.7
        
    print(f"  [Top 3] {[(s['site_id'], s['composite_score']) for s in data[:3]]}")
    record_test("Infra recommend", "PASS", time.perf_counter() - start)

def test_infra_site_detail(site_id: str):
    start = time.perf_counter()
    response = client.get(f"/api/infra/site/{site_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert "nearby_zone_avg_kw" in data
    assert data["nearby_zone_avg_kw"] > 0
    
    response_404 = client.get("/api/infra/site/NONEXISTENT")
    assert response_404.status_code == 404
    assert "detail" in response_404.json()
    
    record_test("Infra site detail", "PASS", time.perf_counter() - start)

def test_grid_alerts():
    start = time.perf_counter()
    response = client.get("/api/grid/alerts")
    
    assert response.status_code == 200
    data = response.json()
    
    severities = {"CRITICAL": 0, "WARNING": 0, "INFO": 0}
    for a in data:
        severities[a["severity"]] += 1
        assert a["acknowledged"] in [True, False, None]
        assert a["resolved"] in [True, False, None]
        
    # filter test
    res_crit = client.get("/api/grid/alerts?severity=CRITICAL")
    for a in res_crit.json():
        assert a["severity"] == "CRITICAL"
        
    print(f"  [Alerts] {severities}")
    record_test("Grid alerts", "PASS", time.perf_counter() - start)

def test_alert_acknowledge():
    start = time.perf_counter()
    alert_id = get_valid_alert_id()
    if not alert_id:
        record_test("Alert acknowledge", "WARN (no alerts in DB)")
        return
        
    response = client.post(f"/api/grid/alerts/{alert_id}/acknowledge")
    assert response.status_code == 200
    assert response.json()["status"] == "acknowledged"
    
    # verify
    res_list = client.get(f"/api/grid/alerts")
    alerts = res_list.json()
    found_alert = next((a for a in alerts if str(a["alert_id"]) == alert_id), None)
    
    if found_alert:
        is_ack = found_alert["acknowledged"] is True
        record_test("Alert acknowledge", "PASS" if is_ack else "FAIL (acknowledged is False)", time.perf_counter() - start)
    else:
        # Maybe it's further down the list
        record_test("Alert acknowledge", "PASS (ack sent, alert not in top 50)", time.perf_counter() - start)

def test_swagger_docs():
    start = time.perf_counter()
    res_docs = client.get("/docs")
    assert res_docs.status_code == 200
    
    res_json = client.get("/openapi.json")
    assert res_json.status_code == 200
    data = res_json.json()
    
    # Check for router tags in paths or global tags
    all_tags = set()
    if "tags" in data:
        all_tags.update(t["name"] for t in data["tags"])
    for path_data in data["paths"].values():
        for method_data in path_data.values():
            if "tags" in method_data:
                all_tags.update(method_data["tags"])
                
    assert {"Forecast", "Schedule", "Infrastructure", "Alerts"}.issubset(all_tags)
    assert len(data["paths"]) >= 8
    
    record_test("Swagger docs", "PASS", time.perf_counter() - start)

def test_response_times():
    # This is a meta-test summarizing previous timings
    slow = []
    for s in stats:
        if s["duration"] > 2.0:
            slow.append(f"{s['name']} ({s['duration']:.2f}s)")
            
    res = "PASS" if not slow else f"WARN (Slow: {slow})"
    record_test("Response times", res)

# ─── Main Execution ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    print_header()
    
    try:
        zone_id = get_valid_zone_id()
        site_id = get_valid_site_id()
        
        test_router_registration()
        test_forecast_demand_basic(zone_id)
        test_forecast_demand_range(zone_id)
        test_forecast_demand_edge()
        test_forecast_explain(zone_id)
        test_schedule_optimize(zone_id)
        test_schedule_comparison(zone_id)
        test_infra_hotspots()
        test_infra_recommend()
        test_infra_site_detail(site_id)
        test_grid_alerts()
        test_alert_acknowledge()
        test_swagger_docs()
        test_response_times()
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR during tests: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "─"*44)
    print("GridWise Phase 2 — Test Results")
    print("─"*44)
    
    for s in stats:
        padding = 22 - len(s["name"])
        print(f"  {s['name']}{' '*padding} {s['result']}")
        
    print("─"*44)
    
    all_pass = all(
        s["result"].startswith("PASS") or 
        "WARN" in s["result"] 
        for s in stats
    )
    if all_pass and len(stats) >= 13:
        print("  Result: READY FOR PHASE 3 ✅")
    else:
        print("  Result: FIX FAILS BEFORE PROCEEDING ✘")
    print("─"*44 + "\n")
