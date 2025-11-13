# Vessel Enrichment Service - Architecture Documentation

## 📋 Overview

Vessel Enrichment Service là một microservice Python độc lập được thiết kế để xử lý làm giàu dữ liệu tàu thuyền (vessel enrichment) liên tục 24/7. Service hoạt động độc lập với backend chính và sử dụng architecture hiện đại với các best practices về reliability, scalability, và observability.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Vessel Enrichment Service                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   API       │  │  Scheduler  │  │   Metrics   │ │
│  │   Layer     │  │   Service   │  │  Collector  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                   │                   │         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Queue     │    │ Enrichment │    │   Data      │ │
│  │  Service    │    │  Service    │    │  Sources    │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                   │                   │         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Database Layer                   │ │
│  │  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │ PostgreSQL  │  │    Redis    │  │ │
│  │  │ (Primary)  │  │  (Cache)   │  │ │
│  │  └─────────────┘  └─────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Component Architecture

### 1. API Layer (`app/api/`)

**Purpose**: HTTP interface cho external communication

**Components**:

- **FastAPI Application**: Modern async web framework
- **Route Handlers**: RESTful endpoints cho vessel operations
- **Middleware**: Request logging, CORS, metrics collection
- **Dependency Injection**: Database session management

**Key Features**:

- Auto-documentation với OpenAPI/Swagger
- Request validation với Pydantic
- Structured error handling
- Health check endpoints

### 2. Business Logic Layer (`app/services/`)

**Purpose**: Core business logic và orchestration

**Components**:

- **EnrichmentService**: Core vessel enrichment logic
- **QueueService**: Queue management và processing
- **SchedulerService**: Automated task scheduling

**Key Features**:

- Retry logic với exponential backoff
- Rate limiting implementation
- Batch processing optimization
- Error handling và recovery

### 3. Data Access Layer (`app/database.py`, `app/models/`)

**Purpose**: Database operations và connection management

**Components**:

- **Connection Pooling**: Async SQLAlchemy với connection pooling
- **Models**: SQLAlchemy ORM models
- **Migrations**: Database schema management
- **Health Checks**: Database connectivity monitoring

**Key Features**:

- Async database operations
- Connection pool management
- Transaction handling
- Query optimization

### 4. External Data Sources (`app/data_sources/`)

**Purpose**: Integration với external vessel data providers

**Components**:

- **Base Class**: Abstract interface cho data sources
- **VesselFinder Scraper**: Web scraping implementation
- **Rate Limiting**: Built-in rate limiting
- **Error Handling**: Exponential backoff

**Key Features**:

- Pluggable architecture
- Rate limiting respect
- Error recovery
- Data validation

### 5. Observability Layer (`app/logging_config.py`, `app/metrics.py`)

**Purpose**: Monitoring, logging, và metrics collection

**Components**:

- **Structured Logging**: JSON logging với context
- **Prometheus Metrics**: Performance và business metrics
- **Health Checks**: Component health monitoring
- **Request Tracing**: Request lifecycle tracking

## 🔄 Data Flow

### Enrichment Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Vessel    │    │    Queue    │    │  Scheduler  │
│   Request   │───▶│   Service    │───▶│   Service   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │ Enrichment │    │   Data      │
                   │  Service    │───▶│  Sources    │
                   └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────────────────────────┐
                   │        Database            │
                   │  ┌─────────────┐          │
                   │  │ PostgreSQL  │          │
                   │  │ (Primary)  │          │
                   │  └─────────────┘          │
                   └─────────────────────────────────┘
```

### Queue Processing Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Queue     │    │   Rate      │    │   Retry     │
│   Check     │───▶│   Limit     │───▶│   Logic     │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │  Batch      │    │  Error      │
                   │ Processing  │    │ Handling    │
                   └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────────────────────────┐
                   │        Database            │
                   │  ┌─────────────┐          │
                   │  │ PostgreSQL  │          │
                   │  │ (Primary)  │          │
                   │  └─────────────┘          │
                   └─────────────────────────────────┘
```

## 🗄️ Database Schema

### Core Tables

#### Vessels

```sql
vessels (
    id SERIAL PRIMARY KEY,
    mmsi VARCHAR UNIQUE,
    vessel_name VARCHAR,
    vessel_type VARCHAR,
    flag VARCHAR,
    -- ... other vessel fields
    enriched_at TIMESTAMP,
    enrichment_source VARCHAR,
    enrichment_attempts INTEGER DEFAULT 0,
    last_enrichment_attempt TIMESTAMP,
    enrichment_error TEXT,
    data_quality_score FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Vessel Enrichment Queue

```sql
vessel_enrichment_queue (
    id SERIAL PRIMARY KEY,
    mmsi VARCHAR NOT NULL,
    priority INTEGER DEFAULT 0,
    status VARCHAR DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Vessel Enrichment Log

```sql
vessel_enrichment_log (
    id SERIAL PRIMARY KEY,
    mmsi VARCHAR NOT NULL,
    source VARCHAR,
    success BOOLEAN NOT NULL,
    fields_updated TEXT[],
    error TEXT,
    duration INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
)
```

### Indexes

- `idx_vessel_enriched_attempts`: `(enriched_at, enrichment_attempts)`
- `idx_vessel_mmsi`: `(mmsi)`
- `idx_queue_status_priority_created`: `(status, priority, created_at)`
- `idx_queue_mmsi`: `(mmsi)`
- `idx_log_mmsi_created`: `(mmsi, created_at)`
- `idx_log_created`: `(created_at)`

## 🔒 Security Architecture

### Container Security

1. **Non-root User**: Service chạy với `vesseluser`
2. **Minimal Base Image**: Python slim image
3. **Multi-stage Build**: Reduce attack surface
4. **Read-only Filesystem**: Except cho logs directory

### Application Security

1. **Environment Variables**: Sensitive data qua env vars
2. **CORS Configuration**: Configurable CORS middleware
3. **Input Validation**: Pydantic schema validation
4. **SQL Injection Prevention**: SQLAlchemy ORM
5. **Rate Limiting**: Built-in rate limiting

### Network Security

1. **Internal Network**: Docker network isolation
2. **Port Exposure**: Only necessary ports
3. **Health Checks**: Container health monitoring
4. **Resource Limits**: CPU và memory limits

## 📊 Monitoring Architecture

### Logging Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                  Structured Logging                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Service   │  │   Request   │  │   Error     │ │
│  │   Logs     │  │   Logs      │  │   Logs      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                   │                   │         │
│         ▼                   ▼                   ▼         │
│  ┌─────────────────────────────────────────────────┐ │
│  │           JSON Output                 │ │
│  │  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │   File      │  │   Stdout    │  │ │
│  │  │   Logs      │  │   Logs      │  │ │
│  │  └─────────────┘  └─────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Metrics Collection

```
┌─────────────────────────────────────────────────────────────┐
│                Prometheus Metrics                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Business  │  │ Performance │  │   System    │ │
│  │  Metrics    │  │   Metrics    │  │   Metrics    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                   │                   │         │
│         ▼                   ▼                   ▼         │
│  ┌─────────────────────────────────────────────────┐ │
│  │          HTTP Endpoint                 │ │
│  │  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │   /metrics  │  │   /health   │  │ │
│  │  └─────────────┘  └─────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 🚀 Deployment Architecture

### Container Orchestration

```
┌─────────────────────────────────────────────────────────────┐
│                Docker Compose                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Service   │  │  Database   │  │    Cache    │ │
│  │ Container  │  │ Container  │  │ Container  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                   │                   │         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ Monitoring  │    │   Reverse   │    │   Network   │ │
│  │   Stack     │    │   Proxy     │    │   Layer    │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Service Dependencies

```
vessel-enrichment-service
├── postgres:5432 (Database)
├── redis:6379 (Cache/Queue)
├── prometheus:9090 (Metrics Collection)
├── grafana:3000 (Visualization)
└── nginx:80/443 (Reverse Proxy)
```

## 🔧 Configuration Management

### Environment-based Configuration

- **Development**: `.env.development`
- **Production**: `.env.production`
- **Testing**: `.env.testing`

### Configuration Hierarchy

1. Environment Variables (highest priority)
2. `.env` file
3. Default values in code

### Key Configuration Areas

1. **Database**: Connection pooling, timeouts
2. **External APIs**: Rate limits, timeouts
3. **Scheduler**: Intervals, batch sizes
4. **Monitoring**: Metrics, logging levels
5. **Security**: CORS, authentication

## 🔄 Reliability Patterns

### Retry Logic

```python
# Exponential backoff with jitter
delay = base_delay * (2 ** attempt) + random_jitter
max_delay = 300  # 5 minutes
```

### Circuit Breaker Pattern

- **Failure Threshold**: 5 consecutive failures
- **Timeout**: 30 seconds
- **Recovery**: Gradual recovery with monitoring

### Graceful Degradation

- **Rate Limiting**: Automatic backoff on errors
- **Queue Pausing**: Stop processing on database issues
- **Health Checks**: Component health monitoring

## 📈 Performance Optimization

### Database Optimization

1. **Connection Pooling**: 10 base + 20 overflow
2. **Batch Operations**: Minimize round trips
3. **Index Strategy**: Optimized query patterns
4. **Query Optimization**: Efficient SQL queries

### Memory Management

1. **Container Limits**: 512MB RAM limit
2. **Redis Limits**: 256MB max memory
3. **Garbage Collection**: Python GC tuning
4. **Resource Monitoring**: Prometheus metrics

### Rate Limiting

1. **VesselFinder**: 1 req/min (conservative)
2. **Backoff Strategy**: Exponential with jitter
3. **Queue Throttling**: Batch processing limits
4. **Global Limits**: System-wide rate limits

## 🧪 Testing Strategy

### Unit Testing

- **Service Layer**: Mock external dependencies
- **Data Sources**: Mock HTTP responses
- **Database**: In-memory SQLite
- **Configuration**: Test environment variables

### Integration Testing

- **API Endpoints**: Full request/response cycle
- **Database Operations**: Real PostgreSQL test
- **External APIs**: Mock server responses
- **Queue Processing**: End-to-end flow testing

### Load Testing

- **Concurrent Requests**: Multiple API calls
- **Queue Processing**: High volume scenarios
- **Database Load**: Connection pool stress
- **Memory Usage**: Resource consumption testing

## 🔮 Future Enhancements

### Scalability

1. **Horizontal Scaling**: Multiple service instances
2. **Queue Partitioning**: Distributed queue processing
3. **Database Sharding**: Read replicas for scaling
4. **Caching Layer**: Redis clustering

### Features

1. **Additional Data Sources**: More vessel APIs
2. **Machine Learning**: Data quality prediction
3. **Real-time Updates**: WebSocket notifications
4. **Advanced Analytics**: Pattern detection

### Operations

1. **Auto-scaling**: Kubernetes integration
2. **Blue-green Deployment**: Zero-downtime updates
3. **Disaster Recovery**: Multi-region deployment
4. **Backup Strategy**: Automated backups

## 📚 Technology Stack

### Core Technologies

- **Python 3.11**: Modern async/await support
- **FastAPI**: High-performance async web framework
- **SQLAlchemy**: Advanced ORM with async support
- **PostgreSQL**: Reliable relational database
- **Redis**: High-performance caching

### Monitoring & Observability

- **Prometheus**: Industry-standard metrics
- **Grafana**: Visualization and alerting
- **Structured Logging**: JSON-based logging
- **Health Checks**: Component monitoring

### Deployment & Operations

- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **Nginx**: Reverse proxy and load balancing
- **Environment Variables**: 12-factor app configuration

## 🎯 Design Principles

1. **Reliability First**: Error handling và recovery
2. **Observability**: Comprehensive monitoring
3. **Scalability**: Designed for horizontal scaling
4. **Security**: Defense-in-depth approach
5. **Performance**: Optimized for high throughput
6. **Maintainability**: Clean code và documentation
7. **Testability**: Comprehensive test coverage
