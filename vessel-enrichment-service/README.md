# Vessel Enrichment Service

Một dịch vụ Python độc lập, containerized để xử lý làm giàu dữ liệu tàu thuyền liên tục 24/7. Dịch vụ này hoạt động độc lập với backend chính và được thiết kế để giảm thiểu tải cơ sở dữ liệu thông qua xử lý theo lô.

## 🚀 Tính năng

- **Xử lý độc lập**: Hoạt động 24/7 độc lập với ứng dụng chính
- **Connection Pooling**: Quản lý kết nối database hiệu quả với connection pooling
- **Retry với Exponential Backoff**: Xử lý lỗi thông minh với cơ chế retry tự động
- **Logging có cấu trúc**: JSON logging với structured output cho monitoring
- **Health Check Endpoints**: Endpoints kiểm tra sức khỏe cho monitoring
- **Prometheus Metrics**: Tích hợp metrics cho monitoring và alerting
- **Graceful Shutdown**: Xử lý shutdown signals một cách an toàn
- **Task Queuing**: Hệ thống queue cho xử lý jobs
- **Rate Limiting**: Tôn trọng rate limits của external APIs
- **Batch Processing**: Xử lý theo lô để giảm tải database
- **Containerized**: Docker deployment với docker-compose

## 📋 Yêu cầu

- Python 3.11+
- PostgreSQL 13+ với PostGIS
- Redis 6+
- Docker & Docker Compose

## 🛠️ Cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd vessel-enrichment-service
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Chỉnh sửa .env với cấu hình phù hợp
```

### 3. Chạy với Docker Compose

```bash
# Chạy tất cả services
docker-compose up -d

# Chạy với monitoring
docker-compose --profile monitoring up -d

# Chạy với production nginx
docker-compose --profile production up -d
```

### 4. Chạy local development

```bash
# Install dependencies
pip install -r requirements.txt

# Chạy service
python -m app.main
```

## 🔧 Cấu hình

### Environment Variables

| Variable                  | Mặc định                   | Mô tả                                  |
| ------------------------- | -------------------------- | -------------------------------------- |
| `DATABASE_URL`            | -                          | PostgreSQL connection string           |
| `REDIS_URL`               | `redis://localhost:6379/0` | Redis connection string                |
| `SCHEDULER_ENABLED`       | `true`                     | Bật/tắt scheduler                      |
| `VESSELFINDER_RATE_LIMIT` | `1`                        | Rate limit cho VesselFinder (req/phút) |
| `METRICS_ENABLED`         | `true`                     | Bật/tắt Prometheus metrics             |
| `LOG_LEVEL`               | `INFO`                     | Logging level                          |

Xem `.env.example` cho đầy đủ các options.

## 📊 Monitoring

### Health Checks

- **Service Health**: `GET /health`
- **Simple Health**: `GET /healthz` (cho load balancers)

### Metrics

- **Prometheus**: `http://localhost:9090/metrics`
- **Grafana**: `http://localhost:3000` (admin/admin123)

### Logs

Logs được output dưới dạng JSON structured:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "service": "vessel-enrichment-service",
  "message": "vessel_enrichment_completed",
  "mmsi": "123456789",
  "source": "VesselFinder",
  "duration_ms": 1500
}
```

## 🚀 API Endpoints

### Enrichment

#### Enrich single vessel

```http
POST /api/v1/enrich/{mmsi}
```

#### Add to queue

```http
POST /api/v1/queue
Content-Type: application/json

{
  "mmsi": "123456789",
  "priority": 1
}
```

#### Queue unenriched vessels

```http
POST /api/v1/queue/unenriched?limit=50
```

### Queue Management

#### Process queue manually

```http
POST /api/v1/queue/process?max_items=10
```

#### Retry failed items

```http
POST /api/v1/queue/retry-failed
```

#### Cleanup old items

```http
POST /api/v1/queue/cleanup?days=7
```

### Statistics

#### Get enrichment statistics

```http
GET /api/v1/stats
```

#### Get queue statistics

```http
GET /api/v1/queue/stats
```

#### Get vessel history

```http
GET /api/v1/history/{mmsi}?limit=20
```

### Scheduler Control

#### Enable/disable scheduler

```http
POST /api/v1/scheduler/{action}
```

#### Get scheduler status

```http
GET /api/v1/scheduler/status
```

## 🏗️ Kiến trúc

```
vessel-enrichment-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # Application entry point
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection pooling
│   ├── logging_config.py    # Structured logging setup
│   ├── metrics.py           # Prometheus metrics
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── vessel.py
│   ├── schemas/             # Pydantic schemas
│   │   ├── __init__.py
│   │   └── vessel.py
│   ├── services/            # Business logic
│   │   ├── __init__.py
│   │   ├── enrichment.py    # Core enrichment logic
│   │   ├── queue.py         # Queue management
│   │   └── scheduler.py    # Scheduled tasks
│   ├── data_sources/        # External data sources
│   │   ├── __init__.py
│   │   ├── base.py         # Abstract base class
│   │   └── vesselfinder.py # VesselFinder scraper
│   └── api/                # FastAPI routes
│       ├── __init__.py
│       └── routes.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

## 🔄 Workflow

1. **Queue Management**: Vessels được thêm vào queue dựa trên:

   - Chưa bao giờ được enrich
   - Không được enrich trong 30 ngày
   - Failed attempts < max attempts

2. **Rate Limiting**: Tôn trọng rate limits của external APIs:

   - VesselFinder: 1 request/phút
   - Exponential backoff cho consecutive errors

3. **Batch Processing**: Xử lý theo lô để giảm database load:

   - Default batch size: 100 vessels
   - Delay giữa items: 65 giây

4. **Retry Logic**: Retry với exponential backoff:

   - Max attempts: 3
   - Delay: 60s \* 2^(attempt-1)

5. **Cleanup**: Tự động cleanup old queue items:
   - Completed/failed items > 7 ngày
   - Chạy hàng ngày lúc 3 AM

## 📈 Performance

### Rate Limiting

- **VesselFinder**: 1 req/phút (extremely conservative)
- **Batch Processing**: 2 items mỗi 10 phút
- **Daily Capacity**: ~288 vessels/ngày

### Database Optimization

- **Connection Pooling**: 10 connections + 20 overflow
- **Batch Operations**: Minimize individual queries
- **Indexes**: Optimized cho queue operations

### Memory Usage

- **Container Limits**: 512MB RAM, 1.0 CPU
- **Redis Cache**: 256MB max memory
- **Monitoring**: Prometheus + Grafana included

## 🛡️ Security

- **Non-root User**: Container chạy với non-root user
- **Minimal Attack Surface**: Multi-stage Docker build
- **Environment Variables**: Sensitive data qua env vars
- **CORS**: Configurable CORS middleware
- **Health Checks**: Container health checks

## 🔧 Development

### Running Tests

```bash
# Install dev dependencies
pip install -r requirements.txt

# Run tests
pytest

# Run with coverage
pytest --cov=app tests/
```

### Code Quality

```bash
# Format code
black app/
isort app/

# Lint code
flake8 app/
mypy app/
```

### Database Migrations

```bash
# Generate migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head
```

## 📝 Logging

Service sử dụng structured JSON logging với các fields:

- `timestamp`: ISO 8601 timestamp
- `level`: Log level (INFO, WARN, ERROR)
- `service`: Service name
- `message`: Log message
- `mmsi`: Vessel MMSI (khi applicable)
- `source`: Data source name
- `duration_ms`: Operation duration
- `error`: Error message (khi applicable)

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Errors**

   - Kiểm tra `DATABASE_URL`
   - Verify database is running
   - Check network connectivity

2. **Rate Limiting**

   - VesselFinder blocks aggressive requests
   - Service tự động exponential backoff
   - Monitor logs cho rate limit warnings

3. **High Memory Usage**

   - Reduce `BATCH_SIZE`
   - Check Redis memory limits
   - Monitor container resources

4. **Queue Not Processing**
   - Check `SCHEDULER_ENABLED=true`
   - Verify Redis connection
   - Check scheduler status endpoint

### Debug Mode

```bash
# Enable debug logging
export DEBUG=true
export LOG_LEVEL=DEBUG

# Run with auto-reload
python -m app.main
```

## 📞 Support

- **Documentation**: `/docs` (debug mode only)
- **Health Check**: `/health`
- **Metrics**: `/metrics` (Prometheus format)
- **Logs**: Structured JSON output

## 📄 License

This project is licensed under the MIT License.
