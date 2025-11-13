"""
Vessel enrichment queue service with retry mechanisms and exponential backoff.
"""

import asyncio
import time
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.models.vessel import Vessel, VesselEnrichmentQueue
from app.schemas.vessel import QueueStatsResponse
from app.logging_config import LoggerMixin, log_async_function_call, EnrichmentLogger
from app.services.enrichment import VesselEnrichmentService


class VesselEnrichmentQueueService(LoggerMixin):
    """
    Service for managing vessel enrichment queue with retry logic.
    Implements exponential backoff and batch processing.
    """
    
    def __init__(self):
        super().__init__()
        self.enrichment_service = VesselEnrichmentService()
        self.enrichment_logger = EnrichmentLogger()
        self.is_processing = False
        self.max_attempts = settings.max_retries
        self.retry_delay = settings.retry_delay_seconds
        
        self.logger.info(
            "queue_service_initialized",
            max_attempts=self.max_attempts,
            retry_delay=self.retry_delay,
            batch_size=settings.batch_size,
        )
    
    @log_async_function_call
    async def add_to_queue(self, mmsi: str, db_session: AsyncSession, priority: int = 0) -> bool:
        """
        Add a vessel to the enrichment queue.
        
        Args:
            mmsi: Maritime Mobile Service Identity
            priority: Queue priority (higher = more important)
            db_session: Database session
            
        Returns:
            True if added successfully, False if already in queue
        """
        try:
            # Check if already in queue
            existing = await db_session.execute(
                select(VesselEnrichmentQueue).where(
                    and_(
                        VesselEnrichmentQueue.mmsi == mmsi,
                        VesselEnrichmentQueue.status.in_(["pending", "processing"])
                    )
                )
            )
            existing_item = existing.scalar_one_or_none()
            
            if existing_item:
                self.logger.debug("vessel_already_in_queue", mmsi=mmsi)
                return False
            
            # Add to queue
            queue_item = VesselEnrichmentQueue(
                mmsi=mmsi,
                priority=priority,
                status="pending",
            )
            
            db_session.add(queue_item)
            await db_session.commit()
            
            self.logger.debug("vessel_added_to_queue", mmsi=mmsi, priority=priority)
            return True
            
        except Exception as e:
            self.logger.error(
                "failed_to_add_to_queue",
                mmsi=mmsi,
                error=str(e),
                error_type=type(e).__name__,
            )
            await db_session.rollback()
            return False
    
    @log_async_function_call
    async def add_many_to_queue(
        self,
        mmsi_list: List[str],
        db_session: AsyncSession,
        priority: int = 0
    ) -> int:
        """
        Add multiple vessels to queue in batches.
        
        Args:
            mmsi_list: List of MMSI numbers
            priority: Queue priority
            db_session: Database session
            
        Returns:
            Number of vessels successfully added
        """
        self.logger.info("adding_batch_to_queue", count=len(mmsi_list))
        
        added_count = 0
        batch_size = min(100, settings.batch_size)  # Process in smaller batches
        
        for i in range(0, len(mmsi_list), batch_size):
            batch = mmsi_list[i:i + batch_size]
            
            for mmsi in batch:
                if await self.add_to_queue(mmsi, priority, db_session):
                    added_count += 1
            
            # Small delay between batches to avoid overwhelming database
            if i + batch_size < len(mmsi_list):
                await asyncio.sleep(0.1)
        
        self.enrichment_logger.log_queue_operation(
            "add_many", added_count, {"batch_size": len(mmsi_list)}
        )
        
        return added_count
    
    @log_async_function_call
    async def queue_unenriched_vessels(
        self,
        db_session: AsyncSession,
        limit: Optional[int] = None
    ) -> int:
        """
        Queue all vessels that need enrichment.
        
        Args:
            limit: Maximum number of vessels to queue
            db_session: Database session
            
        Returns:
            Number of vessels queued
        """
        self.logger.info("queueing_unenriched_vessels", limit=limit)
        
        try:
            # Find vessels that need enrichment:
            # 1. Have never been enriched (enriched_at is null)
            # 2. Or haven't been enriched in 30 days
            # 3. Or had failed attempts but under max attempts
            import datetime
            thirty_days_ago = datetime.datetime.now() - datetime.timedelta(days=30)
            
            query = select(Vessel.mmsi).where(
                or_(
                    Vessel.enriched_at.is_(None),
                    Vessel.enriched_at < thirty_days_ago,
                    and_(
                        Vessel.enrichment_attempts < self.max_attempts,
                        Vessel.enrichment_error.isnot(None)
                    )
                )
            )
            
            if limit:
                query = query.limit(limit)
            
            result = await db_session.execute(query)
            mmsi_list = [row[0] for row in result.fetchall()]
            
            # Add to queue
            queued_count = await self.add_many_to_queue(mmsi_list, 0, db_session)
            
            self.enrichment_logger.log_queue_operation(
                "queue_unenriched", queued_count, {"limit": limit, "found": len(mmsi_list)}
            )
            
            return queued_count
            
        except Exception as e:
            self.logger.error(
                "failed_to_queue_unenriched",
                error=str(e),
                error_type=type(e).__name__,
            )
            return 0
    
    @log_async_function_call
    async def process_next(self, db_session: AsyncSession) -> bool:
        """
        Process the next item in the queue.
        
        Args:
            db_session: Database session
            
        Returns:
            True if an item was processed, False if queue is empty
        """
        if self.is_processing:
            return False
        
        self.is_processing = True
        
        try:
            # Get next pending item with highest priority
            result = await db_session.execute(
                select(VesselEnrichmentQueue)
                .where(
                    and_(
                        VesselEnrichmentQueue.status == "pending",
                        VesselEnrichmentQueue.attempts < self.max_attempts
                    )
                )
                .order_by(
                    VesselEnrichmentQueue.priority.desc(),
                    VesselEnrichmentQueue.created_at.asc()
                )
                .limit(1)
            )
            
            queue_item = result.scalar_one_or_none()
            if not queue_item:
                return False
            
            # Mark as processing
            await db_session.execute(
                update(VesselEnrichmentQueue)
                .where(VesselEnrichmentQueue.id == queue_item.id)
                .values(
                    status="processing",
                    last_attempt_at=time.time(),
                )
            )
            await db_session.commit()
            
            self.logger.debug("processing_queue_item", mmsi=queue_item.mmsi, queue_id=queue_item.id)
            
            # Attempt enrichment
            enrichment_result = await self.enrichment_service.enrich_vessel(
                queue_item.mmsi, db_session
            )
            
            if enrichment_result.success:
                # Success - mark as completed
                await db_session.execute(
                    update(VesselEnrichmentQueue)
                    .where(VesselEnrichmentQueue.id == queue_item.id)
                    .values(
                        status="completed",
                        error=None,
                    )
                )
                await db_session.commit()
                
                self.logger.info(
                    "queue_item_completed",
                    mmsi=queue_item.mmsi,
                    queue_id=queue_item.id,
                    source=enrichment_result.source,
                    fields_updated=len(enrichment_result.fields_updated),
                )
                
            else:
                # Failed - increment attempts
                new_attempts = queue_item.attempts + 1
                
                if new_attempts >= self.max_attempts:
                    # Max attempts reached
                    await db_session.execute(
                        update(VesselEnrichmentQueue)
                        .where(VesselEnrichmentQueue.id == queue_item.id)
                        .values(
                            status="failed",
                            attempts=new_attempts,
                            error=enrichment_result.error,
                        )
                    )
                    await db_session.commit()
                    
                    self.logger.warning(
                        "queue_item_failed_max_attempts",
                        mmsi=queue_item.mmsi,
                        queue_id=queue_item.id,
                        attempts=new_attempts,
                        error=enrichment_result.error,
                    )
                    
                else:
                    # Retry later with exponential backoff
                    retry_delay = self.retry_delay * (2 ** (new_attempts - 1))
                    
                    await db_session.execute(
                        update(VesselEnrichmentQueue)
                        .where(VesselEnrichmentQueue.id == queue_item.id)
                        .values(
                            status="pending",
                            attempts=new_attempts,
                            error=enrichment_result.error,
                        )
                    )
                    await db_session.commit()
                    
                    self.logger.debug(
                        "queue_item_scheduled_for_retry",
                        mmsi=queue_item.mmsi,
                        queue_id=queue_item.id,
                        attempts=new_attempts,
                        retry_delay_seconds=retry_delay,
                    )
            
            return True
            
        except Exception as e:
            self.logger.error(
                "queue_processing_error",
                error=str(e),
                error_type=type(e).__name__,
            )
            await db_session.rollback()
            return False
            
        finally:
            self.is_processing = False
    
    @log_async_function_call
    async def process_queue(self, db_session: AsyncSession, max_items: int = None) -> int:
        """
        Process multiple items from queue with rate limiting.
        
        Args:
            max_items: Maximum number of items to process
            db_session: Database session
            
        Returns:
            Number of items processed
        """
        if max_items is None:
            max_items = settings.batch_size
        
        self.logger.info("processing_queue_batch", max_items=max_items)
        
        processed_count = 0
        
        for i in range(max_items):
            processed = await self.process_next(db_session)
            if not processed:
                break
            
            processed_count += 1
            
            # Add delay between items to respect rate limits
            # VesselFinder rate limit is very conservative (1 req/min)
            if i < max_items - 1:
                await asyncio.sleep(65)  # 65 seconds between requests
        
        self.enrichment_logger.log_queue_operation(
            "process_batch", processed_count, {"max_items": max_items}
        )
        
        return processed_count
    
    @log_async_function_call
    async def cleanup_queue(self, db_session: AsyncSession, older_than_days: int = 7) -> int:
        """
        Clean up old completed/failed queue items.
        
        Args:
            older_than_days: Age threshold in days
            db_session: Database session
            
        Returns:
            Number of items cleaned up
        """
        import datetime
        cutoff_date = datetime.datetime.now() - datetime.timedelta(days=older_than_days)
        
        result = await db_session.execute(
            delete(VesselEnrichmentQueue)
            .where(
                and_(
                    VesselEnrichmentQueue.status.in_(["completed", "failed"]),
                    VesselEnrichmentQueue.updated_at < cutoff_date
                )
            )
        )
        
        cleaned_count = result.rowcount
        await db_session.commit()
        
        self.enrichment_logger.log_queue_operation(
            "cleanup", cleaned_count, {"older_than_days": older_than_days}
        )
        
        return cleaned_count
    
    @log_async_function_call
    async def get_queue_stats(self, db_session: AsyncSession) -> QueueStatsResponse:
        """
        Get queue statistics.
        
        Args:
            db_session: Database session
            
        Returns:
            Queue statistics
        """
        try:
            # Get counts by status
            pending_result = await db_session.execute(
                select(func.count(VesselEnrichmentQueue.id))
                .where(VesselEnrichmentQueue.status == "pending")
            )
            pending = pending_result.scalar()
            
            processing_result = await db_session.execute(
                select(func.count(VesselEnrichmentQueue.id))
                .where(VesselEnrichmentQueue.status == "processing")
            )
            processing = processing_result.scalar()
            
            completed_result = await db_session.execute(
                select(func.count(VesselEnrichmentQueue.id))
                .where(VesselEnrichmentQueue.status == "completed")
            )
            completed = completed_result.scalar()
            
            failed_result = await db_session.execute(
                select(func.count(VesselEnrichmentQueue.id))
                .where(VesselEnrichmentQueue.status == "failed")
            )
            failed = failed_result.scalar()
            
            total = pending + processing + completed + failed
            
            return QueueStatsResponse(
                pending=pending,
                processing=processing,
                completed=completed,
                failed=failed,
                total=total,
            )
            
        except Exception as e:
            self.logger.error(
                "failed_to_get_queue_stats",
                error=str(e),
                error_type=type(e).__name__,
            )
            return QueueStatsResponse(
                pending=0, processing=0, completed=0, failed=0, total=0
            )
    
    @log_async_function_call
    async def retry_failed(self, db_session: AsyncSession) -> int:
        """
        Reset failed items for retry.
        
        Args:
            db_session: Database session
            
        Returns:
            Number of items reset for retry
        """
        result = await db_session.execute(
            update(VesselEnrichmentQueue)
            .where(
                and_(
                    VesselEnrichmentQueue.status == "failed",
                    VesselEnrichmentQueue.attempts < self.max_attempts
                )
            )
            .values(
                status="pending",
                error=None,
            )
        )
        
        retried_count = result.rowcount
        await db_session.commit()
        
        self.enrichment_logger.log_queue_operation("retry_failed", retried_count)
        
        return retried_count