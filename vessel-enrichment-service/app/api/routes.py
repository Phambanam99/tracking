"""
FastAPI routes for vessel enrichment service.
"""

import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import JSONResponse

from app.database import get_db
from app.schemas.vessel import (
    VesselEnrichmentRequest,
    VesselEnrichmentResponse,
    QueueStatsResponse,
    EnrichmentStatsResponse,
    HealthCheckResponse,
    QueueOperationResponse,
    SchedulerStatusResponse,
)
from app.services.enrichment import VesselEnrichmentService
from app.services.queue import VesselEnrichmentQueueService
from app.services.scheduler import VesselEnrichmentSchedulerService
from app.logging_config import RequestLogger, LoggerMixin
from app.database import check_db_health
from app.config import settings


router = APIRouter(prefix=settings.api_prefix, tags=["vessel-enrichment"])
request_logger = RequestLogger()


class APIController(LoggerMixin):
    """Main API controller with dependency injection."""
    
    def __init__(self):
        super().__init__()
        self.enrichment_service = VesselEnrichmentService()
        self.queue_service = VesselEnrichmentQueueService()
        # Scheduler will be initialized at app startup


# Global controller instance
api_controller = APIController()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Health check endpoint for monitoring.
    Returns service health status and component information.
    """
    start_time = time.time()
    
    try:
        # Check database health
        db_health = await check_db_health()
        
        # Check Redis health (if configured)
        redis_health = {"status": "not_configured"}
        if settings.redis_url and settings.redis_url != "redis://localhost:6379/0":
            try:
                import redis
                r = redis.from_url(settings.redis_url)
                r.ping()
                redis_health = {"status": "healthy"}
            except Exception as e:
                redis_health = {"status": "unhealthy", "error": str(e)}
        
        # Check scheduler status
        scheduler_health = {"status": "unknown"}
        # This will be populated when scheduler is integrated
        
        duration_ms = (time.time() - start_time) * 1000
        
        return HealthCheckResponse(
            status="healthy" if db_health["status"] == "healthy" else "unhealthy",
            timestamp=time.time(),
            version=settings.service_version,
            uptime_seconds=0,  # Will be updated by main app
            database=db_health,
            redis=redis_health,
            scheduler=scheduler_health,
        )
        
    except Exception as e:
        request_logger.log_error("GET", "/health", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=EnrichmentStatsResponse)
async def get_statistics():
    """
    Get enrichment statistics.
    Returns comprehensive statistics about vessel enrichment.
    """
    try:
        async for db_session in get_db():
            stats = await api_controller.enrichment_service.get_enrichment_statistics(db_session)
            return EnrichmentStatsResponse(**stats)
            break
    except Exception as e:
        request_logger.log_error("GET", "/stats", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enrich/{mmsi}", response_model=VesselEnrichmentResponse)
async def enrich_vessel(
    mmsi: str = Path(..., description="Maritime Mobile Service Identity"),
):
    """
    Enrich a single vessel immediately by MMSI.
    """
    try:
        async for db_session in get_db():
            result = await api_controller.enrichment_service.enrich_vessel(mmsi, db_session)
            return result
            break
    except Exception as e:
        request_logger.log_error("POST", f"/enrich/{mmsi}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue", response_model=QueueOperationResponse)
async def add_to_queue(request: VesselEnrichmentRequest):
    """
    Add vessel(s) to enrichment queue.
    Can add single vessel or multiple vessels.
    """
    try:
        async for db_session in get_db():
            if request.mmsi:
                # Add single vessel
                success = await api_controller.queue_service.add_to_queue(
                    request.mmsi, db_session, request.priority
                )
                count = 1 if success else 0
                message = f"Added {request.mmsi} to queue" if success else "Failed to add to queue"
                
            elif request.mmsi_list:
                # Add multiple vessels
                count = await api_controller.queue_service.add_many_to_queue(
                    request.mmsi_list, db_session, request.priority
                )
                message = f"Added {count} vessels to queue"
                
            else:
                message = "No MMSI provided"
                count = 0
            
            return QueueOperationResponse(message=message, count=count)
            break
            
    except Exception as e:
        request_logger.log_error("POST", "/queue", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/unenriched", response_model=QueueOperationResponse)
async def queue_unenriched(
    limit: Optional[int] = Query(None, description="Maximum number of vessels to queue"),
):
    """
    Queue all unenriched vessels.
    Automatically finds vessels that need enrichment and adds them to queue.
    """
    try:
        async for db_session in get_db():
            count = await api_controller.queue_service.queue_unenriched_vessels(
                db_session, limit
            )
            message = f"Queued {count} unenriched vessels"
            return QueueOperationResponse(message=message, count=count)
            break
            
    except Exception as e:
        request_logger.log_error("POST", "/queue/unenriched", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/process", response_model=QueueOperationResponse)
async def process_queue(
    max_items: Optional[int] = Query(10, description="Maximum number of items to process"),
):
    """
    Process queue manually.
    Processes items from the enrichment queue immediately.
    """
    try:
        async for db_session in get_db():
            count = await api_controller.queue_service.process_queue(db_session, max_items)
            message = f"Processed {count} items from queue"
            return QueueOperationResponse(message=message, count=count)
            break
            
    except Exception as e:
        request_logger.log_error("POST", "/queue/process", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/retry-failed", response_model=QueueOperationResponse)
async def retry_failed():
    """
    Retry failed enrichment items.
    Resets failed items for retry if they haven't exceeded max attempts.
    """
    try:
        async for db_session in get_db():
            count = await api_controller.queue_service.retry_failed(db_session)
            message = f"Reset {count} failed items for retry"
            return QueueOperationResponse(message=message, count=count)
            break
            
    except Exception as e:
        request_logger.log_error("POST", "/queue/retry-failed", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/cleanup", response_model=QueueOperationResponse)
async def cleanup_queue(
    days: Optional[int] = Query(7, description="Age threshold in days"),
):
    """
    Clean up old queue items.
    Removes completed/failed items older than specified days.
    """
    try:
        async for db_session in get_db():
            count = await api_controller.queue_service.cleanup_queue(db_session, days)
            message = f"Cleaned up {count} old queue items"
            return QueueOperationResponse(message=message, count=count)
            break
            
    except Exception as e:
        request_logger.log_error("POST", "/queue/cleanup", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats():
    """
    Get queue statistics.
    Returns current queue status and counts.
    """
    try:
        async for db_session in get_db():
            stats = await api_controller.queue_service.get_queue_stats(db_session)
            return stats
            break
            
    except Exception as e:
        request_logger.log_error("GET", "/queue/stats", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{mmsi}")
async def get_enrichment_history(
    mmsi: str = Path(..., description="Maritime Mobile Service Identity"),
    limit: Optional[int] = Query(20, description="Maximum number of records to return"),
):
    """
    Get enrichment history for a vessel.
    Returns historical enrichment attempts for the specified MMSI.
    """
    try:
        async for db_session in get_db():
            from app.models.vessel import VesselEnrichmentLog
            from sqlalchemy import select
            
            result = await db_session.execute(
                select(VesselEnrichmentLog)
                .where(VesselEnrichmentLog.mmsi == mmsi)
                .order_by(VesselEnrichmentLog.created_at.desc())
                .limit(limit)
            )
            
            logs = result.scalars().all()
            
            return {
                "mmsi": mmsi,
                "history": [
                    {
                        "id": log.id,
                        "source": log.source,
                        "success": log.success,
                        "fields_updated": log.fields_updated,
                        "error": log.error,
                        "duration": log.duration,
                        "created_at": log.created_at.isoformat(),
                    }
                    for log in logs
                ],
            }
            break
            
    except Exception as e:
        request_logger.log_error("GET", f"/history/{mmsi}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduler/{action}", response_model=QueueOperationResponse)
async def control_scheduler(
    action: str = Path(..., description="Action: enable or disable"),
):
    """
    Enable or disable the scheduler.
    Controls the automated enrichment scheduler.
    """
    if action not in ["enable", "disable"]:
        raise HTTPException(status_code=400, detail="Action must be 'enable' or 'disable'")
    
    try:
        enabled = action == "enable"
        # This will be implemented when scheduler is integrated
        message = f"Scheduler {action}d"
        
        return QueueOperationResponse(message=message, count=0)
        
    except Exception as e:
        request_logger.log_error("POST", f"/scheduler/{action}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduler/status", response_model=SchedulerStatusResponse)
async def get_scheduler_status():
    """
    Get scheduler status.
    Returns current scheduler configuration and status.
    """
    try:
        # This will be implemented when scheduler is integrated
        return SchedulerStatusResponse(
            enabled=settings.scheduler_enabled,
            uptime=0,  # Will be updated by main app
        )
        
    except Exception as e:
        request_logger.log_error("GET", "/scheduler/status", e)
        raise HTTPException(status_code=500, detail=str(e))


# Middleware for request logging
@router.middleware("http")
async def log_requests(request, call_next):
    """Middleware to log HTTP requests and responses."""
    start_time = time.time()
    
    request_logger.log_request(request.method, str(request.url))
    
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        
        request_logger.log_response(
            request.method, 
            str(request.url), 
            response.status_code, 
            duration_ms
        )
        
        return response
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        request_logger.log_error(request.method, str(request.url), e)
        raise