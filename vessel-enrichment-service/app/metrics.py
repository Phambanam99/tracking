"""
Prometheus metrics integration for vessel enrichment service.
"""

import time
from typing import Dict, Any
from prometheus_client import Counter, Histogram, Gauge, Info, start_http_server
from prometheus_client.core import CollectorRegistry

from app.config import settings
from app.logging_config import LoggerMixin


class MetricsCollector(LoggerMixin):
    """
    Prometheus metrics collector for vessel enrichment service.
    Tracks performance, queue status, and enrichment statistics.
    """
    
    def __init__(self):
        super().__init__()
        
        # Create custom registry
        self.registry = CollectorRegistry()
        
        # Service info
        self.service_info = Info(
            'vessel_enrichment_service_info',
            'Information about vessel enrichment service',
            registry=self.registry
        )
        
        # Counters
        self.enrichment_requests_total = Counter(
            'vessel_enrichment_requests_total',
            'Total number of enrichment requests',
            ['source', 'status'],
            registry=self.registry
        )
        
        self.queue_operations_total = Counter(
            'queue_operations_total',
            'Total number of queue operations',
            ['operation'],
            registry=self.registry
        )
        
        self.http_requests_total = Counter(
            'http_requests_total',
            'Total number of HTTP requests',
            ['method', 'endpoint', 'status'],
            registry=self.registry
        )
        
        # Histograms
        self.enrichment_duration = Histogram(
            'vessel_enrichment_duration_seconds',
            'Time spent on vessel enrichment',
            ['source'],
            buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
            registry=self.registry
        )
        
        self.http_request_duration = Histogram(
            'http_request_duration_seconds',
            'Time spent on HTTP requests',
            ['method', 'endpoint'],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
            registry=self.registry
        )
        
        # Gauges
        self.queue_size = Gauge(
            'queue_size',
            'Current queue size',
            ['status'],
            registry=self.registry
        )
        
        self.active_connections = Gauge(
            'active_connections',
            'Number of active database connections',
            registry=self.registry
        )
        
        self.scheduler_status = Gauge(
            'scheduler_status',
            'Scheduler status (1=enabled, 0=disabled)',
            registry=self.registry
        )
        
        self.last_successful_enrichment = Gauge(
            'last_successful_enrichment_timestamp',
            'Timestamp of last successful enrichment',
            registry=self.registry
        )
        
        # Initialize service info
        self.service_info.info({
            'version': settings.service_version,
            'environment': 'development' if settings.debug else 'production',
        })
        
        self.logger.info(
            "metrics_collector_initialized",
            metrics_enabled=settings.metrics_enabled,
            metrics_port=settings.metrics_port,
        )
    
    def start_metrics_server(self) -> None:
        """Start Prometheus metrics HTTP server."""
        if not settings.metrics_enabled:
            self.logger.info("metrics_server_disabled")
            return
        
        try:
            start_http_server(settings.metrics_port, registry=self.registry)
            self.logger.info(
                "metrics_server_started",
                port=settings.metrics_port,
                endpoint=f"http://localhost:{settings.metrics_port}/metrics"
            )
        except Exception as e:
            self.logger.error(
                "metrics_server_failed",
                error=str(e),
                error_type=type(e).__name__,
            )
    
    def record_enrichment_request(
        self, 
        source: str, 
        status: str, 
        duration: float
    ) -> None:
        """Record enrichment request metrics."""
        self.enrichment_requests_total.labels(source=source, status=status).inc()
        self.enrichment_duration.labels(source=source).observe(duration)
        
        if status == 'success':
            self.last_successful_enrichment.set(time.time())
    
    def record_queue_operation(self, operation: str, count: int) -> None:
        """Record queue operation metrics."""
        self.queue_operations_total.labels(operation=operation).inc(count)
    
    def record_http_request(
        self, 
        method: str, 
        endpoint: str, 
        status: int, 
        duration: float
    ) -> None:
        """Record HTTP request metrics."""
        self.http_requests_total.labels(
            method=method, 
            endpoint=endpoint, 
            status=str(status)
        ).inc()
        self.http_request_duration.labels(
            method=method, 
            endpoint=endpoint
        ).observe(duration)
    
    def update_queue_metrics(self, queue_stats: Dict[str, int]) -> None:
        """Update queue size metrics."""
        for status, count in queue_stats.items():
            self.queue_size.labels(status=status).set(count)
    
    def update_connection_metrics(self, active: int) -> None:
        """Update database connection metrics."""
        self.active_connections.set(active)
    
    def update_scheduler_status(self, enabled: bool) -> None:
        """Update scheduler status metrics."""
        self.scheduler_status.set(1 if enabled else 0)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of current metrics."""
        try:
            # This would require accessing the underlying metric values
            # For now, return a basic summary
            return {
                "service_info": {
                    "version": settings.service_version,
                    "environment": 'development' if settings.debug else 'production',
                },
                "metrics_enabled": settings.metrics_enabled,
                "metrics_port": settings.metrics_port if settings.metrics_enabled else None,
            }
        except Exception as e:
            self.logger.error(
                "failed_to_get_metrics_summary",
                error=str(e),
                error_type=type(e).__name__,
            )
            return {}


# Global metrics collector instance
metrics_collector = MetricsCollector()