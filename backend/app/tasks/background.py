"""Background tasks for periodic grid monitoring."""

from __future__ import annotations

import uuid
from asyncio import sleep
from datetime import datetime

from sqlalchemy import func

from app.cache.redis_cache import cache_flush_pattern
from app.models.db_models import GridAlert, ZoneDemandForecast
from app.services.deflect import (
    build_community_alert_payloads,
    compute_matured_deflection_events,
    fire_partner_webhook,
    mark_zone_alert_fired,
    now_utc,
    record_deflection_event_fired,
    zone_is_on_cooldown,
)
from app.utils.db import SessionLocal


async def monitor_grid_alerts() -> None:
    """Create unresolved alerts for zones that breach configured thresholds.

    Connection discipline: open a session, do all work, close it,
    *then* sleep.  This ensures zero connections are held during the
    60-second idle period between cycles.
    """
    while True:
        db = SessionLocal()
        try:
            latest = (
                db.query(
                    ZoneDemandForecast.zone_id,
                    func.max(ZoneDemandForecast.timestamp).label("latest_ts"),
                )
                .group_by(ZoneDemandForecast.zone_id)
                .all()
            )

            for zone_id, latest_ts in latest:
                row = (
                    db.query(ZoneDemandForecast)
                    .filter(
                        ZoneDemandForecast.zone_id == zone_id,
                        ZoneDemandForecast.timestamp == latest_ts,
                    )
                    .first()
                )
                if not row:
                    continue

                load_pct = (row.predicted_kw / 750.0) * 100.0
                severity = None
                message = None
                action = None

                if load_pct > 100:
                    severity = "CRITICAL"
                    message = f"Zone {zone_id}: load at {load_pct:.1f}% of transformer capacity"
                    action = "Immediately defer EV charging in this zone"
                elif load_pct > 85:
                    severity = "WARNING"
                    message = f"Zone {zone_id}: load at {load_pct:.1f}% - approaching capacity"
                    action = "Recommend shifting EV charging to post-11 PM"

                if not severity:
                    # Soft-Deflect auto-community alert for >85% load with cooldown.
                    if load_pct > 85 and not zone_is_on_cooldown(zone_id):
                        payloads = build_community_alert_payloads(db, zone_id)
                        if payloads:
                            payload = max(payloads, key=lambda item: item["grid_load_pct"])
                            await fire_partner_webhook(payload)
                            fired_at = now_utc()
                            record_deflection_event_fired(
                                db,
                                zone_id=zone_id,
                                fired_at=fired_at,
                                predicted_kw=payload["predicted_peak_kw"],
                            )
                            mark_zone_alert_fired(zone_id, fired_at)
                            print(f"Soft-Deflect: Webhook fired for zone {zone_id}")
                    continue

                existing = (
                    db.query(GridAlert)
                    .filter(
                        GridAlert.zone_id == zone_id,
                        GridAlert.severity == severity,
                        GridAlert.resolved.is_(False),
                    )
                    .first()
                )

                if existing:
                    continue

                db.add(
                    GridAlert(
                        alert_id=uuid.uuid4(),
                        zone_id=zone_id,
                        severity=severity,
                        triggered_at=datetime.utcnow(),
                        message=message,
                        recommended_action=action,
                        acknowledged=False,
                        resolved=False,
                    )
                )
                db.commit()
                cache_flush_pattern("grid_alerts")

                # Fire Soft-Deflect webhook in parallel to alert creation on threshold breach.
                if load_pct > 85 and not zone_is_on_cooldown(zone_id):
                    payloads = build_community_alert_payloads(db, zone_id)
                    if payloads:
                        payload = max(payloads, key=lambda item: item["grid_load_pct"])
                        await fire_partner_webhook(payload)
                        fired_at = now_utc()
                        record_deflection_event_fired(
                            db,
                            zone_id=zone_id,
                            fired_at=fired_at,
                            predicted_kw=payload["predicted_peak_kw"],
                        )
                        mark_zone_alert_fired(zone_id, fired_at)
                        print(f"Soft-Deflect: Webhook fired for zone {zone_id}")

            computed = compute_matured_deflection_events(db)
            if computed:
                print(f"Soft-Deflect: Computed impact for {computed} matured event(s)")
        except Exception as exc:
            print(f"Alert monitor error: {exc}")
        finally:
            # ✔ Always return the connection to the pool before sleeping.
            # This is the critical fix: the 60-second sleep must never hold
            # an open connection; that would waste 1/15 of Supabase's cap.
            db.close()

        # Sleep with NO connection held.
        await sleep(60)
