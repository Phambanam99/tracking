"""
Main application entry point for vessel enrichment service.
"""

import asyncio
import signal
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, close_db
from app.logging_config import configure_logging
from app.api.routes import router
from app.services.scheduler import VesselEnrichmentSchedulerService
from app.metrics import metrics_collector


# Configure logging
configure_logging()
import structlog
logger = structlog.get_logger(__name__)

# Global scheduler instance
scheduler_service = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    global scheduler_service
    
    logger.info("application_startup", version=settings.service_version)
    
    try:
        # Initialize database
        await init_db()
        logger.info("database_initialized")
        
        # Start metrics server
        metrics_collector.start_metrics_server()
        
        # Initialize and start scheduler
        scheduler_service = VesselEnrichmentSchedulerService()
        await scheduler_service.start()
        
        # Update metrics
        metrics_collector.update_scheduler_status(scheduler_service.is_enabled)
        
        logger.info(
            "application_ready",
            api_host=settings.api_host,
            api_port=settings.api_port,
            scheduler_enabled=scheduler_service.is_enabled,
            metrics_enabled=settings.metrics_enabled,
        )
        
        yield
        
    except Exception as e:
        logger.error(
            "application_startup_failed",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise
    
    finally:
        # Shutdown
        logger.info("application_shutdown_start")
        
        try:
            # Stop scheduler
            if scheduler_service:
                await scheduler_service.stop()
                logger.info("scheduler_stopped")
            
            # Close database connections
            await close_db()
            logger.info("database_closed")
            
            logger.info("application_shutdown_complete")
            
        except Exception as e:
            logger.error(
                "application_shutdown_error",
                error=str(e),
                error_type=type(e).__name__,
            )


# Create FastAPI application
app = FastAPI(
    title="Vessel Enrichment Service",
    description="A robust, containerized Python service for continuous 24/7 vessel enrichment data processing",
    version=settings.service_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)


# Request middleware for metrics
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Middleware to collect HTTP request metrics."""
    start_time = time.time()
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Record metrics
        metrics_collector.record_http_request(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
            duration=duration,
        )
        
        return response
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        metrics_collector.record_http_request(
            method=request.method,
            endpoint=request.url.path,
            status=500,
            duration=duration,
        )
        
        raise


# Health check endpoint (simplified for load balancers)
@app.get("/healthz")
async def simple_health_check():
    """Simple health check for load balancers."""
    return {"status": "ok"}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "status": "running",
        "timestamp": time.time(),
        "endpoints": {
            "health": "/health",
            "healthz": "/healthz",
            "metrics": f"/metrics" if settings.metrics_enabled else None,
            "docs": "/docs" if settings.debug else None,
            "api": settings.api_prefix,
        }
    }


# Signal handlers for graceful shutdown
def signal_handler(signum, frame):
    """Handle shutdown signals."""
    logger.info("shutdown_signal_received", signal=signum)
    
    # Trigger graceful shutdown
    raise KeyboardInterrupt()


# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


def main():
    """Main entry point for the application."""
    try:
        logger.info(
            "starting_vessel_enrichment_service",
            host=settings.api_host,
            port=settings.api_port,
            debug=settings.debug,
            workers=1,  # Single worker for queue processing
        )
        
        # Run with uvicorn
        uvicorn.run(
            "app.main:app",
            host=settings.api_host,
            port=settings.api_port,
            log_level=settings.log_level.lower(),
            reload=settings.debug,
            access_log=True,
            use_colors=settings.debug,
            # Single worker to avoid queue processing conflicts
            workers=1,
        )
        
    except KeyboardInterrupt:
        logger.info("application_interrupted")
    except Exception as e:
        logger.error(
            "application_failed",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise


if __name__ == "__main__":
    main()