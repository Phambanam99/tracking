"""
Vessel enrichment scheduler service for automated processing.
"""

import asyncio
import time
from typing import Optional
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import get_db
from app.logging_config import LoggerMixin, log_async_function_call, EnrichmentLogger
from app.services.queue import VesselEnrichmentQueueService


class VesselEnrichmentSchedulerService(LoggerMixin):
    """
    Scheduler service for automated vessel enrichment.
    Runs 24/7 to continuously enrich vessel data.
    """
    
    def __init__(self):
        super().__init__()
        self.queue_service = VesselEnrichmentQueueService()
        self.enrichment_logger = EnrichmentLogger()
        self.scheduler = AsyncIOScheduler()
        self.is_enabled = settings.scheduler_enabled
        self.start_time = time.time()
        
        self.logger.info(
            "scheduler_service_initialized",
            enabled=self.is_enabled,
            enrichment_interval=settings.enrichment_interval_minutes,
            queue_check_interval=settings.queue_check_interval_minutes,
            cleanup_interval=settings.cleanup_interval_hours,
        )
    
    async def start(self) -> None:
        """Start the scheduler service."""
        if not self.is_enabled:
            self.logger.warning("scheduler_disabled", reason="SCHEDULER_ENABLED=false")
            return
        
        try:
            # Add scheduled jobs
            await self._setup_scheduled_jobs()
            
            # Start scheduler
            self.scheduler.start()
            
            self.logger.info(
                "scheduler_started",
                jobs_count=len(self.scheduler.get_jobs()),
                uptime_seconds=time.time() - self.start_time,
            )
            
            # Queue initial batch on startup
            await asyncio.sleep(10)  # Wait 10 seconds after startup
            await self._queue_unenriched_vessels()
            
        except Exception as e:
            self.logger.error(
                "scheduler_startup_failed",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise
    
    async def stop(self) -> None:
        """Stop the scheduler service."""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown(wait=True)
                self.logger.info("scheduler_stopped")
        except Exception as e:
            self.logger.error(
                "scheduler_shutdown_failed",
                error=str(e),
                error_type=type(e).__name__,
            )
    
    async def _setup_scheduled_jobs(self) -> None:
        """Setup all scheduled jobs."""
        
        # Process queue every N minutes
        self.scheduler.add_job(
            func=self._process_queue,
            trigger=IntervalTrigger(minutes=settings.enrichment_interval_minutes),
            id="process-enrichment-queue",
            name="Process Enrichment Queue",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,  # 5 minutes
        )
        
        # Queue unenriched vessels every N hours
        self.scheduler.add_job(
            func=self._queue_unenriched_vessels,
            trigger=IntervalTrigger(hours=settings.queue_check_interval_minutes // 60),
            id="queue-unenriched-vessels",
            name="Queue Unenriched Vessels",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=1800,  # 30 minutes
        )
        
        # Cleanup old queue items daily at 3 AM
        self.scheduler.add_job(
            func=self._cleanup_queue,
            trigger=CronTrigger(hour=3, minute=0),
            id="cleanup-enrichment-queue",
            name="Cleanup Enrichment Queue",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600,  # 1 hour
        )
        
        # Retry failed items every N hours
        self.scheduler.add_job(
            func=self._retry_failed,
            trigger=IntervalTrigger(hours=settings.queue_check_interval_minutes // 60),
            id="retry-failed-enrichments",
            name="Retry Failed Enrichments",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=1800,  # 30 minutes
        )
        
        # Log statistics every hour
        self.scheduler.add_job(
            func=self._log_statistics,
            trigger=IntervalTrigger(hours=1),
            id="log-enrichment-stats",
            name="Log Enrichment Statistics",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,  # 5 minutes
        )
    
    @log_async_function_call
    async def _process_queue(self) -> None:
        """Process enrichment queue - main worker job."""
        if not self.is_enabled:
            return
        
        self.logger.debug("starting_scheduled_queue_processing")
        
        try:
            async for db_session in get_db():
                # Process conservative number of items due to rate limits
                # VesselFinder: 1 req/min = 60 req/hour
                processed = await self.queue_service.process_queue(
                    db_session=db_session, 
                    max_items=2  # Very conservative
                )
                
                if processed > 0:
                    self.logger.info(
                        "scheduled_processing_completed",
                        vessels_processed=processed,
                        duration_minutes=settings.enrichment_interval_minutes,
                    )
                
                break  # Only use one session per job
                
        except Exception as e:
            self.logger.error(
                "scheduled_processing_error",
                error=str(e),
                error_type=type(e).__name__,
            )
    
    @log_async_function_call
    async def _queue_unenriched_vessels(self) -> None:
        """Queue unenriched vessels job."""
        if not self.is_enabled:
            return
        
        self.logger.debug("checking_unenriched_vessels")
        
        try:
            async for db_session in get_db():
                # Queue up to 50 vessels every check
                queued = await self.queue_service.queue_unenriched_vessels(
                    db_session=db_session, 
                    limit=50
                )
                
                if queued > 0:
                    self.logger.info(
                        "vessels_queued",
                        count=queued,
                        interval_hours=settings.queue_check_interval_minutes // 60,
                    )
                
                break
                
        except Exception as e:
            self.logger.error(
                "queueing_vessels_error",
                error=str(e),
                error_type=type(e).__name__,
            )
    
    @log_async_function_call
    async def _cleanup_queue(self) -> None:
        """Cleanup old queue items job."""
        if not self.is_enabled:
            return
        
        self.logger.debug("starting_queue_cleanup")
        
        try:
            async for db_session in get_db():
                # Remove items older than 7 days
                cleaned = await self.queue_service.cleanup_queue(
                    db_session=db_session, 
                    older_than_days=7
                )
                
                if cleaned > 0:
                    self.logger.info(
                        "queue_items_cleaned",
                        count=cleaned,
                        older_than_days=7,
                    )
                
                break
                
        except Exception as e:
            self.logger.error(
                "cleanup_error",
                error=str(e),
                error_type=type(e).__name__,
            )
    
    @log_async_function_call
    async def _retry_failed(self) -> None:
        """Retry failed enrichment items job."""
        if not self.is_enabled:
            return
        
        self.logger.debug("retrying_failed_enrichments")
        
        try:
            async for db_session in get_db():
                retried = await self.queue_service.retry_failed(db_session=db_session)
                
                if retried > 0:
                    self.logger.info(
                        "failed_items_retried",
                        count=retried,
                        interval_hours=settings.queue_check_interval_minutes // 60,
                    )
                
                break
                
        except Exception as e:
            self.logger.error(
                "retry_error",
                error=str(e),
                error_type=type(e).__name__,
            )
    
    @log_async_function_call
    async def _log_statistics(self) -> None:
        """Log enrichment statistics job."""
        if not self.is_enabled:
            return
        
        try:
            async for db_session in get_db():
                queue_stats = await self.queue_service.get_queue_stats(db_session=db_session)
                
                self.logger.info(
                    "queue_statistics",
                    pending=queue_stats.pending,
                    processing=queue_stats.processing,
                    completed=queue_stats.completed,
                    failed=queue_stats.failed,
                    total=queue_stats.total,
                    uptime_hours=(time.time() - self.start_time) / 3600,
                )
                
                break
                
        except Exception as e:
            self.logger.error(
                "statistics_error",
                error=str(e),
                error_type=type(e).__name__,
            )
    
    def set_enabled(self, enabled: bool) -> None:
        """
        Enable or disable the scheduler.
        
        Args:
            enabled: Whether to enable the scheduler
        """
        self.is_enabled = enabled
        
        if enabled:
            if not self.scheduler.running:
                asyncio.create_task(self.start())
        else:
            if self.scheduler.running:
                asyncio.create_task(self.stop())
        
        self.logger.info(
            "scheduler_status_changed",
            enabled=enabled,
            running=self.scheduler.running,
        )
    
    def get_status(self) -> dict:
        """
        Get scheduler status information.
        
        Returns:
            Dictionary with scheduler status
        """
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            })
        
        return {
            "enabled": self.is_enabled,
            "running": self.scheduler.running,
            "uptime_seconds": time.time() - self.start_time,
            "jobs": jobs,
        }