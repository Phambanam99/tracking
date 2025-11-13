"""
Database connection and session management with connection pooling.
"""

import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
import structlog

from app.config import settings
from app.models.base import Base

logger = structlog.get_logger(__name__)

# Create async engine with connection pooling
engine = create_async_engine(
    settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_timeout=settings.database_pool_timeout,
    pool_recycle=settings.database_pool_recycle,
    echo=settings.debug,
    future=True,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get database session.
    Implements proper connection pooling and cleanup.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error("Database session error", error=str(e))
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database tables.
    This should be called on application startup.
    """
    try:
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise


async def close_db() -> None:
    """
    Close database connections.
    This should be called on application shutdown.
    """
    try:
        await engine.dispose()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error("Error closing database connections", error=str(e))


async def check_db_health() -> dict:
    """
    Check database health and connectivity.
    Returns health status information.
    """
    try:
        async with AsyncSessionLocal() as session:
            # Simple query to check connectivity
            result = await session.execute("SELECT 1 as health_check")
            row = result.fetchone()
            
            if row and row[0] == 1:
                return {
                    "status": "healthy",
                    "message": "Database connection successful",
                    "pool_size": engine.pool.size(),
                    "checked_in": engine.pool.checkedin(),
                    "checked_out": engine.pool.checkedout(),
                }
            else:
                return {
                    "status": "unhealthy",
                    "message": "Database query failed",
                }
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}",
        }


class DatabaseManager:
    """
    Database manager class for handling database operations.
    Provides connection pooling and transaction management.
    """
    
    def __init__(self):
        self.engine = engine
        self.session_factory = AsyncSessionLocal
    
    async def execute_query(self, query: str, params: dict = None):
        """Execute a raw SQL query with parameters."""
        async with self.session_factory() as session:
            try:
                result = await session.execute(query, params or {})
                await session.commit()
                return result
            except Exception as e:
                await session.rollback()
                logger.error("Query execution failed", query=query, params=params, error=str(e))
                raise
    
    async def execute_batch(self, queries: list):
        """Execute multiple queries in a batch."""
        async with self.session_factory() as session:
            try:
                for query, params in queries:
                    await session.execute(query, params or {})
                await session.commit()
                logger.info("Batch query executed successfully", count=len(queries))
            except Exception as e:
                await session.rollback()
                logger.error("Batch query execution failed", error=str(e))
                raise
    
    async def get_connection_info(self) -> dict:
        """Get connection pool information."""
        return {
            "pool_size": self.engine.pool.size(),
            "checked_in": self.engine.pool.checkedin(),
            "checked_out": self.engine.pool.checkedout(),
            "overflow": self.engine.pool.overflow(),
        }


# Global database manager instance
db_manager = DatabaseManager()