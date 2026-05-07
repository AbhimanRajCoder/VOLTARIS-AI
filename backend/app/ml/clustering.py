"""K-Means clustering + KDE hotspot detection on infra site candidates."""

import time
import logging
from typing import Optional

import numpy as np
from sklearn.cluster import KMeans
from scipy.stats import gaussian_kde

from app.utils.db import SessionLocal
from app.models.db_models import InfraSiteCandidate as InfraSiteCandidateDB

logger = logging.getLogger(__name__)

CACHE_TTL = 900  # 15 minutes


class ClusteringService:
    """K-Means + KDE clustering with in-memory cache."""

    def __init__(self):
        self._cache: dict = {}
        self._cache_ts: float = 0.0

    def _is_cache_valid(self, key: str) -> bool:
        return (
            key in self._cache
            and (time.time() - self._cache_ts) < CACHE_TTL
        )

    def _load_sites(self) -> list:
        db = SessionLocal()
        try:
            return db.query(InfraSiteCandidateDB).all()
        finally:
            db.close()

    # ── main method ──────────────────────────────────────────────────────
    def get_hotspots(self, n_clusters: int = 5) -> dict:
        cache_key = f"hotspots_{n_clusters}"
        if self._is_cache_valid(cache_key):
            logger.debug("Returning cached clustering result")
            return self._cache[cache_key]

        sites = self._load_sites()
        if not sites:
            return {"clusters": [], "kde_grid": None}

        coords = np.array([[s.lat, s.lon] for s in sites])
        scores = np.array([s.composite_score for s in sites])
        site_ids = [s.site_id for s in sites]
        ward_names = [s.ward_name for s in sites]
 
        # ── K-Means ─────────────────────────────────────────────────────
        kmeans = KMeans(n_clusters=min(n_clusters, len(sites)), random_state=42, n_init=10)
        labels = kmeans.fit_predict(coords)
 
        clusters = []
        for cid in range(kmeans.n_clusters):
            mask = labels == cid
            cluster_scores = scores[mask]
            cluster_site_ids = [site_ids[i] for i, m in enumerate(mask) if m]
            cluster_wards = [ward_names[i] for i, m in enumerate(mask) if m]
            
            best_idx = int(np.argmax(cluster_scores))
 
            clusters.append({
                "cluster_id": cid + 1,
                "centroid_lat": round(float(kmeans.cluster_centers_[cid][0]), 4),
                "centroid_lon": round(float(kmeans.cluster_centers_[cid][1]), 4),
                "site_count": int(mask.sum()),
                "avg_composite_score": round(float(cluster_scores.mean()), 4),
                "top_site_id": cluster_site_ids[best_idx],
                "top_site_ward": cluster_wards[best_idx],
            })

        # ── KDE ──────────────────────────────────────────────────────────
        kde_grid = self._compute_kde(coords)

        result = {"clusters": clusters, "kde_grid": kde_grid}

        # cache
        self._cache[cache_key] = result
        self._cache_ts = time.time()

        return result

    def _compute_kde(self, coords: np.ndarray) -> dict:
        """Compute KDE density on a 50×50 grid over Bengaluru bounds."""
        lats = np.linspace(12.8, 13.2, 50)
        lons = np.linspace(77.4, 77.8, 50)
        lon_grid, lat_grid = np.meshgrid(lons, lats)
        positions = np.vstack([lat_grid.ravel(), lon_grid.ravel()])

        try:
            kde = gaussian_kde(coords.T)
            density = kde(positions).reshape(50, 50)
        except Exception as e:
            logger.warning("KDE computation failed: %s", e)
            density = np.zeros((50, 50))

        return {
            "lats": [round(v, 4) for v in lats.tolist()],
            "lons": [round(v, 4) for v in lons.tolist()],
            "density": [[round(v, 8) for v in row] for row in density.tolist()],
        }

    def get_site_with_cluster(self, site_id: str) -> Optional[dict]:
        """Return site data enriched with cluster label and rank."""
        db = SessionLocal()
        try:
            site = (
                db.query(InfraSiteCandidateDB)
                .filter(InfraSiteCandidateDB.site_id == site_id)
                .first()
            )
            if not site:
                return None

            # Get all sites to compute cluster
            all_sites = db.query(InfraSiteCandidateDB).all()
            coords = np.array([[s.lat, s.lon] for s in all_sites])
            kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
            labels = kmeans.fit_predict(coords)

            site_idx = next(
                i for i, s in enumerate(all_sites) if s.site_id == site_id
            )
            cluster_label = int(labels[site_idx]) + 1

            return {
                "site_id": site.site_id,
                "lat": site.lat,
                "lon": site.lon,
                "ward_name": site.ward_name,
                "composite_score": site.composite_score,
                "composite_rank": site.composite_rank,
                "cluster_label": cluster_label,
            }
        finally:
            db.close()


# Singleton
clustering_service = ClusteringService()
