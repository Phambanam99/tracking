"""
Vessel-related database models.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, Text, ARRAY, Index
)
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base, TimestampMixin


class Vessel(Base, TimestampMixin):
    """Vessel model matching the main application schema."""
    
    __tablename__ = "vessels"
    
    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String, unique=True, nullable=False, index=True)
    vessel_name = Column(String, nullable=True)
    vessel_type = Column(String, nullable=True)
    flag = Column(String, nullable=True)
    operator = Column(String, nullable=True)
    length = Column(Integer, nullable=True)
    width = Column(Integer, nullable=True)
    imo = Column(String, nullable=True)
    call_sign = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    eta = Column(DateTime(timezone=True), nullable=True)
    draught = Column(Float, nullable=True)
    year_built = Column(Integer, nullable=True)
    gross_tonnage = Column(Integer, nullable=True)
    deadweight = Column(Integer, nullable=True)
    home_port = Column(String, nullable=True)
    owner = Column(String, nullable=True)
    manager = Column(String, nullable=True)
    classification = Column(String, nullable=True)
    
    # Enrichment tracking fields
    enriched_at = Column(DateTime(timezone=True), nullable=True)
    enrichment_source = Column(String, nullable=True)
    enrichment_attempts = Column(Integer, default=0)
    last_enrichment_attempt = Column(DateTime(timezone=True), nullable=True)
    enrichment_error = Column(Text, nullable=True)
    data_quality_score = Column(Float, nullable=True)
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_vessel_enriched_attempts', 'enriched_at', 'enrichment_attempts'),
        Index('idx_vessel_mmsi', 'mmsi'),
    )


class VesselEnrichmentQueue(Base, TimestampMixin):
    """Queue model for vessel enrichment tasks."""
    
    __tablename__ = "vessel_enrichment_queue"
    
    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String, nullable=False, index=True)
    priority = Column(Integer, default=0)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    attempts = Column(Integer, default=0)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
    
    # Indexes for efficient queue processing
    __table_args__ = (
        Index('idx_queue_status_priority_created', 'status', 'priority', 'created_at'),
        Index('idx_queue_mmsi', 'mmsi'),
    )


class VesselEnrichmentLog(Base, TimestampMixin):
    """Log model for vessel enrichment attempts."""
    
    __tablename__ = "vessel_enrichment_log"
    
    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String, nullable=False, index=True)
    source = Column(String, nullable=True)
    success = Column(Boolean, nullable=False)
    fields_updated = Column(ARRAY(String), nullable=True)
    error = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True)  # Duration in milliseconds
    
    # Indexes for querying logs
    __table_args__ = (
        Index('idx_log_mmsi_created', 'mmsi', 'created_at'),
        Index('idx_log_created', 'created_at'),
    )