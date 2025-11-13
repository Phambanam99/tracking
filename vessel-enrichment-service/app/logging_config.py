"""
Structured JSON logging configuration for vessel enrichment service.
"""

import sys
import logging
import structlog
from typing import Any, Dict
from datetime import datetime

from app.config import settings


def configure_logging() -> None:
    """
    Configure structured JSON logging for application.
    """
    
    # Configure structlog
    structlog.configure(
        processors=[
            # Add timestamp
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            # Add service information
            add_service_info,
            # JSON renderer for production
            structlog.processors.JSONRenderer() if not settings.debug 
            else structlog.dev.ConsoleRenderer(colors=True),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level.upper()),
    )
    
    # Set specific loggers
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.debug else logging.WARNING
    )
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def add_service_info(logger, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add service information to log records.
    """
    event_dict.update({
        "service": settings.service_name,
        "version": settings.service_version,
        "environment": "development" if settings.debug else "production",
    })
    return event_dict


class LoggerMixin:
    """
    Mixin class to add structured logging capabilities.
    """
    
    @property
    def logger(self):
        """Get structured logger for the class."""
        return structlog.get_logger(self.__class__.__name__)


def log_function_call(func):
    """
    Decorator to log function calls with parameters and execution time.
    """
    import functools
    import time
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        logger = structlog.get_logger(func.__module__)
        start_time = time.time()
        
        # Log function call
        logger.info(
            "function_called",
            function=func.__name__,
            args_count=len(args),
            kwargs=list(kwargs.keys()),
        )
        
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            logger.info(
                "function_completed",
                function=func.__name__,
                execution_time_seconds=execution_time,
                success=True,
            )
            
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            
            logger.error(
                "function_failed",
                function=func.__name__,
                execution_time_seconds=execution_time,
                error=str(e),
                error_type=type(e).__name__,
            )
            
            raise
    
    return wrapper


async def log_async_function_call(func):
    """
    Decorator to log async function calls with parameters and execution time.
    """
    import functools
    import time
    
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        logger = structlog.get_logger(func.__module__)
        start_time = time.time()
        
        # Log function call
        logger.info(
            "async_function_called",
            function=func.__name__,
            args_count=len(args),
            kwargs=list(kwargs.keys()),
        )
        
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            logger.info(
                "async_function_completed",
                function=func.__name__,
                execution_time_seconds=execution_time,
                success=True,
            )
            
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            
            logger.error(
                "async_function_failed",
                function=func.__name__,
                execution_time_seconds=execution_time,
                error=str(e),
                error_type=type(e).__name__,
            )
            
            raise
    
    return wrapper


class RequestLogger:
    """
    Logger for HTTP requests and responses.
    """
    
    def __init__(self):
        self.logger = structlog.get_logger("http_requests")
    
    def log_request(self, method: str, url: str, headers: Dict[str, str] = None):
        """Log incoming HTTP request."""
        self.logger.info(
            "http_request_received",
            method=method,
            url=url,
            headers=headers or {},
        )
    
    def log_response(self, method: str, url: str, status_code: int, duration_ms: float):
        """Log HTTP response."""
        self.logger.info(
            "http_response_sent",
            method=method,
            url=url,
            status_code=status_code,
            duration_ms=duration_ms,
        )
    
    def log_error(self, method: str, url: str, error: Exception):
        """Log HTTP error."""
        self.logger.error(
            "http_request_error",
            method=method,
            url=url,
            error=str(error),
            error_type=type(error).__name__,
        )


class DatabaseLogger:
    """
    Logger for database operations.
    """
    
    def __init__(self):
        self.logger = structlog.get_logger("database")
    
    def log_query(self, query: str, params: Dict[str, Any] = None, duration_ms: float = None):
        """Log database query."""
        self.logger.info(
            "database_query_executed",
            query=query[:200] + "..." if len(query) > 200 else query,
            params=params or {},
            duration_ms=duration_ms,
        )
    
    def log_error(self, operation: str, error: Exception):
        """Log database error."""
        self.logger.error(
            "database_operation_failed",
            operation=operation,
            error=str(error),
            error_type=type(error).__name__,
        )


class EnrichmentLogger:
    """
    Logger for vessel enrichment operations.
    """
    
    def __init__(self):
        self.logger = structlog.get_logger("enrichment")
    
    def log_enrichment_start(self, mmsi: str, source: str):
        """Log enrichment start."""
        self.logger.info(
            "vessel_enrichment_started",
            mmsi=mmsi,
            source=source,
        )
    
    def log_enrichment_success(self, mmsi: str, source: str, fields_updated: list, duration_ms: float):
        """Log successful enrichment."""
        self.logger.info(
            "vessel_enrichment_completed",
            mmsi=mmsi,
            source=source,
            fields_updated=fields_updated,
            duration_ms=duration_ms,
            success=True,
        )
    
    def log_enrichment_failure(self, mmsi: str, source: str, error: str, duration_ms: float):
        """Log enrichment failure."""
        self.logger.error(
            "vessel_enrichment_failed",
            mmsi=mmsi,
            source=source,
            error=error,
            duration_ms=duration_ms,
            success=False,
        )
    
    def log_queue_operation(self, operation: str, count: int, details: Dict[str, Any] = None):
        """Log queue operations."""
        self.logger.info(
            "queue_operation",
            operation=operation,
            count=count,
            details=details or {},
        )
