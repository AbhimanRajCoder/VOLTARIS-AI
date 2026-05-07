"""Infrastructure router — ML-powered clustering, GeoJSON, site detail."""

import time
import json
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.utils.db import get_db
from app.models.db_models import (
    InfraSiteCandidate as InfraSiteCandidateDB,
    Zone as ZoneDB,
    ZoneDemandForecast as ZoneDemandForecastDB,
)
from app.models.schemas import InfraSiteCandidate
from app.ml.clustering import clustering_service
from app.cache.redis_cache import (
    CACHE_TTL,
    build_cache_key,
    cache_get,
    cache_get_raw,
    cache_set,
    cache_ttl,
)

from geoalchemy2.functions import ST_AsGeoJSON

router = APIRouter()


@router.get("/zones")
def get_zone_boundaries(db: Session = Depends(get_db)):
    """Return GeoJSON FeatureCollection of all zone boundaries."""
    zones = db.query(
        ZoneDB.zone_id,
        ZoneDB.zone_name,
        ST_AsGeoJSON(ZoneDB.geom).label("geojson")
    ).all()

    features = []
    for zone in zones:
        if zone.geojson:
            features.append({
                "type": "Feature",
                "geometry": json.loads(zone.geojson),
                "properties": {
                    "zone_id": zone.zone_id,
                    "zone_name": zone.zone_name,
                },
            })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@router.get("/hotspots")
def get_hotspots(
    n_clusters: int = Query(default=5, ge=1, le=10, description="Number of clusters"),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Return K-Means clustered infrastructure sites as GeoJSON,
    plus a KDE density grid for heatmap rendering.
    """
    start = time.time()
    cache_key = build_cache_key("infra_hotspots", n_clusters=n_clusters)
    cached = cache_get_raw(cache_key)
    if cached is not None:
        ttl = cache_ttl(cache_key)
        return Response(
            content=cached,
            media_type="application/json",
            headers={
                "X-Cache": "HIT",
                "X-Cache-TTL": str(ttl if ttl > -1 else 0),
                "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
            },
        )

    result = clustering_service.get_hotspots(n_clusters=n_clusters)

    # Build GeoJSON FeatureCollection from cluster centroids
    features = []
    for cluster in result["clusters"]:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [cluster["centroid_lon"], cluster["centroid_lat"]],
            },
            "properties": {
                "site_id": cluster["top_site_id"],
                "ward_name": cluster["top_site_ward"],
                "composite_score": cluster["avg_composite_score"],
                "composite_rank": cluster["cluster_id"],
                "cluster_label": cluster["cluster_id"],
                "site_count": cluster["site_count"],
            },
        })

    payload = {
        "type": "FeatureCollection",
        "features": features,
        "kde_grid": result.get("kde_grid"),
    }
    cache_set(cache_key, payload, CACHE_TTL["infra_hotspots"])
    
    content = json.dumps(payload, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )


@router.get("/recommend", response_model=List[InfraSiteCandidate])
def get_recommendations(
    top_n: int = Query(default=10, ge=1, le=50, description="Max sites to return"),
    min_score: float = Query(default=0.0, ge=0.0, le=1.0, description="Minimum composite score"),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Return top-N infrastructure site candidates ranked by composite score."""
    start = time.time()
    cache_key = build_cache_key("infra_recommend", top_n=top_n, min_score=min_score)
    cached = cache_get_raw(cache_key)
    if cached is not None:
        ttl = cache_ttl(cache_key)
        return Response(
            content=cached,
            media_type="application/json",
            headers={
                "X-Cache": "HIT",
                "X-Cache-TTL": str(ttl if ttl > -1 else 0),
                "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
            },
        )

    sites = (
        db.query(InfraSiteCandidateDB)
        .filter(InfraSiteCandidateDB.composite_score >= min_score)
        .order_by(InfraSiteCandidateDB.composite_rank.asc())
        .limit(top_n)
        .all()
    )
    payload = [InfraSiteCandidate.model_validate(site).model_dump(mode="json") for site in sites]
    cache_set(cache_key, payload, CACHE_TTL["infra_recommend"])
    
    content = json.dumps(payload, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )


@router.get("/site/{site_id}")
def get_site_detail(
    site_id: str,
    db: Session = Depends(get_db),
    response: Response = None,
):
    """
    Return detailed information for a single infrastructure site,
    including average demand from the nearest zone and cluster info.
    """
    start = time.time()
    cache_key = build_cache_key("infra_site", site_id=site_id)
    cached = cache_get_raw(cache_key)
    if cached is not None:
        ttl = cache_ttl(cache_key)
        return Response(
            content=cached,
            media_type="application/json",
            headers={
                "X-Cache": "HIT",
                "X-Cache-TTL": str(ttl if ttl > -1 else 0),
                "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
            },
        )

    site = (
        db.query(InfraSiteCandidateDB)
        .filter(InfraSiteCandidateDB.site_id == site_id)
        .first()
    )
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_id} not found")

    # ── Find nearest zone ────────────────────────────────────────────────
    nearest_zone = db.query(ZoneDB).order_by(ZoneDB.zone_id.asc()).first()

    nearby_zone_avg_kw = 0.0
    if nearest_zone:
        avg = (
            db.query(func.avg(ZoneDemandForecastDB.predicted_kw))
            .filter(ZoneDemandForecastDB.zone_id == nearest_zone.zone_id)
            .scalar()
        )
        nearby_zone_avg_kw = round(float(avg), 2) if avg else 0.0

    # ── Cluster info ─────────────────────────────────────────────────────
    cluster_info = clustering_service.get_site_with_cluster(site_id)

    site_data = InfraSiteCandidate.model_validate(site).model_dump()
    site_data["nearby_zone_avg_kw"] = nearby_zone_avg_kw
    site_data["nearest_zone_id"] = nearest_zone.zone_id if nearest_zone else None
    if cluster_info:
        site_data["cluster_label"] = cluster_info["cluster_label"]

    cache_set(cache_key, site_data, CACHE_TTL["infra_site"])
    
    content = json.dumps(site_data, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "X-Cache": "MISS",
            "X-Response-Time": f"{(time.time() - start) * 1000:.0f}ms",
        }
    )
