<p align="center">
  <img src="https://img.shields.io/badge/GridWise-v1.0-00C896?style=for-the-badge&logo=lightning&logoColor=white" alt="GridWise v1.0" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/XGBoost-FF6600?style=for-the-badge&logo=xgboost&logoColor=white" alt="XGBoost" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

# ⚡ GridWise — AI-Powered EV Grid Intelligence for BESCOM

> **Turn reactive grid management into proactive, data-driven planning — specifically for the EV charging surge Bengaluru faces before 2030.**

GridWise is an enterprise-grade, full-stack AI decision-support platform built for **BESCOM** (Bangalore Electricity Supply Company). It ingests EV registration data, transformer load signals, and geospatial information to **predict demand**, **optimize charging schedules**, and **recommend infrastructure expansion** — all through an intuitive, real-time operator dashboard.

GridWise **never modifies the live grid**. It is a pure intelligence layer that advises operators with explainable, data-backed recommendations.

---

## 📋 Table of Contents

1. [Problem Statement](#-problem-statement)
2. [Solution Overview](#-solution-overview)
3. [System Architecture](#-system-architecture)
4. [Technology Stack](#-technology-stack)
5. [Project Structure](#-project-structure)
6. [Data Pipeline & Synthetic Generation](#-data-pipeline--synthetic-generation)
7. [ML Intelligence Layer](#-ml-intelligence-layer)
8. [Backend API Reference](#-backend-api-reference)
9. [Frontend Dashboard](#-frontend-dashboard)
10. [Database Schema](#-database-schema)
11. [Getting Started](#-getting-started)
12. [Environment Variables](#-environment-variables)
13. [Docker Deployment](#-docker-deployment)
14. [Performance & Caching](#-performance--caching)
15. [Expected Impact](#-expected-impact)
16. [Development Notes](#-development-notes)

---

## 🔴 Problem Statement

Bengaluru has approximately **3.4 lakh EVs today**, projected to reach **~23 lakh by 2030** — a **6.7× increase**. Every EV owner plugs in between **6–10 PM**, the same window when household demand peaks. BESCOM currently has **zero EV-specific visibility** in grid demand.

| Problem | Impact |
|---------|--------|
| **Evening peak overload (6–10 PM)** | Simultaneous EV + household demand overloads distribution transformers |
| **Zero EV data signals for planners** | No ability to anticipate, plan, or respond to EV-driven load |
| **~60% transformer stress events** | Traceable to concentrated, unmanaged EV charging behaviour |
| **6.7× EV growth by 2030** | Infrastructure decisions made today must last a decade |
| **Reactive planning only** | Grid expansions happen after failures, not before them |

---

## 💡 Solution Overview

GridWise addresses these challenges through **four core intelligence modules**:

| Module | Purpose | Key Algorithm |
|--------|---------|---------------|
| **A — Demand Forecasting** | Predict zone-level EV charging demand at 15-min intervals | XGBoost with quantile regression for confidence intervals |
| **B — Smart Charging Scheduler** | Generate hourly charge/defer recommendations per zone | Linear Programming (PuLP) with rule-based fallback |
| **C — Infrastructure Planner** | Identify optimal locations for new EV charging stations | K-Means clustering + KDE heatmaps + composite scoring |
| **D — Explainability Layer** | Make every AI output understandable for non-technical planners | SHAP TreeExplainer for feature attribution |
| **E — Localized Interface** | Full Kannada/English toggle for BESCOM field operators | Custom i18n Hook + Noto Sans Kannada Font |

Each module feeds into a **real-time React dashboard** with live WebSocket streaming, interactive GIS maps, and exportable reports.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GRIDWISE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND  (Next.js 16 + React 19)                 │   │
│  │                                                                      │   │
│  │  /dashboard    /forecast    /scheduler    /infra-map    /alerts      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐ ┌──────────┐ │   │
│  │  │ KPI Tiles│ │ 48h Chart│ │ Heatmap  │  │ Leaflet  │ │ Alert    │ │   │
│  │  │ Live Feed│ │ SHAP Bars│ │ LP Comp. │  │ KDE+Sites│ │ Feed     │ │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘  └────┬─────┘ └────┬─────┘ │   │
│  │       │             │            │              │            │       │   │
│  │       └─────────────┴────────────┴──────────────┴────────────┘       │   │
│  │                          SWR + Axios + WebSocket                      │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│                            HTTP REST + WS                                   │
│                                     │                                       │
│  ┌──────────────────────────────────┴───────────────────────────────────┐   │
│  │                     BACKEND  (FastAPI + Python 3.11)                  │   │
│  │                                                                      │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │   │
│  │  │  Forecast  │  │  Schedule  │  │   Infra    │  │    Alerts    │   │   │
│  │  │   Router   │  │   Router   │  │   Router   │  │    Router    │   │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘  │   │
│  │        │                │               │                │          │   │
│  │  ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐  ┌──────▼───────┐ │   │
│  │  │  XGBoost   │  │    PuLP    │  │  K-Means   │  │  Background  │ │   │
│  │  │  Forecast  │  │ LP Solver  │  │  + KDE     │  │   Monitor    │ │   │
│  │  │  + SHAP    │  │ + Fallback │  │ + Scoring  │  │  (60s loop)  │ │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────────┘ │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │   │
│  │  │   Redis Cache    │  │  WebSocket Mgr   │  │  Response Timer  │   │   │
│  │  │  (per-endpoint   │  │  (ConnectionMgr  │  │  (middleware,    │   │   │
│  │  │   TTL configs)   │  │   + LiveLoad)    │  │   slow-request)  │   │   │
│  │  └────────┬─────────┘  └──────────────────┘  └──────────────────┘   │   │
│  └───────────┼──────────────────────────────────────────────────────────┘   │
│              │                                                              │
│  ┌───────────▼──────────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER                                         │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐       ┌──────────────────────────────────────┐ │   │
│  │  │  PostgreSQL      │       │  Synthetic Data Generator            │ │   │
│  │  │  (Supabase)      │       │  (generate_gridwise_data.py)         │ │   │
│  │  │                  │       │                                      │ │   │
│  │  │  • zones         │  ◄──  │  • ev_demand_timeseries (350K rows)  │ │   │
│  │  │  • zone_demand   │       │  • ev_registrations (5K rows)        │ │   │
│  │  │  • charging_rec  │       │  • charging_stations (120 rows)      │ │   │
│  │  │  • infra_site    │       │  • transformer_load (262K rows)      │ │   │
│  │  │  • grid_alert    │       │  • candidate_sites (200 rows)        │ │   │
│  │  │                  │       │  • zone_config + boundaries          │ │   │
│  │  └──────────────────┘       └──────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Technology Stack

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | **Next.js** (App Router) | 16.2.4 | SSR, file-based routing, React Server Components |
| UI Library | **React** | 19.2.4 | Component-based UI with hooks |
| Language | **TypeScript** | 5.x | End-to-end type safety |
| Styling | **Tailwind CSS** | 4.x | Utility-first, dark theme design system |
| Charts | **Recharts** | 3.8.1 | Demand forecast lines, area charts, bar charts |
| Maps | **Leaflet JS** | 1.9.4 | GIS visualization with KDE heatmap overlays |
| Heatmaps | **leaflet.heat** | 0.2.0 | Demand density heatmap layer |
| Data Fetching | **SWR** | 2.4.1 | Stale-while-revalidate with auto-refresh |
| HTTP Client | **Axios** | 1.16.0 | API communication |
| Icons | **Lucide React** | 1.14.0 | Consistent iconography |
| UI Primitives | **Radix UI** | Latest | Accessible Select, Tabs components |
| Date Utilities | **date-fns** | 4.1.0 | Timestamp formatting and manipulation |
| Internationalization | **Custom Hook** | — | Lightweight English/Kannada toggle with `localStorage` persistence |
| Fonts | **Google Fonts** | — | Inter, JetBrains Mono, **Noto Sans Kannada** |

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| API Framework | **FastAPI** | Latest | Async REST + WebSocket, auto-generated OpenAPI docs |
| Validation | **Pydantic v2** | ≥2.0 | Request/response schema enforcement |
| Settings | **pydantic-settings** | Latest | Type-safe environment variable loading |
| Server | **Uvicorn** | Latest | ASGI server with hot-reload |
| ORM | **SQLAlchemy** | Latest | Database models with relationship mapping |
| Database | **PostgreSQL** (Supabase) | — | Cloud-hosted with connection pooling |
| Spatial | **GeoAlchemy2** | Latest | PostGIS geometry columns for zone boundaries |
| Cache | **Redis** | Latest | Per-endpoint TTL caching with pattern-based flush |
| WebSocket | **websockets** | Latest | Real-time bidirectional streaming |
| HTTP Client | **httpx** | Latest | Async HTTP for external integrations |

### ML & Data Science

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Primary Model | **XGBoost** | Gradient-boosted demand forecasting (200 estimators, depth 6) |
| Quantile Models | **XGBoost** (`reg:quantileerror`) | 90% prediction intervals (α=0.05 and α=0.95) |
| Explainability | **SHAP** (TreeExplainer) | Feature attribution for every prediction |
| Optimization | **PuLP** (CBC solver) | Linear programming for charge scheduling |
| Clustering | **scikit-learn** (KMeans) | EV hotspot zone detection |
| Density Estimation | **SciPy** (gaussian_kde) | 50×50 spatial demand density grid |
| Data Processing | **Pandas + NumPy** | ETL, feature engineering, tabular pipelines |
| Model Persistence | **joblib** | Serialize/deserialize trained model artifacts |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Containerization | **Docker** | Python 3.11-slim base with GDAL/PostGIS bindings |
| Orchestration | **Docker Compose** | Multi-service local development |
| Database Hosting | **Supabase** | Managed PostgreSQL with SSL |
| Environment | **.env + pydantic-settings** | Secure configuration management |

---

## 📁 Project Structure

```
Voltaris-AI/
│
├── README.md                          # This file
├── PRD.MD                             # Product Requirements Document
├── generate_gridwise_data.py          # Synthetic data generator (8 datasets)
│
├── backend/                           # FastAPI backend service
│   ├── Dockerfile                     # Python 3.11-slim + GDAL
│   ├── docker-compose.yml             # Backend-only compose
│   ├── requirements.txt               # 21 Python dependencies
│   ├── train.py                       # Standalone model training script
│   ├── .env.example                   # Environment variable template
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app entry — lifespan, routers, middleware
│   │   ├── config.py                  # pydantic-settings configuration
│   │   │
│   │   ├── routers/                   # API route handlers
│   │   │   ├── forecast.py            # GET /demand, GET /explain
│   │   │   ├── schedule.py            # POST /optimize, GET /comparison
│   │   │   ├── infra.py               # GET /hotspots, GET /recommend, GET /site/:id
│   │   │   └── alerts.py              # GET /alerts, POST /alerts/:id/acknowledge
│   │   │
│   │   ├── ml/                        # Machine learning services
│   │   │   ├── forecast.py            # XGBoost ForecastService (train + predict)
│   │   │   ├── explainer.py           # SHAP ExplainerService with Redis caching
│   │   │   ├── optimizer.py           # PuLP LP OptimizerService + rule fallback
│   │   │   └── clustering.py          # KMeans ClusteringService + KDE
│   │   │
│   │   ├── models/                    # Data models
│   │   │   ├── db_models.py           # SQLAlchemy ORM (5 tables)
│   │   │   └── schemas.py             # Pydantic v2 request/response schemas
│   │   │
│   │   ├── websocket/                 # Real-time streaming
│   │   │   └── live_load.py           # ConnectionManager + LiveLoadStreamer
│   │   │
│   │   ├── cache/                     # Caching layer
│   │   │   └── redis_cache.py         # Per-endpoint TTL, pattern flush, stats
│   │   │
│   │   ├── tasks/                     # Background workers
│   │   │   └── background.py          # 60-second alert monitor loop
│   │   │
│   │   ├── utils/                     # Shared utilities
│   │   │   ├── db.py                  # SessionLocal, engine, get_db dependency
│   │   │   └── errors.py              # Global exception handlers
│   │   │
│   │   └── data/                      # Data ingestion helpers
│   │
│   ├── models/                        # Serialized ML model artifacts (.pkl)
│   └── tests/                         # pytest + pytest-asyncio test suite
│
├── gridwise-frontend/                 # Next.js 16 frontend
│   ├── package.json                   # 13 dependencies, 10 dev dependencies
│   ├── next.config.ts                 # Next.js configuration
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── postcss.config.mjs             # PostCSS + Tailwind
│   ├── eslint.config.mjs              # ESLint configuration
│   ├── .env.local                     # API_URL + WS_URL
│   │
│   └── src/
│       ├── app/                       # App Router pages
│       │   ├── layout.tsx             # Root layout with sidebar
│       │   ├── page.tsx               # Redirect to /dashboard
│       │   ├── globals.css            # Tailwind base + dark theme
│       │   ├── dashboard/page.tsx     # KPI tiles + live WebSocket chart
│       │   ├── forecast/page.tsx      # 48h forecast + SHAP explainability
│       │   ├── scheduler/page.tsx     # Heatmap + LP comparison chart
│       │   ├── infra-map/page.tsx     # Leaflet map + KDE + site ranking
│       │   ├── alerts/page.tsx        # Severity-filtered alert feed
│       │   └── reports/page.tsx       # Export & reporting interface
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx        # Navigation sidebar with route links
│       │   │   └── TopBar.tsx         # Top bar with zone selector + Language Toggle
│       │   ├── ui/
│       │   │   ├── KPICard.tsx        # Metric display card component
│       │   │   ├── Badge.tsx          # Severity/status badge
│       │   │   └── ScoreBar.tsx       # Horizontal score visualization
│       │   └── map/
│       │       └── GridMap.tsx        # Dynamic Leaflet map (SSR disabled)
│       │
│       ├── context/
│       │   ├── ZoneContext.tsx        # Global zone selection state
│       │   └── LanguageContext.tsx    # English/Kannada language state + persistence
│       │
│       ├── hooks/
│       │   ├── useLiveLoad.ts         # WebSocket hook for real-time data
│       │   └── useTranslation.ts      # Custom t() hook for dot-notation localization
│       │
│       └── lib/
│           ├── api.ts                 # SWR hooks for all API endpoints
│           ├── types.ts               # TypeScript interfaces
│           └── translations.ts        # English and Kannada translation objects
│
└── output/                            # Generated synthetic datasets
    ├── ev_demand_timeseries.csv        # 350,400 rows (30 MB)
    ├── transformer_load.csv           # 262,800 rows (22 MB)
    ├── charging_sessions.csv          # ~100K rows (5.6 MB)
    ├── ev_registrations.csv           # 5,000 rows (400 KB)
    ├── candidate_sites.csv            # 200 rows (31 KB)
    ├── charging_stations.csv          # 120 rows (17 KB)
    ├── zone_boundaries.geojson        # 10 zone polygons (8 KB)
    └── zone_config.json               # Zone metadata (5 KB)
```

---

## 📊 Data Pipeline & Synthetic Generation

GridWise uses a **hybrid data strategy** — no real BESCOM data is required. The `generate_gridwise_data.py` script produces **8 interdependent datasets** with seeded reproducibility (`np.random.seed(42)`).

### Generated Datasets

| # | Dataset | Rows | Size | Granularity |
|---|---------|------|------|-------------|
| 1 | `ev_demand_timeseries.csv` | 350,400 | 30 MB | 10 zones × 35,040 intervals (15-min, full year) |
| 2 | `transformer_load.csv` | 262,800 | 22 MB | 30 transformers × 8,760 hours |
| 3 | `charging_sessions.csv` | ~100,000 | 5.6 MB | Individual charging session records |
| 4 | `ev_registrations.csv` | 5,000 | 400 KB | Synthetic EV owner profiles |
| 5 | `charging_stations.csv` | 120 | 17 KB | Station infrastructure across 10 zones |
| 6 | `candidate_sites.csv` | 200 | 31 KB | Potential charger sites with composite scores |
| 7 | `zone_boundaries.geojson` | 10 | 8 KB | GeoJSON zone polygon boundaries |
| 8 | `zone_config.json` | 10 | 5 KB | Zone metadata and transformer capacities |

### Zone Configuration (Bengaluru)

| Zone ID | Area | Transformer Capacity | EV Density Multiplier |
|---------|------|---------------------|-----------------------|
| Z01 | Whitefield | 800 kW | 1.40× |
| Z02 | Koramangala | 750 kW | 1.30× |
| Z03 | Jayanagar | 900 kW | 1.10× |
| Z04 | Hebbal | 700 kW | 1.00× |
| Z05 | Yelahanka | 850 kW | 1.00× |
| Z06 | Electronic City | 1000 kW | 1.50× |
| Z07 | Rajajinagar | 600 kW | 0.70× |
| Z08 | Malleshwaram | 650 kW | 0.75× |
| Z09 | Yeshwanthpur | 750 kW | 1.00× |
| Z10 | Basavanagudi | 700 kW | 1.00× |

### Statistical Constraints Applied

The synthetic data incorporates real-world Bengaluru patterns:

- **Peak demand window**: 6–10 PM with ~3× load multiplier over off-peak
- **Weekend effect**: +20% EV charging load on Saturdays/Sundays
- **Holiday effect**: +30% load boost on 10 Indian public holidays
- **Monsoon damping**: −10% load during June–September
- **Summer amplification**: +15% total load during March–May
- **Temperature correlation**: Monthly averages (20–28°C) with ±2°C Gaussian noise
- **EV fleet mix**: 55% 2-wheelers, 20% 3-wheelers, 25% 4-wheelers (from Vahan data)
- **Transformer stress target**: ~60% stress events (per PRD §2 specifications)
- **Gaussian noise**: 5% standard deviation on all load values for realism

### Running the Generator

```bash
python generate_gridwise_data.py
```

Output is written to the `./output/` directory. The generator prints row counts and file sizes for verification:

```
▸ Generating EV demand timeseries …
  ✓ ev_demand_timeseries.csv  →  350,400 rows  |  29.96 MB
▸ Generating EV registrations …
  ✓ ev_registrations.csv      →  5,000 rows    |  0.39 MB
▸ Generating charging stations …
  ✓ charging_stations.csv     →  120 rows      |  0.02 MB
▸ Generating transformer load data …
  ✓ transformer_load.csv      →  262,800 rows  |  21.88 MB
▸ Generating candidate sites …
  ✓ candidate_sites.csv       →  200 rows      |  0.03 MB
```

---

## 🧠 ML Intelligence Layer

### Module A — XGBoost Demand Forecasting

The forecasting engine (`backend/app/ml/forecast.py`) uses a **ForecastService singleton** that manages three XGBoost models for point predictions and confidence intervals.

#### Feature Engineering Pipeline

Every prediction is built from 8 engineered features:

| Feature | Type | Derivation |
|---------|------|------------|
| `hour` | Integer (0–23) | Extracted from timestamp |
| `day_of_week` | Integer (0–6) | Monday=0, Sunday=6 |
| `month` | Integer (1–12) | Extracted from timestamp |
| `is_weekend` | Binary (0/1) | Saturday or Sunday |
| `is_peak_hour` | Binary (0/1) | Hour between 18–22 |
| `zone_id_encoded` | Integer | LabelEncoder-transformed zone ID |
| `hour_sin` | Float | `sin(2π × hour / 24)` — cyclical encoding |
| `hour_cos` | Float | `cos(2π × hour / 24)` — cyclical encoding |

#### Model Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    TRIPLE-MODEL ENSEMBLE                      │
│                                                              │
│  ┌─────────────────────┐                                     │
│  │  XGBoost (Main)     │  → predicted_kw (point estimate)    │
│  │  objective: reg:sq  │                                     │
│  │  n_estimators: 200  │                                     │
│  │  max_depth: 6       │                                     │
│  │  learning_rate: 0.1 │                                     │
│  │  subsample: 0.8     │                                     │
│  └─────────────────────┘                                     │
│                                                              │
│  ┌─────────────────────┐                                     │
│  │  XGBoost (Low CI)   │  → confidence_lo (5th percentile)   │
│  │  objective:         │                                     │
│  │  reg:quantileerror  │                                     │
│  │  quantile_alpha: 5% │                                     │
│  └─────────────────────┘                                     │
│                                                              │
│  ┌─────────────────────┐                                     │
│  │  XGBoost (High CI)  │  → confidence_hi (95th percentile)  │
│  │  objective:         │                                     │
│  │  reg:quantileerror  │                                     │
│  │  quantile_alpha: 95%│                                     │
│  └─────────────────────┘                                     │
│                                                              │
│  Training: 80/20 time-based split                            │
│  Metrics: MAE (kW), RMSE (kW), R²                           │
│  Persistence: joblib → models/*.pkl                          │
└──────────────────────────────────────────────────────────────┘
```

#### Auto-Training

If model artifacts are not found at startup, the `ForecastService` automatically trains from the Supabase database:

```python
# Triggered automatically on first prediction request
forecast_service.load_models()
# → Checks for forecast_model.pkl, forecast_model_lo.pkl,
#   forecast_model_hi.pkl, zone_encoder.pkl
# → If missing, calls self.train() which queries the DB
```

### Module B — SHAP Explainability

The `ExplainerService` (`backend/app/ml/explainer.py`) wraps SHAP's `TreeExplainer` to provide feature attribution for every prediction.

#### How It Works

1. **Input**: A `(zone_id, timestamp)` pair
2. **Feature construction**: Same 8-feature pipeline as the forecast model
3. **SHAP computation**: `TreeExplainer.shap_values()` on the main XGBoost model
4. **Output**: Per-feature SHAP values, top driving feature, and human-readable explanation

#### Response Structure

```json
{
  "zone_id": "Z01",
  "timestamp": "2024-06-15T19:00:00",
  "predicted_kw": 487.32,
  "base_value": 312.45,
  "shap_values": {
    "hour": 89.23,
    "is_peak_hour": 45.12,
    "day_of_week": -12.34,
    "zone_id_encoded": 28.67,
    "month": 8.91,
    "is_weekend": -3.45,
    "hour_sin": 15.23,
    "hour_cos": -6.78
  },
  "top_feature": "hour",
  "explanation": "hour is the strongest driver, increasing the prediction by 89.2 kW"
}
```

#### Caching Strategy

SHAP values are cached in Redis with a **5-minute TTL**, keyed by `shap:{zone_id}:{hourly_timestamp}`. Timestamps are rounded to the hour for stable cache keys.

### Module C — LP Charging Scheduler

The `OptimizerService` (`backend/app/ml/optimizer.py`) uses **PuLP's CBC solver** to compute optimal charge/defer recommendations.

#### Peak-Relative Formulation (v1.1 Update)

The optimizer uses a **dynamic peak-flattening objective** rather than a fixed capacity threshold. It calculates today's peak and sets a target of 75% of that peak, ensuring effective optimization even when load is below nominal capacity.

```
OBJECTIVE:
    Minimize Σ(excess_h)  for h ∈ [0, 23]
    where excess_h ≥ adjusted_load_h - target_load
    and target_load = max(demand) × 0.75

DECISION VARIABLES (per hour):
    shift_h  ≥ 0    Load shifted away from hour h
    recv_h   ≥ 0    Load received into hour h
    excess_h ≥ 0    Load exceeding target_load

CONSTRAINTS:
    1. shift_h = 0           if h ∉ PEAK_HOURS {18,19,20,21,22}
    2. recv_h  = 0           if h ∉ OFF_PEAK   {22,23,0,1,2,3,4,5,6,7}
    3. shift_h ≥ demand_h × 0.08    if h ∈ PEAK and demand_h > mean_demand
    4. shift_h ≤ demand_h × 0.30    (max 30% shift per hour)
    5. recv_h  ≤ demand_h × 0.50    (max 50% receive per off-peak hour)
    6. Σ(shift) = Σ(recv)           (energy conservation)
```

#### Action Classification

| Condition | Action | Meaning |
|-----------|--------|---------|
| `shift_h > 0.01` | `DEFER` | Load shifted away from this peak hour |
| `recv_h > 0.01` | `OPTIMAL_WINDOW` | Redistributed load received here |
| Neither | `CHARGE_NOW` | Grid load within safe limits |

#### Rule-Based Fallback

If the LP solver returns infeasible (e.g., extreme edge cases), the system falls back to threshold-based rules:

| Load Level | Action | Window |
|-----------|--------|--------|
| > 85% capacity | `DEFER` | 22:00 – 07:00 |
| > 65% capacity | `OPTIMAL_WINDOW` | 22:00 – 07:00 |
| ≤ 65% capacity | `CHARGE_NOW` | Current hour |

### Module D — Infrastructure Planning (K-Means + KDE)

The `ClusteringService` (`backend/app/ml/clustering.py`) identifies EV infrastructure hotspots using dual spatial analysis.

#### K-Means Clustering

- **Input**: GPS coordinates of all 200 candidate sites
- **Algorithm**: K-Means with configurable `n_clusters` (1–10, default 5)
- **Output per cluster**: Centroid lat/lon, site count, average composite score, top-ranked site ID
- **Parameters**: `random_state=42`, `n_init=10` for reproducibility

#### KDE Heatmap Generation

```
Spatial Grid: 50×50 (2,500 cells)
Latitude range:  12.80° to 13.20° (Bengaluru bounds)
Longitude range: 77.40° to 77.80°
Kernel: scipy.stats.gaussian_kde
Output: 50×50 density matrix normalized for heatmap rendering
```

#### Composite Site Scoring

Each candidate site is scored across four dimensions:

```
composite_score = (0.35 × demand_score)
               + (0.25 × gap_score)
               + (0.25 × transformer_score)
               + (0.15 × access_score)
```

| Dimension | Weight | Source |
|-----------|--------|--------|
| **Demand Score** | 35% | EV density × demand growth trend (normalized) |
| **Gap Score** | 25% | Inverse of existing charger count within 500m |
| **Transformer Score** | 25% | Transformer headroom / 300 kW (capped at 1.0) |
| **Access Score** | 15% | Road type: highway=1.0, arterial=0.8, collector=0.55, residential=0.3 |

---

## 🔌 Backend API Reference

**Base URL**: `http://localhost:8000/api`
**Interactive Docs**: `http://localhost:8000/docs` (Swagger UI)

### Forecast Endpoints

#### `GET /api/forecast/demand`

Returns demand forecast data for a zone within a time range. Serves historical data from PostgreSQL and uses XGBoost for future timestamps beyond the last DB entry.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `zone_id` | string | ✅ | — | Zone identifier (e.g., `Z01`) |
| `start_ts` | datetime | ❌ | 7 days ago | Start of time range |
| `end_ts` | datetime | ❌ | now | End of time range |
| `interval` | string | ❌ | `15min` | Time interval granularity |

**Response**: `List[ZoneDemandForecast]`

```json
[
  {
    "id": "uuid",
    "zone_id": "Z01",
    "timestamp": "2024-06-15T18:00:00",
    "predicted_kw": 487.32,
    "ev_share_pct": 0.22,
    "confidence_lo": 412.10,
    "confidence_hi": 562.54,
    "model_version": "v1.0",
    "created_at": "2024-06-15T12:00:00"
  }
]
```

**Cache Headers**: `X-Cache: HIT|MISS`, `X-Cache-TTL`, `X-Response-Time`

---

#### `GET /api/forecast/explain`

Returns SHAP feature attribution for a specific prediction using TreeExplainer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone_id` | string | ✅ | Zone identifier |
| `timestamp` | datetime | ✅ | Prediction timestamp to explain |

**Response**: SHAP explanation object (see [Module B](#module-b--shap-explainability) for full structure)

---

### Schedule Endpoints

#### `POST /api/schedule/optimize`

Runs the LP optimizer for a zone on a given date. Persists results to the `charging_recommendation` table.

**Request Body**:

```json
{
  "zone_id": "Z01",
  "date": "2024-06-15",
  "capacity_limit_kw": 800.0,
  "user_window_start": 18,
  "user_window_end": 22
}
```

**Response**: `List[ChargingRecommendation]` — 24 hourly entries

```json
[
  {
    "id": "uuid",
    "zone_id": "Z01",
    "hour_slot": 19,
    "action": "DEFER",
    "grid_load_pct": 92.5,
    "optimal_window": "23:00 - 06:00",
    "reason": "LP shifted 45.2 kW from hour 19 to reduce peak stress",
    "expected_delta_kw": -45.2,
    "created_at": "2024-06-15T12:00:00"
  }
]
```

---

#### `GET /api/schedule/comparison`

Compares unmanaged vs LP-optimized load curves for a zone on a date.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone_id` | string | ✅ | Zone identifier |
| `date` | date | ✅ | Date to compare (YYYY-MM-DD) |

**Response**:

```json
{
  "zone_id": "Z01",
  "date": "2024-06-15",
  "unmanaged_curve": [{"hour": 0, "load_kw": 245.3}, ...],
  "optimized_curve": [{"hour": 0, "load_kw": 278.1}, ...],
  "peak_delta_kw": 87.45,
  "peak_reduction_pct": 12.34
}
```

---

### Infrastructure Endpoints

#### `GET /api/infra/hotspots`

Returns K-Means clustered sites as GeoJSON plus a KDE density grid.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `n_clusters` | int | ❌ | 5 | Number of clusters (1–10) |

**Response**: GeoJSON FeatureCollection + KDE grid

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [77.65, 12.97]},
      "properties": {
        "site_id": "CAND-042",
        "composite_score": 0.78,
        "composite_rank": 1,
        "cluster_label": 1,
        "site_count": 38
      }
    }
  ],
  "kde_grid": {
    "lats": [12.8, 12.8082, ...],
    "lons": [77.4, 77.4082, ...],
    "density": [[0.00012, ...], ...]
  }
}
```

---

#### `GET /api/infra/recommend`

Returns top-N infrastructure site candidates ranked by composite score.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `top_n` | int | ❌ | 10 | Max sites (1–50) |
| `min_score` | float | ❌ | 0.0 | Minimum composite score (0.0–1.0) |

---

#### `GET /api/infra/site/{site_id}`

Returns detailed site information including nearby zone demand and cluster label.

---

### Alert Endpoints

#### `GET /api/grid/alerts`

Query grid alerts with optional filters. Returns empty list gracefully when no alerts match.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `severity` | string | ❌ | — | `CRITICAL`, `WARNING`, or `INFO` |
| `zone_id` | string | ❌ | — | Filter by zone |
| `resolved` | bool | ❌ | false | Show resolved alerts |
| `limit` | int | ❌ | 50 | Max alerts (1–1000) |
| `offset` | int | ❌ | 0 | Pagination offset |

#### `POST /api/grid/alerts/{alert_id}/acknowledge`

Mark an alert as acknowledged. Flushes alert cache on success.

---

### Utility Endpoints

#### `GET /health`

System health check with detailed component status.

```json
{
  "status": "ok",
  "model_version": "v1.0",
  "db": "connected",
  "redis": "connected",
  "redis_keys": 42,
  "redis_memory": "1.2MB",
  "websocket_connections": 3,
  "background_monitor": "running",
  "uptime_seconds": 3600
}
```

#### `GET /api/cache/stats` — Redis cache statistics
#### `GET /api/cache/flush?pattern=forecast*` — Pattern-based cache invalidation

---

### Operator Workflow Endpoints (New)

#### `GET /api/briefing/today`

The core entry point for operators. Generates a system-wide status report for the current day.

- **Logic**: Runs 24h forecasts for all 10 zones, executes LP optimizer, summarizes active alerts, and calculates system-wide peak stats.
- **Cache**: 10-minute TTL.

**Response Snippet**:
```json
{
  "system_summary": {
    "overall_status": "WARNING",
    "zones_at_risk": 3,
    "peak_hour": 19,
    "recommended_action_count": 47
  },
  "zone_briefings": [...],
  "top_actions": [...],
  "alerts_summary": {"critical": 2, "warning": 8, "unacknowledged": 6}
}
```

---

#### `POST /api/simulate/scenario`

Simulates grid impact under various stress conditions (Holiday Spike, EV Surge, etc.) to demonstrate GridWise ROI.

**Request Body**:
```json
{
  "zone_id": "Z01",
  "date": "2026-05-03",
  "scenario": "peak_ev_surge",
  "ev_adoption_multiplier": 1.5,
  "follow_recommendations": true
}
```

**Response**: Side-by-side comparison of `unmanaged` vs `optimized` metrics, including `stress_hours_prevented` and a human-readable `verdict`.

---

#### `GET /api/actions/pending`

Returns prioritized list of recommended actions for the operator (e.g., sending defer advisories).

#### `POST /api/actions/{action_id}/acknowledge`

Logs an operator's acknowledgment of a recommendation with a custom note.

---

#### `GET /api/zones/health`

Calculates a 0-100 health score for every zone based on current load, peak forecast, and active alerts.

---

### WebSocket Protocol

#### `WS /ws/live-load?zone_id=Z01`

Real-time grid load streaming at **5-second intervals**.

**Connection Message**:
```json
{
  "type": "connected",
  "message": "GridWise live feed connected",
  "update_interval_ms": 5000,
  "zones": ["Z01", "Z02", ..., "Z10"]
}
```

**Data Frame** (every 5 seconds):
```json
{
  "type": "load_update",
  "timestamp": "2024-06-15T19:00:00",
  "data": [
    {
      "zone_id": "Z01",
      "timestamp": "2024-06-15T19:00:00",
      "load_kw": 487.32,
      "ev_share_pct": 0.2234,
      "confidence_lo": 412.10,
      "confidence_hi": 562.54,
      "status": "WARNING"
    }
  ]
}
```

**Status Thresholds**: `CRITICAL` (>600 kW), `WARNING` (>450 kW), `NORMAL` (≤450 kW)

The `LiveLoadStreamer` replays database forecast data with ±2% random jitter for realistic variance. The stream cycles back to the beginning when all data is exhausted.

---

## 🗄 Database Schema

GridWise uses **5 PostgreSQL tables** managed by SQLAlchemy ORM with PostGIS extensions.

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────────┐
│    zones     │       │  zone_demand_forecast │
│──────────────│       │──────────────────────│
│ zone_id (PK) │◄──────│ zone_id (FK)         │
│ zone_name    │       │ id (PK, UUID)        │
│ transformer  │       │ timestamp            │
│ _capacity_kw │       │ predicted_kw         │
│ geom (PostGIS│       │ ev_share_pct         │
│  MULTIPOLYGON│       │ confidence_lo/hi     │
│  SRID 4326)  │       │ model_version        │
└──────┬───────┘       │ created_at           │
       │               └──────────────────────┘
       │
       ├──────────►┌──────────────────────────┐
       │           │  charging_recommendation  │
       │           │──────────────────────────│
       │           │ id (PK, UUID)            │
       │           │ zone_id (FK)             │
       │           │ hour_slot (0–23)         │
       │           │ action (ENUM)            │
       │           │ grid_load_pct            │
       │           │ optimal_window           │
       │           │ reason                   │
       │           │ expected_delta_kw        │
       │           │ created_at               │
       │           └──────────────────────────┘
       │
       └──────────►┌──────────────────────────┐
                   │       grid_alert          │
                   │──────────────────────────│
                   │ alert_id (PK, UUID)      │
                   │ zone_id (FK)             │
                   │ severity (ENUM)          │
                   │ triggered_at             │
                   │ message                  │
                   │ recommended_action       │
                   │ acknowledged (bool)      │
                   │ resolved (bool)          │
                   └──────────────────────────┘

┌──────────────────────────┐
│   infra_site_candidate   │
│──────────────────────────│
│ site_id (PK)             │
│ lat, lon                 │
│ ward_name                │
│ demand_score             │  ← No FK to zones (standalone)
│ gap_score                │
│ transformer_score        │
│ access_score             │
│ composite_rank           │
│ composite_score          │
│ nearest_transformer_id   │
│ existing_chargers_500m   │
└──────────────────────────┘
```

### Enum Types

```python
class ActionEnum(str, Enum):
    CHARGE_NOW = "CHARGE_NOW"
    DEFER = "DEFER"
    OPTIMAL_WINDOW = "OPTIMAL_WINDOW"

class SeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"
```

---

## 🖥 Frontend Dashboard

The frontend is a **Next.js 16** application using the App Router pattern with React 19. All pages share a persistent sidebar navigation and top bar layout.

### Screen Overview

| Route | Page | Data Source | Real-time |
|-------|------|------------|-----------|
| `/dashboard` | Operator Command Center | `GET /api/briefing/today` | ❌ SWR (10m) |
| `/simulate` | Scenario Simulator | `POST /api/simulate/scenario` | ❌ On-demand |
| `/forecast` | Demand Forecast Deep-Dive | `GET /forecast/demand` + `/explain` | ❌ SWR (5m) |
| `/scheduler` | Charging Schedule Heatmap | `POST /schedule/optimize` + `GET /comparison` | ❌ SWR |
| `/infra-map` | Infrastructure Planning Map | `GET /infra/hotspots` + `/recommend` | ❌ SWR |
| `/alerts` | Grid Alert Center | `GET /grid/alerts` | ❌ SWR (30s) |
| `/reports` | Export & Reporting | Multiple endpoints | ❌ On-demand |

### Screen 1 — Operator Command Center (`/dashboard`)

The core entry point for BESCOM officials, redesigned for proactive grid management.

**Components**:
- **Daily Briefing Banner**: Large status indicator (`NORMAL`, `WARNING`, `CRITICAL`) with system-wide peak stats.
- **Zone Health Grid**: 10 interactive cards showing zone-specific health scores (0-100), letter grades (A-F), and load trends.
- **Action Center Sidebar**: Prioritized list of pending recommendations (e.g., DEFER advisories). Operators can **Acknowledge** or **Dismiss** actions directly.
- **System-Wide Load Curve**: 24-hour total system load (Total vs EV Component) with peak hour indicators.

### Screen 2 — Scenario Simulator (`/simulate`)

A powerful "What If?" tool to justify GridWise ROI and plan for future growth.

**Components**:
- **Scenario Picker**: Select from Normal Day, Holiday Spike, EV Surge, or Monsoon Dip.
- **2030 Adoption Slider**: Simulate EV growth from today (1.0x) to 2030 projections (3.0x).
- **Impact Comparison**: Side-by-side area charts comparing unmanaged grid stress vs. GridWise-optimized stability.
- **Verdict Engine**: Human-readable summary of prevented stress hours and peak reduction percentages.

### Screen 3 — Infrastructure Map (`/infra-map`)

Interactive GIS planning tool with **2030 Capacity Projection**.

**Key Update**:
- **2030 Projection Toggle**: When enabled, the heatmap scales demand by **6.7x** to represent Bengaluru's 2030 target of 23 lakh EVs.
- **Capacity Overlay**: Highlights zones that will exceed transformer limits without infrastructure expansion.

### Localized Interface (Kannada/English)

GridWise is built for BESCOM operators in Bengaluru, many of whom prefer using tools in **Kannada**.

**Features**:
- **Custom i18n Hook**: A lightweight `useTranslation` hook that supports dot-notation keys (e.g., `t('dashboard.title')`) and variable interpolation.
- **Dynamic Font Loading**: The dashboard automatically switches to the **Noto Sans Kannada** font when the language is set to 'kn' for optimal readability.
- **Persistence**: Language preferences are saved in `localStorage` under the key `gridwise-lang`.
- **Zero Dependencies**: Implemented using React Context and custom hooks to avoid the overhead of heavy internationalization libraries like `react-i18next`.

---

### Screen 4 — Demand Forecast (`/forecast`)

Deep-dive into predictions for any zone and time window.

**Components**:
- **Zone Selector**: Radix UI Select dropdown for Z01–Z10
- **48-Hour Forecast Chart**: Recharts `AreaChart` with confidence band (shaded area between `confidence_lo` and `confidence_hi`)
- **SHAP Explainability Panel**: Horizontal bar chart showing top features driving the current prediction, with magnitude and direction indicators
- **Metrics Summary**: Predicted peak load, EV contribution percentage, model version

**Data Flow**:
```
Zone Selection → useForecastDemand(zone_id, start_ts, end_ts)
                 → SWR auto-refresh every 5 minutes
             → useForecastExplain(zone_id, timestamp)
                 → SHAP values rendered as sorted bar chart
```

### Screen 3 — Optimization Scheduler (`/scheduler`)

Maps `CHARGE_NOW`, `OPTIMAL_WINDOW`, and `DEFER` recommendations across hours and zones.

**Components**:
- **Zone × Hour Heatmap**: Interactive CSS-grid colored by action type:
  - 🟢 Green = `CHARGE_NOW` (safe to charge)
  - 🟡 Amber = `OPTIMAL_WINDOW` (consider shifting)
  - 🔴 Red = `DEFER` (defer charging)
- **Load Comparison Chart**: Side-by-side "Unmanaged vs Optimized" area chart showing the LP solver's peak flattening effect
- **Peak Reduction Metrics**: Delta kW and percentage reduction badges
- **Schedule Config**: Capacity threshold and optimization window inputs

**Data Flow**:
```
Zone + Date → POST /schedule/optimize (with capacity_limit_kw)
            → GET /schedule/comparison (zone_id, date)
            → Renders heatmap grid + comparison overlay chart
```

### Screen 4 — Infrastructure Map (`/infra-map`)

Full-screen interactive GIS map powered by **Leaflet JS** with a dark enterprise aesthetic.

**Components**:
- **KDE Heatmap Layer**: Renders demand density from the 50×50 spatial matrix returned by `/infra/hotspots`. Uses `leaflet.heat` plugin for smooth gradient rendering.
- **Candidate Site Markers**: Color-coded circle markers plotted based on composite score (green=high, red=low)
- **Cluster Centroids**: Numbered markers at K-Means cluster centers showing aggregated statistics
- **Site Detail Panel**: Click-to-expand showing all 4 score components via `ScoreBar` visualizations
- **CSV Export**: Download ranked site list for field evaluation

**SSR Handling**:
```typescript
// Leaflet requires browser APIs — loaded dynamically to prevent SSR crashes
const GridMap = dynamic(() => import('@/components/map/GridMap'), {
  ssr: false,
  loading: () => <MapSkeleton />
});
```

### Screen 5 — System Alerts (`/alerts`)

GitHub-style notification feed for grid risk events.

**Components**:
- **Alert List**: Sorted by `triggered_at` (newest first) with severity badges
- **Severity Filters**: Toggle buttons for `CRITICAL`, `WARNING`, `INFO`
- **Alert Cards**: Zone name, trigger time, message, recommended action
- **Acknowledge Button**: POST to `/grid/alerts/{id}/acknowledge` — marks as seen
- **Auto-Refresh**: SWR revalidation every 30 seconds

**Background Alert Generation**:
The backend runs a 60-second background monitor (`tasks/background.py`) that:
1. Checks the latest forecast for each zone
2. If load exceeds 100% of reference capacity → creates `CRITICAL` alert
3. If load exceeds 85% → creates `WARNING` alert
4. Deduplicates: won't create duplicate unresolved alerts for same zone + severity

### Screen 6 — Reports (`/reports`)

Export and reporting interface for BESCOM management.

**Components**:
- **Report Type Selector**: Forecast Summary / Schedule Summary / Site Ranking
- **Date Range Picker**: Start and end date selection
- **Export Buttons**: Download CSV and PDF snapshots
- **Report Preview**: Inline preview of generated report data

### Frontend Data Fetching Architecture

All API communication is centralized in `lib/api.ts` using **SWR hooks**:

```typescript
// Every endpoint has a dedicated hook with typed responses
useForecastDemand(zone_id, start_ts?, end_ts?)  // refreshInterval: 5min
useForecastExplain(zone_id, timestamp)
useScheduleOptimize(payload)                      // POST via SWR
useScheduleComparison(zone_id, date)
useInfraHotspots(n_clusters?)                     // revalidateOnFocus: false
useInfraRecommend(top_n?, min_score?)
useInfraSite(site_id)
useGridAlerts(severity?, zone_id?)                // refreshInterval: 30s
```

### Reusable UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `KPICard` | `components/ui/KPICard.tsx` | Metric display with icon, value, label, and trend indicator |
| `Badge` | `components/ui/Badge.tsx` | Color-coded severity/status tags |
| `ScoreBar` | `components/ui/ScoreBar.tsx` | Horizontal progress bar for score visualization |
| `Sidebar` | `components/layout/Sidebar.tsx` | Navigation sidebar with active route highlighting |
| `TopBar` | `components/layout/TopBar.tsx` | Top bar with zone selector and status indicators |
| `GridMap` | `components/map/GridMap.tsx` | Leaflet map with KDE heatmap, markers, and popups |

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Minimum Version | Check Command |
|------------|----------------|---------------|
| **Node.js** | v18.17.0+ | `node --version` |
| **Python** | 3.10+ | `python --version` |
| **Git** | Any | `git --version` |
| **PostgreSQL** | 14+ (or Supabase) | `psql --version` |
| **Redis** | 6+ (optional) | `redis-cli ping` |

### 1. Start the Backend (FastAPI)

```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies (21 packages)
pip install -r requirements.txt

# Configure environment (see Environment Variables section)
cp .env.example .env
# Edit .env with your Supabase credentials

# Run the API server
uvicorn app.main:app --reload --port 8000
```

The backend will be running at `http://localhost:8000`:
- **Swagger UI**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

On startup, the server will:
1. Create PostGIS extension if not exists
2. Auto-create all 5 database tables via SQLAlchemy
3. Start the background alert monitor (60-second loop)
4. Begin accepting WebSocket connections

### 2. Start the Frontend (Next.js)

```bash
# Navigate to frontend
cd gridwise-frontend

# Install Node dependencies
npm install

# Configure environment
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8000" >> .env.local

# Run development server
npm run dev
```

The dashboard will be running at `http://localhost:3000`.

### 3. Generate & Seed Data (First-Time Setup)

```bash
# From project root — generate synthetic datasets
python generate_gridwise_data.py

# Output: 8 files in ./output/ directory (~60 MB total)
```

Then seed the generated CSV data into your Supabase PostgreSQL database using your preferred method (Supabase dashboard import, `psql COPY`, or a custom script).

### 4. Train ML Models (Optional)

Models are auto-trained on first API request if artifacts don't exist. To manually train:

```bash
cd backend
python train.py
# → Saves 4 model files to ./models/
#   forecast_model.pkl, forecast_model_lo.pkl,
#   forecast_model_hi.pkl, zone_encoder.pkl
```

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
# PostgreSQL (Supabase)
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require

# Supabase Project
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJI...

# Redis (optional — gracefully degrades without it)
REDIS_URL=redis://localhost:6379/0

# Application
CORS_ORIGINS=["http://localhost:3000"]
MODEL_DIR=./models
APP_ENV=dev
SECRET_KEY=your-secret-key
SEED_DATA_DIR=./data/output
MODEL_VERSION=v1.0
```

### Frontend (`gridwise-frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## 🐳 Docker Deployment

### Run with Docker Compose (Recommended)

```bash
# From project root
# Ensure .env (backend) and .env.local (frontend) are configured

# Build and start all services
docker-compose up --build

# Detached mode
docker-compose up -d --build

# Stop
docker-compose down
```

This will spin up:
- **FastAPI backend** on port `8000` (Python 3.11-slim + GDAL + PostGIS bindings)
- **Next.js frontend** on port `3000`

### Backend Dockerfile Details

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y libpq-dev gdal-bin
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

---

## ⚡ Performance & Caching

### Redis Caching Strategy

Every API endpoint has a dedicated cache TTL configuration:

| Endpoint | Cache Key Pattern | TTL | Rationale |
|----------|------------------|-----|-----------|
| `GET /forecast/demand` | `forecast_demand:{zone}:{ts}` | 5 min | Forecasts don't change frequently |
| `GET /forecast/explain` | `forecast_explain:{zone}:{ts}` | 5 min | SHAP computation is expensive |
| `POST /schedule/optimize` | `schedule_optimize:{zone}:{date}` | 10 min | LP solver results are deterministic |
| `GET /schedule/comparison` | `schedule_comparison:{zone}:{date}` | 10 min | Same inputs → same output |
| `GET /infra/hotspots` | `infra_hotspots:{n_clusters}` | 15 min | Clustering is computationally heavy |
| `GET /infra/recommend` | `infra_recommend:{top_n}:{score}` | 15 min | Ranked list rarely changes |
| `GET /infra/site/{id}` | `infra_site:{site_id}` | 15 min | Static site data |
| `GET /grid/alerts` | `grid_alerts:{filters}` | 1 min | Alerts need fresh data |

**Cache Headers**: Every response includes `X-Cache: HIT|MISS`, `X-Cache-TTL`, and `X-Response-Time` headers.

**Graceful Degradation**: Redis is optional. If unavailable, the system operates without caching — all computations happen on every request.

### Response Time Monitoring

A custom FastAPI middleware tracks response times:
- Adds `X-Response-Time` header to every response
- Logs a `SLOW REQUEST` warning for any endpoint exceeding **2 seconds**

### Clustering Cache

The `ClusteringService` maintains an **in-memory cache** with a **15-minute TTL** for K-Means + KDE results, avoiding redundant database queries and computation.

---

## 📈 Expected Impact

| Metric | Baseline (No GridWise) | With GridWise | Improvement |
|--------|----------------------|---------------|-------------|
| Evening peak load | Unmanaged, full spike | Shifted / flattened via LP | **20–30% reduction** |
| Transformer stress events | ~60% caused by EV peak | Reduced via smart scheduling | **Up to 60% reduction** |
| Charging infra utilization | Uneven (over/under-served) | Demand-matched placement | **2× improvement** |
| Planning approach | Reactive (after failures) | Predictive (before failures) | **Qualitative step-change** |
| EV-specific data signals | Zero visibility | Zone + time granularity | **From 0 to full visibility** |
| Decision confidence | Gut-feel based | SHAP-explained, data-backed | **Every recommendation explained** |

---

## 🧪 Development Notes

### Key Technical Decisions

- **Map Engine (Leaflet vs Mapbox)**: The application uses Leaflet JS with free OpenStreetMap tiles instead of Mapbox GL JS. This eliminates API key requirements and rate limit concerns. The map component is loaded dynamically using `next/dynamic` with `ssr: false` to prevent React SSR hydration issues.

- **Quantile Regression for Confidence Intervals**: Instead of using standard deviation-based intervals, GridWise trains separate XGBoost models with `reg:quantileerror` objective at α=0.05 and α=0.95. This provides distribution-free, asymmetric confidence bounds that better capture the non-Gaussian nature of grid load data.

- **LP Solver with Fallback**: The PuLP CBC solver provides optimal solutions but can return infeasible for edge cases. The `OptimizerService` automatically falls back to a threshold-based rule engine, ensuring every request gets a valid recommendation.

- **Singleton Pattern for ML Services**: `ForecastService`, `ExplainerService`, `OptimizerService`, and `ClusteringService` all use the singleton pattern to avoid reloading models on every request.

- **Background Alert Monitor**: An `asyncio.Task` runs a 60-second loop that checks all zones against capacity thresholds and creates deduplicated alerts. This runs within the FastAPI lifespan context and is properly cancelled on shutdown.

- **Data Fetching (SWR)**: The frontend uses SWR for all REST data fetching, providing stale-while-revalidate semantics, automatic caching, and configurable refresh intervals per endpoint.

### Backend Routing Architecture

```
FastAPI App
├── /api/forecast/*    → forecast_router  (Forecast tag)
├── /api/schedule/*    → schedule_router   (Schedule tag)
├── /api/infra/*       → infra_router      (Infrastructure tag)
├── /api/grid/*        → alerts_router     (Alerts tag)
├── /api/cache/*       → inline handlers   (Cache tag)
├── /health            → inline handler    (Health tag)
└── /ws/live-load      → WebSocket handler
```

### Exception Handling

Three-tier exception handling via custom middleware:
1. **`SQLAlchemyError`** → Database connection/query failures
2. **`ValueError`** → Invalid request parameters
3. **`Exception`** → Catch-all for unexpected errors

All handlers return structured JSON error responses with appropriate HTTP status codes.

---

<p align="center">
  <strong>GridWise</strong> · v1.0 · Built for BESCOM · AI for Bharat · May 2026
  <br/>
  <sub>Turning reactive grid management into proactive, data-driven planning.</sub>
</p>
