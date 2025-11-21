# Redis Schema Documentation

## Overview

Tài liệu này mô tả cấu trúc key và cách lưu trữ dữ liệu trong Redis cho hệ thống tracking.

## ⚠️ Important: No Automatic Prefix

**Tất cả modules đều sử dụng `getClientWithoutPrefix()`** để quản lý key thủ công.

- ✅ **KHÔNG CÒN** automatic prefix `ais:development:`
- ✅ Key trong code = Key trong Redis
- ✅ Dễ debug và monitor

## Key Naming Convention

### Format

```
{module}:{type}:{identifier}
```

- `module`: Module name (ais, adsb, vessel, aircraft, dlq)
- `type`: Data type (vessels, flights, geo, active, etc.)
- `identifier`: Unique identifier (optional, e.g., mmsi, hexident)

---

## AIS (Automatic Identification System)

### 1. Vessel Geographic Index

**Key Pattern**: `ais:vessels:geo`  
**Type**: Geo Spatial Index  
**Purpose**: Spatial queries for vessels by location  
**Operations**:

```bash
GEOADD ais:vessels:geo {lon} {lat} {mmsi}
GEORADIUS ais:vessels:geo {lon} {lat} {radius} km
```

### 2. Individual Vessel Data

**Key Pattern**: `ais:vessel:{mmsi}`  
**Type**: Hash  
**TTL**: 30 minutes  
**Fields**:

- `mmsi`: Maritime Mobile Service Identity
- `lat`: Latitude
- `lon`: Longitude
- `ts`: Timestamp (Unix milliseconds)
- `speed`: Speed over ground (knots)
- `course`: Course over ground (degrees)
- `heading`: True heading (degrees)
- `status`: Navigation status
- `source`: Data source (signalr, aisstream.io)
- `score`: Quality score
- `name`: Vessel name

**Operations**:

```bash
HSET ais:vessel:123456789 mmsi 123456789 lat 10.123 lon 106.456
HGETALL ais:vessel:123456789
EXPIRE ais:vessel:123456789 1800
```

### 3. Active Vessels Sorted Set

**Key Pattern**: `ais:vessels:active`  
**Type**: Sorted Set  
**Score**: Timestamp (for TTL/cleanup)  
**Operations**:

```bash
ZADD ais:vessels:active {timestamp} {mmsi}
ZRANGE ais:vessels:active 0 -1
ZREMRANGEBYSCORE ais:vessels:active 0 {old_timestamp}
```

---

## ADSB (Automatic Dependent Surveillance-Broadcast)

### 1. Current Flights Hash

**Key Pattern**: `adsb:current_flights`  
**Type**: Hash  
**TTL**: 5 minutes (300 seconds)  
**Fields**: `{hexident}` -> JSON string of aircraft data  
**Operations**:

```bash
HSET adsb:current_flights {hexident} '{...json...}'
HGETALL adsb:current_flights
HGET adsb:current_flights {hexident}
HLEN adsb:current_flights
EXPIRE adsb:current_flights 300
```

**Aircraft JSON Structure**:

```json
{
  "hexident": "A12345",
  "callSign": "ABC123",
  "latitude": 10.123,
  "longitude": 106.456,
  "altitude": 35000,
  "speed": 450,
  "heading": 270,
  "verticalSpeed": 0,
  "unixTime": 1700000000000,
  "source": "adsb_api",
  ...
}
```

---

## Redis Client Usage

**TẤT CẢ modules đều sử dụng `getClientWithoutPrefix()`** để quản lý key thủ công:

```typescript
// AIS Module
const client = this.redis.getClientWithoutPrefix();
await client.geoadd('ais:vessels:geo', lon, lat, mmsi);
// Actual key in Redis: ais:vessels:geo ✅

// ADSB Module
const client = this.redisService.getClientWithoutPrefix();
await client.hset('adsb:current_flights', hexident, data);
// Actual key in Redis: adsb:current_flights ✅

// Vessel Controller
const client = this.redis.getClientWithoutPrefix();
await client.zrange('ais:vessels:active', 0, -1);
// Actual key in Redis: ais:vessels:active ✅
```

---

## No Environment-Specific Prefixes

**Tất cả keys đều KHÔNG có automatic prefix:**

- AIS keys: `ais:{type}:{identifier}` (VD: `ais:vessels:geo`, `ais:vessel:123456789`)
- ADSB keys: `adsb:{type}:{identifier}` (VD: `adsb:current_flights`)
- DLQ keys: `dlq:{type}` (VD: `dlq:vessel`)

**Key trong code = Key trong Redis** → Dễ debug!

---

## Monitoring Commands

### Check AIS Data

```bash
# Count active vessels
ZCARD ais:vessels:active

# Get all vessels in geo index
ZRANGE ais:vessels:geo 0 -1

# Get specific vessel
HGETALL ais:vessel:123456789

# Find vessels near location
GEORADIUS ais:vessels:geo 106.456 10.123 100 km
```

### Check ADSB Data

```bash
# Count current flights
HLEN adsb:current_flights

# Get all aircraft
HGETALL adsb:current_flights

# Get specific aircraft
HGET adsb:current_flights A12345

# Check TTL
TTL adsb:current_flights
```

### List All Keys

```bash
# AIS keys
KEYS ais:*

# ADSB keys
KEYS adsb:*

# DLQ keys
KEYS dlq:*

# All tracking keys
KEYS *
```

---

## Best Practices

1. **Always use `getClientWithoutPrefix()`**:

   ```typescript
   // ✅ ĐÚNG - tất cả modules
   const client = this.redis.getClientWithoutPrefix();

   // ❌ SAI - không dùng nữa (có automatic prefix)
   const client = this.redis.getClient();
   ```

2. **Set TTL on all temporary data**:
   - AIS vessels: 30 minutes
   - ADSB flights: 5 minutes

3. **Use pipelines for batch operations**:

   ```typescript
   const pipeline = client.pipeline();
   pipeline.hset(key1, data1);
   pipeline.hset(key2, data2);
   await pipeline.exec();
   ```

4. **Monitor memory usage**:

   ```bash
   redis-cli INFO memory
   redis-cli --bigkeys
   ```

5. **Regular cleanup**:
   ```bash
   # Remove old vessels (older than 30 mins)
   ZREMRANGEBYSCORE ais:vessels:active 0 {30_mins_ago_timestamp}
   ```
