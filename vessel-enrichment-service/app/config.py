"""
Configuration management for vessel enrichment service.
Uses environment variables for all configuration.
"""

from typing import Optional
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Service configuration
    service_name: str = Field(default="vessel-enrichment-service", env="SERVICE_NAME")
    service_version: str = Field(default="1.0.0", env="SERVICE_VERSION")
    debug: bool = Field(default=False, env="DEBUG")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    
    # API configuration
    api_host: str = Field(default="0.0.0.0", env="API_HOST")
    api_port: int = Field(default=8000, env="API_PORT")
    api_prefix: str = Field(default="/api/v1", env="API_PREFIX")
    
    # Database configuration
    database_url: str = Field(..., env="DATABASE_URL")
    database_pool_size: int = Field(default=10, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=20, env="DATABASE_MAX_OVERFLOW")
    database_pool_timeout: int = Field(default=30, env="DATABASE_POOL_TIMEOUT")
    database_pool_recycle: int = Field(default=3600, env="DATABASE_POOL_RECYCLE")
    
    # Redis configuration for task queue
    redis_url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    redis_max_connections: int = Field(default=20, env="REDIS_MAX_CONNECTIONS")
    
    # Task queue configuration
    queue_name: str = Field(default="vessel_enrichment", env="QUEUE_NAME")
    max_retries: int = Field(default=3, env="MAX_RETRIES")
    retry_delay_seconds: int = Field(default=60, env="RETRY_DELAY_SECONDS")
    batch_size: int = Field(default=100, env="BATCH_SIZE")
    
    # Rate limiting configuration
    vesselfinder_rate_limit: int = Field(default=1, env="VESSELFINDER_RATE_LIMIT")
    vesselfinder_timeout_seconds: int = Field(default=15, env="VESSELFINDER_TIMEOUT_SECONDS")
    
    # Scheduler configuration
    scheduler_enabled: bool = Field(default=True, env="SCHEDULER_ENABLED")
    enrichment_interval_minutes: int = Field(default=10, env="ENRICHMENT_INTERVAL_MINUTES")
    queue_check_interval_minutes: int = Field(default=6, env="QUEUE_CHECK_INTERVAL_MINUTES")
    cleanup_interval_hours: int = Field(default=24, env="CLEANUP_INTERVAL_HOURS")
    
    # Health check configuration
    health_check_interval_seconds: int = Field(default=30, env="HEALTH_CHECK_INTERVAL_SECONDS")
    
    # Metrics configuration
    metrics_enabled: bool = Field(default=True, env="METRICS_ENABLED")
    metrics_port: int = Field(default=9090, env="METRICS_PORT")
    
    # Graceful shutdown configuration
    shutdown_timeout_seconds: int = Field(default=30, env="SHUTDOWN_TIMEOUT_SECONDS")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()