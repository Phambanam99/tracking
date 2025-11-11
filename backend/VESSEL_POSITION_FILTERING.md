# 🗺️ Vessel Position Filtering

## 📋 Overview

To reduce unnecessary database writes and storage, vessel positions are filtered based on distance from the last recorded position.

**Benefits:**

- **-60-80% DB writes** (fewer inserts)
- **-60-80% storage** (less data)
- **Better performance** (less I/O)
- **Cleaner tracks** (no redundant points)

---

## ⚙️ Configuration

### Environment Variables

Add to your `.env` file:

```env
# Minimum distance (in meters) between consecutive positions
# Positions closer than this will be filtered out
# Default: 10000 (10 km)
VESSEL_MIN_POSITION_DISTANCE_METERS=10000

# Maximum time (in seconds) between position updates
# Even if distance is small, update if time exceeded
# Default: 3600 (1 hour)
VESSEL_MAX_POSITION_AGE_SECONDS=3600

# Enable/disable position distance filtering
# Set to 'false' to disable filtering
# Default: true
VESSEL_ENABLE_POSITION_FILTERING=true
```

---

## 🔧 How It Works

### Logic Flow

```
New Position Received
    ↓
Check if filtering enabled?
    ↓ Yes
Get last position from DB
    ↓
Calculate distance & time difference
    ↓
Distance < 10km AND Time < 1 hour?
    ↓ Yes → SKIP (don't insert)
    ↓ No  → INSERT (save to DB)
```

### Distance Calculation

Uses **Haversine formula** for accurate great-circle distance:

```typescript
distance = calculateDistance(lastLat, lastLon, newLat, newLon);
// Returns distance in meters
```

### Time-Based Override

Even if distance is small, position is saved if:

- Time since last position > `VESSEL_MAX_POSITION_AGE_SECONDS`
- Ensures regular updates even for stationary vessels

---

## 📊 Expected Impact

### Storage Reduction

**Before filtering:**

```
Vessel moving slowly: 1 position/minute
= 60 positions/hour
= 1,440 positions/day
= 43,200 positions/month
```

**After filtering (10km threshold):**

```
Vessel moving slowly: ~1 position/hour (time-based)
= 24 positions/day
= 720 positions/month

Reduction: -98% for slow-moving vessels
```

**For fast-moving vessels:**

```
Vessel at 20 knots (~37 km/h):
= ~4 positions/hour (distance-based)
= 96 positions/day
= 2,880 positions/month

Reduction: -93% compared to per-minute updates
```

### Performance Impact

| Metric             | Before      | After          | Gain        |
| ------------------ | ----------- | -------------- | ----------- |
| **DB Writes/hour** | 60          | 4-24           | **-60-93%** |
| **Storage/month**  | 43,200 rows | 720-2,880 rows | **-93-98%** |
| **I/O Load**       | High        | Low            | **-60-93%** |

---

## 🎯 Recommended Settings

### For Different Use Cases

**1. High-Precision Tracking (Ports, Narrow Channels)**

```env
VESSEL_MIN_POSITION_DISTANCE_METERS=1000    # 1 km
VESSEL_MAX_POSITION_AGE_SECONDS=600         # 10 minutes
```

**2. Standard Ocean Tracking (Default)**

```env
VESSEL_MIN_POSITION_DISTANCE_METERS=10000   # 10 km
VESSEL_MAX_POSITION_AGE_SECONDS=3600        # 1 hour
```

**3. Long-Distance Tracking (Open Ocean)**

```env
VESSEL_MIN_POSITION_DISTANCE_METERS=50000   # 50 km
VESSEL_MAX_POSITION_AGE_SECONDS=7200        # 2 hours
```

**4. Disable Filtering (Development/Testing)**

```env
VESSEL_ENABLE_POSITION_FILTERING=false
```

---

## 🧪 Testing

### Test Distance Filtering

```bash
# 1. Set low threshold for testing
export VESSEL_MIN_POSITION_DISTANCE_METERS=100  # 100 meters

# 2. Send two close positions
curl -X POST http://localhost:3001/api/vessels/positions \
  -H "Content-Type: application/json" \
  -d '{
    "mmsi": "123456789",
    "latitude": 10.5,
    "longitude": 106.7,
    "timestamp": "2025-11-08T10:00:00Z"
  }'

curl -X POST http://localhost:3001/api/vessels/positions \
  -H "Content-Type: application/json" \
  -d '{
    "mmsi": "123456789",
    "latitude": 10.5001,
    "longitude": 106.7001,
    "timestamp": "2025-11-08T10:01:00Z"
  }'

# 3. Check logs
# Should see: "Skipping position for vessel X: distance 15m < 100m"
```

### Verify Filtering Works

```bash
# Check number of positions in DB
psql tracking -c "SELECT COUNT(*) FROM \"VesselPosition\" WHERE \"vesselId\" = 1;"

# Should be less than number of messages received
```

---

## 📈 Monitoring

### Check Filtered Positions

Look for log messages:

```
[AisOrchestratorService] Skipping position for vessel 123: distance 5000m < 10000m
```

### Metrics to Track

1. **Position Insert Rate**

```bash
curl http://localhost:3001/metrics/prometheus | grep vessel_position_inserts
```

2. **Filtered Position Count**

```bash
# Add custom metric in future
curl http://localhost:3001/metrics/prometheus | grep vessel_position_filtered
```

3. **Storage Growth**

```bash
psql tracking -c "SELECT pg_size_pretty(pg_total_relation_size('VesselPosition'));"
```

---

## ⚠️ Important Notes

### 1. Redis vs Database

- **Redis:** Always stores latest position (no filtering)
- **Database:** Applies distance filtering
- This ensures real-time display while reducing storage

### 2. First Position

- First position for a vessel is **always saved**
- Filtering only applies to subsequent positions

### 3. Fail-Open Strategy

- If distance check fails → Position is saved
- Ensures no data loss on errors

### 4. Performance Impact

- Distance check adds 1 DB query per position
- Cached with LRU cache (future optimization)
- Overall: Still net positive (fewer writes)

---

## 🔄 Future Optimizations

### 1. Cache Last Position

```typescript
// Instead of querying DB each time
const lastPosition = await this.prisma.vesselPosition.findFirst(...)

// Use LRU cache
const lastPosition = this.positionCache.get(vesselId)
```

### 2. Batch Distance Checks

```typescript
// Check multiple positions at once
const shouldSkip = await this.shouldSkipPositions([pos1, pos2, pos3]);
```

### 3. Adaptive Thresholds

```typescript
// Adjust threshold based on vessel speed
const threshold =
  vessel.speed > 10
    ? 20000 // 20km for fast vessels
    : 5000; // 5km for slow vessels
```

---

## 📝 Configuration File

**Location:** `backend/src/config/vessel.config.ts`

```typescript
export const vesselConfig = {
  minPositionDistanceMeters: parseInt(
    process.env.VESSEL_MIN_POSITION_DISTANCE_METERS || '10000',
    10,
  ),
  maxPositionAgeSeconds: parseInt(process.env.VESSEL_MAX_POSITION_AGE_SECONDS || '3600', 10),
  enablePositionFiltering: process.env.VESSEL_ENABLE_POSITION_FILTERING !== 'false',
};
```

---

## 🎉 Summary

✅ **Distance-based filtering** implemented  
✅ **Configurable via environment variables**  
✅ **No hardcoded values**  
✅ **Time-based override** for regular updates  
✅ **Fail-open strategy** for reliability

**Expected Savings:**

- Storage: **-60-98%**
- DB Writes: **-60-93%**
- I/O Load: **-60-93%**

**Status:** ✅ **READY TO USE**
