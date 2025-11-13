"""
Pydantic schemas for vessel-related API models.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class VesselEnrichmentData(BaseModel):
    """Schema for vessel enrichment data from external sources."""
    
    mmsi: Optional[str] = None
    imo: Optional[str] = None
    vessel_name: Optional[str] = None
    vessel_type: Optional[str] = None
    flag: Optional[str] = None
    call_sign: Optional[str] = None
    length: Optional[int] = None
    width: Optional[float] = None
    draught: Optional[float] = None
    destination: Optional[str] = None
    eta: Optional[datetime] = None
    year_built: Optional[int] = None
    gross_tonnage: Optional[int] = None
    deadweight: Optional[int] = None
    home_port: Optional[str] = None
    owner: Optional[str] = None
    operator: Optional[str] = None
    manager: Optional[str] = None
    classification: Optional[str] = None
    image_url: Optional[str] = None
    data_quality_score: Optional[int] = None


class VesselEnrichmentRequest(BaseModel):
    """Request schema for vessel enrichment."""
    
    mmsi: Optional[str] = None
    mmsi_list: Optional[List[str]] = None
    priority: int = Field(default=0, ge=0, le=10)


class VesselEnrichmentResponse(BaseModel):
    """Response schema for vessel enrichment."""
    
    success: bool
    mmsi: str
    source: str
    fields_updated: List[str] = Field(default_factory=list)
    duration: int
    error: Optional[str] = None


class QueueStatsResponse(BaseModel):
    """Response schema for queue statistics."""
    
    pending: int
    processing: int
    completed: int
    failed: int
    total: int


class EnrichmentStatsResponse(BaseModel):
    """Response schema for enrichment statistics."""
    
    total_vessels: int
    enriched_vessels: int
    enrichment_percentage: float
    pending_queue: int
    last_24_hours: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    """Response schema for health check."""
    
    status: str
    timestamp: datetime
    version: str
    uptime_seconds: float
    database: Dict[str, Any]
    redis: Dict[str, Any]
    scheduler: Dict[str, Any]


class QueueOperationResponse(BaseModel):
    """Response schema for queue operations."""
    
    message: str
    count: int


class SchedulerStatusResponse(BaseModel):
    """Response schema for scheduler status."""
    
    enabled: bool
    uptime: float
    next_run: Optional[datetime] = None
    last_run: Optional[datetime] = None