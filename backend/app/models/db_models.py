from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
import uuid

Base = declarative_base()

class Zone(Base):
    __tablename__ = "zones"
    
    zone_id = Column(String, primary_key=True)
    zone_name = Column(String, nullable=False)
    transformer_capacity_kw = Column(Float, nullable=False)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)

    demand_forecasts = relationship("ZoneDemandForecast", back_populates="zone")
    recommendations = relationship("ChargingRecommendation", back_populates="zone")
    alerts = relationship("GridAlert", back_populates="zone")
    deflection_events = relationship("DeflectionEvent", back_populates="zone")

class ZoneDemandForecast(Base):
    __tablename__ = "zone_demand_forecast"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(String, ForeignKey("zones.zone_id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    predicted_kw = Column(Float, nullable=False)
    ev_share_pct = Column(Float, nullable=False)
    confidence_lo = Column(Float, nullable=False)
    confidence_hi = Column(Float, nullable=False)
    model_version = Column(String, default="v1.0")
    created_at = Column(DateTime, server_default=func.now())

    zone = relationship("Zone", back_populates="demand_forecasts")

class ChargingRecommendation(Base):
    __tablename__ = "charging_recommendation"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(String, ForeignKey("zones.zone_id"), nullable=False)
    hour_slot = Column(Integer, nullable=False)
    action = Column(String, nullable=False)  # Maps to ActionEnum
    grid_load_pct = Column(Float, nullable=False)
    optimal_window = Column(String, nullable=True)
    reason = Column(String, nullable=False)
    expected_delta_kw = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    zone = relationship("Zone", back_populates="recommendations")

class InfraSiteCandidate(Base):
    __tablename__ = "infra_site_candidate"
    
    site_id = Column(String, primary_key=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    ward_name = Column(String, nullable=False)
    demand_score = Column(Float, nullable=False)
    gap_score = Column(Float, nullable=False)
    transformer_score = Column(Float, nullable=False)
    access_score = Column(Float, nullable=False)
    composite_rank = Column(Integer, nullable=False)
    composite_score = Column(Float, nullable=False)
    nearest_transformer_id = Column(String, nullable=False)
    existing_chargers_500m = Column(Integer, nullable=False)

class GridAlert(Base):
    __tablename__ = "grid_alert"
    
    alert_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(String, ForeignKey("zones.zone_id"), nullable=False)
    severity = Column(String, nullable=False)  # Maps to SeverityEnum
    triggered_at = Column(DateTime, server_default=func.now())
    message = Column(String, nullable=False)
    recommended_action = Column(String, nullable=True)
    acknowledged = Column(Boolean, default=False)
    resolved = Column(Boolean, default=False)

    zone = relationship("Zone", back_populates="alerts")


class DeflectionEvent(Base):
    __tablename__ = "deflection_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(String, ForeignKey("zones.zone_id"), nullable=False)
    fired_at = Column(DateTime, nullable=False, server_default=func.now())
    predicted_kw = Column(Float, nullable=False)
    actual_kw = Column(Float, nullable=True)
    deflected_kw = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="PENDING_EVAL")
    created_at = Column(DateTime, server_default=func.now())

    zone = relationship("Zone", back_populates="deflection_events")
