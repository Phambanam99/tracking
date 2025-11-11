# Fusion Engine & Persistence Guide

This document explains how AIS data flows through the system, how the fusion engine works, the persistence model (Redis + Postgres), configuration via environment variables, and how to verify runtime state.

## Data Flow Overview

1. Raw AIS messages arrive via a single SignalR connection (`AisSignalrService`).
2. (Optional future) Additional sources replicated / or real multi-connections (`AisMultiSourceService`).
3. Fusion engine (`AisFusionService`) buffers per MMSI within a time window and scores candidates.
4. Best record per MMSI is published (rate-limited + movement threshold) to an internal Subject.
5. Persistence:
   - Redis: Fast geo + hash + active set.
   - Postgres (Prisma): Upsert latest + append history row.
6. Downstream delivery: SSE (`/api/ais/stream?mode=fused`) or future WebSocket broadcast.

## Fusion Algorithm

For each MMSI:
* Maintain a rolling buffer of records within `fusion.windowMs`.
* Filter out records older than `windowMs + allowedLatenessMs`.
* Score each record:
  `score = (recency * recencyWeight) + (speed ? speedBonus : 0)`
  where `recency = 1 / (1 + ageSeconds)`.
* Pick candidate with newest timestamp; break ties by higher score.
* Rate limit: Only publish if `best.ts - lastPublished.ts >= publishMinIntervalMs`.
* Movement threshold: Require haversine distance from last published >= `minMoveMeters`.

## Environment Variables

| Env Var | Default | Meaning |
|---------|---------|---------|
| FUSION_WINDOW_MS | 60000 | Buffer window size for records (ms) |
| FUSION_ALLOWED_LATENESS_MS | 30000 | Accept late-arriving records within this grace (ms) |
| FUSION_MIN_MOVE_METERS | 5 | Minimum movement to consider a new publish |
| FUSION_SCORE_RECENCY_WEIGHT | 0.8 | Weight for recency term in score |
| FUSION_SCORE_SPEED_BONUS | 0.1 | Flat bonus if speed present |
| FUSION_PUBLISH_MIN_INTERVAL_MS | 5000 | Min elapsed ms between publishes for same MMSI |
| AIS_EXTRA_SOURCES | (unset) | JSON array of extra source configs (future real multi-source) |

Example `.env` snippet:
```
FUSION_WINDOW_MS=60000
FUSION_ALLOWED_LATENESS_MS=30000
FUSION_MIN_MOVE_METERS=10
FUSION_SCORE_RECENCY_WEIGHT=0.85
FUSION_SCORE_SPEED_BONUS=0.15
FUSION_PUBLISH_MIN_INTERVAL_MS=4000
```

## Redis Key Schema

| Key | Type | Description |
|-----|------|-------------|
| `ais:vessels:geo` | GEOSET | GEOADD (lon lat mmsi) for spatial queries |
| `ais:vessel:<mmsi>` | HASH | Latest fused fields: lat, lon, ts, speed, course, sourceId, score |
| `ais:vessels:active` | ZSET | Score = epoch ms timestamp; members = mmsi (active ordering) |

Sample hash contents:
```
HGETALL ais:vessel:123456789
lat  "10.1234"
lon  "107.5678"
ts   "1694859000123"
speed "4.5"
course "270"
sourceId "default"
score "0.912"
```

## Postgres Models

`AisVesselLatest` (one row per MMSI):
```
id (PK)
mmsi (Unique)
latitude, longitude
speed, course, sourceId
score (Double)
timestamp (last fused ts)
createdAt (insert time)
```

`AisVesselHistory` (append-only):
```
id (PK)
mmsi (Indexed)
latitude, longitude
speed, course, sourceId
score
timestamp (record ts)
createdAt
```

Indices:
* `AisVesselLatest.mmsi` unique
* `AisVesselHistory.mmsi` (standard index) - consider composite `(mmsi, timestamp)` for time-range queries

## Persistence Logic

For each published fused record:
1. Redis GEOADD / HSET / ZADD (best-effort; errors logged, not fatal).
2. Prisma transaction:
   * `upsert` into `AisVesselLatest`.
   * `create` row in `AisVesselHistory`.

Potential future optimization: batch history inserts or asynchronous queue if write pressure becomes high.

## Verifying Operation

Start SSE fused stream (with trigger) and correct API version header:
```
curl -N -H "X-API-Version: 1.0.0" "http://localhost:3001/api/ais/stream?mode=fused&trigger=1"
```
You should see events containing `data:` JSON lines.

Check Redis (example commands):
```
redis-cli ZCARD ais:vessels:active
redis-cli GEOPOS ais:vessels:geo 123456789
redis-cli HGETALL ais:vessel:123456789
```

Check Postgres:
```
SELECT * FROM "AisVesselLatest" LIMIT 5;
SELECT count(*) FROM "AisVesselHistory";
```

## Error Handling

* Redis failures: logged as warnings; DB still attempted.
* DB failures: logged as errors with message only (consider extending with structured context: MMSI, ts).
* Out-of-order / late data beyond grace window: silently dropped.

## Extending to Real Multi-Source

Planned steps:
* Factor base connection class.
* Create one connection per entry in `AIS_EXTRA_SOURCES`.
* Replace fusion subscription from single `AisSignalrService` to `AisMultiSourceService.mergedData$`.
* Introduce optional per-source weight config (e.g. `FUSION_SOURCE_WEIGHTS={"sat":1.2,"default":1}`).

## Troubleshooting Checklist

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 404 on endpoints | Missing `X-API-Version: 1.0.0` header | Add correct header |
| No rows in `AisVesselLatest` | No fused publish (movement threshold not met) | Lower `FUSION_MIN_MOVE_METERS` or trigger more data |
| Frequent DB errors | Lock/contention or connection issue | Inspect logs, consider batching |
| Duplicate fused emits | Interval too low & movement threshold small | Increase `FUSION_PUBLISH_MIN_INTERVAL_MS` or `FUSION_MIN_MOVE_METERS` |

## Roadmap Ideas

* Adaptive movement threshold by speed.
* Dead reckoning when stale beyond window.
* Periodic pruning of old Redis entries.
* Partitioned history table if volume grows.

---

Last updated: (auto-draft)