"""
Base class for vessel data sources.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from datetime import datetime

from app.schemas.vessel import VesselEnrichmentData


class VesselDataSource(ABC):
    """
    Abstract base class for vessel data sources.
    All data sources must implement this interface.
    """
    
    def __init__(self, name: str, priority: int = 1, rate_limit: int = 1):
        """
        Initialize data source.
        
        Args:
            name: Human-readable name of the data source
            priority: Priority for trying this source (lower number = higher priority)
            rate_limit: Maximum requests per minute
        """
        self.name = name
        self.priority = priority
        self.rate_limit = rate_limit
        self.last_request_time = 0
        self.consecutive_errors = 0
        self.min_delay = (60 * 1000) // rate_limit  # milliseconds between requests
    
    @abstractmethod
    async def fetch_by_mmsi(self, mmsi: str) -> Optional[VesselEnrichmentData]:
        """
        Fetch vessel information by MMSI.
        
        Args:
            mmsi: Maritime Mobile Service Identity
            
        Returns:
            VesselEnrichmentData if found, None otherwise
        """
        pass
    
    async def fetch_by_imo(self, imo: str) -> Optional[VesselEnrichmentData]:
        """
        Fetch vessel information by IMO number.
        Optional method - not all sources support IMO lookup.
        
        Args:
            imo: IMO number
            
        Returns:
            VesselEnrichmentData if found, None otherwise
        """
        return None
    
    @abstractmethod
    async def is_available(self) -> bool:
        """
        Check if the data source is available.
        
        Returns:
            True if available, False otherwise
        """
        pass
    
    async def respect_rate_limit(self) -> None:
        """
        Implement rate limiting by waiting between requests.
        """
        import time
        
        now = int(time.time() * 1000)  # Current time in milliseconds
        time_since_last_request = now - self.last_request_time
        
        if time_since_last_request < self.min_delay:
            wait_time = self.min_delay - time_since_last_request
            await asyncio.sleep(wait_time / 1000.0)
        
        self.last_request_time = int(time.time() * 1000)
    
    def calculate_quality_score(self, data: Dict[str, Any]) -> int:
        """
        Calculate data quality score based on available fields.
        
        Args:
            data: Dictionary containing vessel data
            
        Returns:
            Quality score from 0-100
        """
        important_fields = [
            'mmsi', 'imo', 'vessel_name', 'vessel_type', 'flag',
            'call_sign', 'length', 'width', 'year_built', 'gross_tonnage'
        ]
        
        score = 0
        for field in important_fields:
            if data.get(field) and str(data[field]).strip() and str(data[field]) != 'Unknown':
                score += 10
        
        return min(100, score)
    
    def handle_error(self, error: Exception) -> None:
        """
        Handle errors from data source requests.
        Implements exponential backoff for consecutive errors.
        """
        self.consecutive_errors += 1
        
        # Log error with context
        import structlog
        logger = structlog.get_logger(self.__class__.__name__)
        
        logger.error(
            "data_source_error",
            source=self.name,
            error=str(error),
            error_type=type(error).__name__,
            consecutive_errors=self.consecutive_errors,
        )
    
    def reset_error_counter(self) -> None:
        """Reset consecutive error counter after successful request."""
        self.consecutive_errors = 0
    
    async def get_backoff_delay(self) -> float:
        """
        Calculate exponential backoff delay based on consecutive errors.
        
        Returns:
            Delay in seconds
        """
        if self.consecutive_errors <= 2:
            return 0.0
        
        # Exponential backoff: 2^(n-2) * base_delay, max 5 minutes
        base_delay = 30  # 30 seconds
        max_delay = 300  # 5 minutes
        
        delay = min(max_delay, base_delay * (2 ** (self.consecutive_errors - 2)))
        return delay