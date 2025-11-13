"""
Vessel enrichment service - core business logic for enriching vessel data.
"""

import time
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_

from app.models.vessel import Vessel, VesselEnrichmentLog
from app.schemas.vessel import VesselEnrichmentData, VesselEnrichmentResponse
from app.data_sources import VesselFinderScraper
from app.logging_config import LoggerMixin, log_async_function_call, EnrichmentLogger


class VesselEnrichmentService(LoggerMixin):
    """
    Service for enriching vessel data from external sources.
    Implements retry logic, data validation, and logging.
    """
    
    def __init__(self):
        super().__init__()
        self.data_sources = [VesselFinderScraper()]
        self.enrichment_logger = EnrichmentLogger()
        
        self.logger.info(
            "vessel_enrichment_service_initialized",
            data_sources=[source.name for source in self.data_sources],
            rate_limits=[source.rate_limit for source in self.data_sources],
        )
    
    @log_async_function_call
    async def enrich_vessel(self, mmsi: str, db_session: AsyncSession) -> VesselEnrichmentResponse:
        """
        Enrich a single vessel by MMSI.
        
        Args:
            mmsi: Maritime Mobile Service Identity
            db_session: Database session
            
        Returns:
            VesselEnrichmentResponse with enrichment results
        """
        start_time = time.time()
        
        try:
            # Check if vessel exists in database
            vessel = await self._get_vessel_by_mmsi(mmsi, db_session)
            if not vessel:
                error_msg = f"Vessel {mmsi} not found in database"
                self.logger.warning("vessel_not_found", mmsi=mmsi)
                return VesselEnrichmentResponse(
                    success=False,
                    mmsi=mmsi,
                    source="database",
                    duration=int((time.time() - start_time) * 1000),
                    error=error_msg,
                )
            
            # Try each data source in priority order
            for source in self.data_sources:
                try:
                    self.enrichment_logger.log_enrichment_start(mmsi, source.name)
                    
                    # Check if source is available
                    if not await source.is_available():
                        self.logger.warning(
                            "data_source_unavailable",
                            source=source.name,
                            mmsi=mmsi,
                        )
                        continue
                    
                    # Fetch data from source
                    enrichment_data = await source.fetch_by_mmsi(mmsi)
                    if enrichment_data:
                        # Update vessel in database
                        fields_updated = await self._update_vessel_data(
                            vessel, enrichment_data, source.name, db_session
                        )
                        
                        duration = int((time.time() - start_time) * 1000)
                        
                        # Log successful enrichment
                        await self._log_enrichment(
                            mmsi, source.name, True, fields_updated, None, duration, db_session
                        )
                        
                        self.enrichment_logger.log_enrichment_success(
                            mmsi, source.name, fields_updated, duration
                        )
                        
                        return VesselEnrichmentResponse(
                            success=True,
                            mmsi=mmsi,
                            source=source.name,
                            fields_updated=fields_updated,
                            duration=duration,
                        )
                    else:
                        self.logger.debug(
                            "no_data_found",
                            source=source.name,
                            mmsi=mmsi,
                        )
                        
                except Exception as e:
                    self.logger.error(
                        "source_fetch_error",
                        source=source.name,
                        mmsi=mmsi,
                        error=str(e),
                        error_type=type(e).__name__,
                    )
                    continue
            
            # No data source succeeded
            duration = int((time.time() - start_time) * 1000)
            error_msg = "No data found from any source"
            
            await self._log_enrichment(
                mmsi, "all", False, [], error_msg, duration, db_session
            )
            
            self.enrichment_logger.log_enrichment_failure(mmsi, "all", error_msg, duration)
            
            return VesselEnrichmentResponse(
                success=False,
                mmsi=mmsi,
                source="none",
                duration=duration,
                error=error_msg,
            )
            
        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            self.logger.error(
                "enrichment_failed",
                mmsi=mmsi,
                error=error_msg,
                error_type=type(e).__name__,
                duration=duration,
            )
            
            return VesselEnrichmentResponse(
                success=False,
                mmsi=mmsi,
                source="error",
                duration=duration,
                error=error_msg,
            )
    
    async def _get_vessel_by_mmsi(self, mmsi: str, db_session: AsyncSession) -> Optional[Vessel]:
        """Get vessel from database by MMSI."""
        result = await db_session.execute(
            select(Vessel).where(Vessel.mmsi == mmsi)
        )
        return result.scalar_one_or_none()
    
    async def _update_vessel_data(
        self,
        vessel: Vessel,
        enrichment_data: VesselEnrichmentData,
        source: str,
        db_session: AsyncSession
    ) -> List[str]:
        """
        Update vessel data in database with enrichment data.
        
        Args:
            vessel: Existing vessel record
            enrichment_data: New data from external source
            source: Data source name
            db_session: Database session
            
        Returns:
            List of field names that were updated
        """
        fields_updated = []
        
        # Prepare update data - only update if new value is provided and different
        update_data = {
            "enriched_at": time.time(),
            "enrichment_source": source,
            "enrichment_attempts": vessel.enrichment_attempts + 1,
            "last_enrichment_attempt": time.time(),
            "enrichment_error": None,
        }
        
        # Field mapping from enrichment data to database fields
        field_mapping = {
            "vessel_name": "vessel_name",
            "vessel_type": "vessel_type",
            "flag": "flag",
            "imo": "imo",
            "call_sign": "call_sign",
            "operator": "operator",
            "length": "length",
            "width": "width",
            "draught": "draught",
            "destination": "destination",
            "year_built": "year_built",
            "gross_tonnage": "gross_tonnage",
            "deadweight": "deadweight",
            "home_port": "home_port",
            "owner": "owner",
            "manager": "manager",
            "classification": "classification",
            "data_quality_score": "data_quality_score",
        }
        
        # Update fields only if they have meaningful values and are different
        for data_key, db_key in field_mapping.items():
            new_value = getattr(enrichment_data, data_key, None)
            if new_value is not None and new_value != "" and new_value != "Unknown":
                current_value = getattr(vessel, db_key, None)
                if current_value != new_value:
                    update_data[db_key] = new_value
                    fields_updated.append(db_key)
        
        # Update vessel if there are changes
        if fields_updated or "enrichment_attempts" in update_data:
            await db_session.execute(
                update(Vessel)
                .where(Vessel.id == vessel.id)
                .values(update_data)
            )
            await db_session.commit()
            
            self.logger.info(
                "vessel_updated",
                mmsi=vessel.mmsi,
                source=source,
                fields_updated=fields_updated,
                total_fields=len(fields_updated),
            )
        
        return fields_updated
    
    async def _log_enrichment(
        self,
        mmsi: str,
        source: str,
        success: bool,
        fields_updated: List[str],
        error: Optional[str],
        duration: int,
        db_session: AsyncSession
    ) -> None:
        """Log enrichment attempt to database."""
        try:
            log_entry = VesselEnrichmentLog(
                mmsi=mmsi,
                source=source,
                success=success,
                fields_updated=fields_updated,
                error=error,
                duration=duration,
            )
            
            db_session.add(log_entry)
            await db_session.commit()
            
        except Exception as e:
            self.logger.error(
                "failed_to_log_enrichment",
                mmsi=mmsi,
                source=source,
                error=str(e),
                error_type=type(e).__name__,
            )
    
    async def get_enrichment_statistics(self, db_session: AsyncSession) -> Dict[str, Any]:
        """
        Get enrichment statistics.
        
        Args:
            db_session: Database session
            
        Returns:
            Dictionary with enrichment statistics
        """
        try:
            # Get total vessels count
            total_vessels_result = await db_session.execute(select(Vessel))
            total_vessels = len(total_vessels_result.scalars().all())
            
            # Get enriched vessels count
            enriched_vessels_result = await db_session.execute(
                select(Vessel).where(Vessel.enriched_at.isnot(None))
            )
            enriched_vessels = len(enriched_vessels_result.scalars().all())
            
            # Get pending queue count
            from app.models.vessel import VesselEnrichmentQueue
            pending_queue_result = await db_session.execute(
                select(VesselEnrichmentQueue).where(VesselEnrichmentQueue.status == "pending")
            )
            pending_queue = len(pending_queue_result.scalars().all())
            
            # Get recent logs (last 24 hours)
            import datetime
            twenty_four_hours_ago = datetime.datetime.now() - datetime.timedelta(hours=24)
            
            recent_logs_result = await db_session.execute(
                select(VesselEnrichmentLog).where(
                    VesselEnrichmentLog.created_at >= twenty_four_hours_ago
                )
            )
            recent_logs = recent_logs_result.scalars().all()
            
            # Calculate statistics
            success_count = sum(1 for log in recent_logs if log.success)
            avg_duration = (
                sum(log.duration or 0 for log in recent_logs) / len(recent_logs)
                if recent_logs else 0
            )
            
            return {
                "total_vessels": total_vessels,
                "enriched_vessels": enriched_vessels,
                "enrichment_percentage": (
                    (enriched_vessels / total_vessels * 100) if total_vessels > 0 else 0
                ),
                "pending_queue": pending_queue,
                "last_24_hours": {
                    "attempts": len(recent_logs),
                    "successes": success_count,
                    "failures": len(recent_logs) - success_count,
                    "success_rate": (
                        (success_count / len(recent_logs) * 100) if recent_logs else 0
                    ),
                    "avg_duration": round(avg_duration),
                },
            }
            
        except Exception as e:
            self.logger.error(
                "failed_to_get_statistics",
                error=str(e),
                error_type=type(e).__name__,
            )
            return {}