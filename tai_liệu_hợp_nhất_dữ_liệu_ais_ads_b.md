# Tài liệu thuật toán hợp nhất dữ liệu (Multi‑source Fusion)

*(Áp dụng cho ****Vessel – AIS****; mở rộng tương tự cho ****Aircraft – ADS‑B****)*

---

## Mục tiêu

Hợp nhất nhiều bản tin vị trí/thuộc tính của **cùng một thực thể** (tàu hoặc máy bay) từ các nguồn khác nhau thành **một dòng dữ liệu “sự thật” (truth stream)**, giảm nhiễu, loại trùng, ưu tiên dữ liệu **mới và đáng tin**, đồng thời vẫn **lưu đầy đủ lịch sử**.

---

## Dòng xử lý tổng quan

1. **Ingest** (mỗi nguồn một adapter) → trả về `RawMessage[]`.
2. **Chuẩn hoá (normalize)** về schema chung `NormMessage`.
3. **Kiểm tra hợp lệ (sanity)**: biên độ tọa độ, tốc độ, thời gian…
4. **Định danh & liên kết (entity resolution)**: gán về một “khóa tàu/máy bay”.
5. **Đệm theo cửa sổ thời gian (event‑time window)** + xử lý bản tin đến trễ.
6. **Chấm điểm & chọn bản tin tốt nhất** trong cửa sổ (conflict resolution).
7. **Làm mượt & dự đoán ngắn hạn** (optional): α‑β/Kalman, dead‑reckoning.
8. **Ghi DB (timeseries + master)** + **Publish realtime** (chỉ khi event mới hơn).
9. **Giám sát & replay** để tinh chỉnh trọng số và ngưỡng.

---

## 1) Chuẩn hoá (Normalization)

Chuẩn tất cả nguồn về một cấu trúc chung.

### Vessel (AIS)

```ts
export type VesselSource = 'marine_traffic' | 'vessel_finder' | 'china_port' | 'custom';

export type NormVesselMsg = {
  source: VesselSource;
  ts: string;       // ISO‑8601 UTC: event time (thời điểm đo)
  mmsi?: string;    // ưu tiên
  imo?: string;
  callsign?: string;
  name?: string;

  lat: number;      // [-90, 90]
  lon: number;      // [-180, 180]
  speed?: number;   // knots
  course?: number;  // deg (COG)
  heading?: number; // deg
  status?: string;  // nav status text
};
```

### Aircraft (ADS‑B) – tương tự

Khóa: `icao24` (ưu tiên) → `registration` → `callsign`.

**Quy tắc normalize:**

- Chuẩn `ts` sang UTC ISO‑8601 (event time); ép số, cắt khoảng trắng; map field khác tên giữa nguồn.
- Chuẩn đơn vị (knots/deg; với aircraft thêm feet/m).
- Rỗng/không hợp lệ → đặt `undefined` (không cố đoán).

---

## 2) Kiểm tra hợp lệ (Sanity Checks)

Loại sớm bản tin “phi lý” để giảm nhiễu:

- **Thời gian:** `|now - ts| ≤ 24h` (config).
- **Tọa độ** trong biên [-90..90], [-180..180].
- **Ngưỡng tốc độ** (theo loại phương tiện, có thể tinh chỉnh):
  - Cargo/Tanker: `speed ≤ 35–40 kn` (nới hơn, ví dụ reject > 60 kn).
  - High‑speed craft: ngưỡng cao hơn.
- **Teleport check:** khoảng cách/Δt quá lớn ⇒ reject.
  - Dùng Haversine để tính khoảng cách `d` (m).
  - Tính vận tốc suy ra `v = d/Δt` (kn) và so ngưỡng.
- *(Tuỳ chọn)* **Land mask:** loại điểm rơi trên đất liền với tàu biển.

---

## 3) Định danh & Liên kết bản ghi (Entity Resolution)

Mục tiêu: gom bản tin của **cùng một tàu** về một khóa.

**Thứ tự khóa (vessel):**

1. `MMSI`
2. `IMO`
3. `CALLSIGN`
4. `name + callsign` *(fuzzy, fallback cuối)*

**Khuyến nghị:**

- Bảng `identity_map(vessel_id, mmsi, imo, callsign, aliases…)` để bắc cầu khi MMSI/owner đổi.
- Fuzzy match cho `name` (Jaro‑Winkler/Levenshtein) *chỉ khi thiếu định danh cứng*, và chốt thêm bằng `callsign/flag/dimension` nếu có.

---

## 4) Cửa sổ **event‑time** & xử lý đến trễ (Out‑of‑order)

- Giữ một **cửa sổ trượt per‑entity**: `WINDOW_MS` (mặc định **5 phút**).
- Mỗi lần nhận bản tin, thêm vào cửa sổ tương ứng và **prune** bản tin cũ hơn `now − WINDOW_MS`.
- Quyết định “mới hơn” theo **event time (**``**)**, không phải arrival time.
- Cho phép bản tin đến trễ tối đa `ALLOWED_LATENESS` (vd **10 phút**):
  - Nếu `ts_event > lastPublishedTs` và `now − ts_event ≤ ALLOWED_LATENESS` → **cập nhật realtime**.
  - Nếu `ts_event ≤ lastPublishedTs` → chỉ **backfill** timeseries, **không** publish realtime.

> **Streaming formal:** Dùng watermark & grace (Kafka Streams/Flink) = `ALLOWED_LATENESS`.

---

## 5) Chấm điểm & hoà giải xung đột (Scoring & Conflict Resolution)

Tính `score ∈ [0,1]` cho mỗi bản tin trong cửa sổ:

- **Recency (0..1):** `ageMin = (now − ts) / 60k`, `recency = max(0, 1 − ageMin/15)`.
- **Nguồn (source weight):** bảng cấu hình, ví dụ: `marine_traffic=0.90`, `vessel_finder=0.85`, `china_port=0.80`, `default=0.70`.
- **Hợp lệ vật lý (0/1):** qua `sanity` + `teleport check`.

**Công thức mặc định:**

```
score = 0.5 * recency + 0.3 * source_weight + 0.2 * physical_validity
```

**Ràng buộc “mới hơn” (event‑time override):**

- Nếu có bản `ts > lastPublishedTs` và `≤ ALLOWED_LATENESS`, ưu tiên nhóm này; tie‑break bằng `score`.

---

## 6) Lựa chọn bản tin “sự thật” & Idempotency

**Thuật toán chọn (per entity):**

1. `candidates = {m ∈ window | sane(m)}`
2. `newer = { m ∈ candidates | m.ts > lastPublishedTs && (now − m.ts) ≤ ALLOWED_LATENESS }`
3. Nếu `newer` **không rỗng**: `best = sort(newer, by ts desc, then score desc)[0]`
4. Ngược lại: `best = argmax score(candidates)`
5. Nếu `best.ts ≤ lastPublishedTs` → **không publish** (chỉ backfill DB nếu muốn)
6. Cập nhật `lastPublishedTs = best.ts`

**Tie‑break gợi ý:**

- Ưu tiên bản có `MMSI/IMO` đầy đủ; bản có nhiều trường đo (`speed/course/heading`).
- Ưu tiên bản **không “nhảy”** xa so với điểm liền kề.

---

## 7) Làm mượt & Dead‑Reckoning (khuyến nghị)

### α‑β filter (nhẹ, realtime tốt)

- Trạng thái 2D: vị trí `(x,y)` và vận tốc `(vx, vy)`.
- Mỗi tick:
  - **Dự đoán:** `x̂ₖ⁻ = x̂ₖ₋₁ + vx̂ₖ₋₁·Δt` (tương tự cho `y`)
  - **Cập nhật:** `r = zₖ − x̂ₖ⁻` → `x̂ₖ = x̂ₖ⁻ + α·r`, `vx̂ₖ = vx̂ₖ⁻ + (β/Δt)·r`
- Chọn `α≈0.2–0.35`, `β≈0.05–0.15` theo nhiễu đo.

### Kalman (chuẩn hơn)

- Trạng thái `[x, y, vx, vy]ᵀ`, ma trận chuyển `F`, nhiễu quá trình `Q`, nhiễu đo `R`.

### Dead‑reckoning

- Khi mất tín hiệu ≤ *N* phút: dự đoán theo vận tốc/hướng cuối, gắn cờ `predicted=true` để UI hiển thị khác.

---

## 8) Lưu trữ & Backfill

- **Master:** `vessels` (MMSI/IMO/callsign/name…) – upsert theo định danh cứng; lưu SCD2 cho thuộc tính thay đổi (`vessel_attributes_history`).
- **Timeseries:** `vessel_positions(vessel_id, ts, geom, sog, cog, heading, nav_status, source, score)` (TimescaleDB + PostGIS).
- **Idempotency key:** `UNIQUE(vessel_id, ts, source)` hoặc `source_event_id` nếu có.

**Chính sách backfill:**

- Bản đến trễ nhưng `ts ≤ lastPublishedTs` → **INSERT** vào timeseries (nếu chưa có) để đầy đủ lịch sử, **không** publish realtime.

---

## 9) Publish realtime (Redis/Kafka)

Chỉ publish khi:

- `best.ts > lastPublishedTs`, và
- `now − best.ts ≤ ALLOWED_LATENESS`.

**Payload gợi ý:**

```json
{
  "vesselId": 123,
  "name": "CARGO SHIP 1",
  "position": {"lat": 34.05, "lon": -118.24, "speed": 12.3, "course": 185, "heading": 180, "status": "Under way"},
  "source": "marine_traffic",
  "score": 0.93,
  "predicted": false,
  "timestamp": "2025-08-12T02:15:03Z"
}
```

---

## 10) Tham số cấu hình khuyến nghị

| Tham số               | Mặc định                  | Ghi chú                             |
| --------------------- | ------------------------- | ----------------------------------- |
| `WINDOW_MS`           | 300000 (5′)               | Cửa sổ hợp nhất per‑entity          |
| `ALLOWED_LATENESS_MS` | 600000 (10′)              | Chấp nhận out‑of‑order cho realtime |
| `MAX_EVENT_AGE_MS`    | 86400000 (24h)            | Loại bản quá cũ                     |
| `SPEED_LIMIT_KN`      | 60                        | Ngưỡng sanity cho merchant          |
| `SOURCE_WEIGHT.*`     | MT=0.90, VF=0.85, CP=0.80 | Tinh chỉnh theo thực tế             |
| `ALPHA_BETA`          | α=0.25, β=0.08            | Làm mượt α‑β                        |

---

## 11) Tình huống biên & quy tắc

- **Thiếu MMSI nhưng có IMO:** dùng IMO làm khóa; khi xuất hiện MMSI, cập nhật `identity_map`.
- **Tên đổi/viết khác:** chỉ fuzzy khi thiếu định danh cứng; đối chiếu thêm callsign/flag/dimension.
- **Đường đổi ngày (±180°):** chuẩn hóa lon liên tục trước khi tính Haversine.
- **Nguồn trùng lặp:** nếu mirror, giảm weight/khử duplicate bằng `source_event_id`.
- **Spoofing/nhảy xa liên tục:** hạ điểm hoặc cấm tạm thời theo entity.

---

## 12) Monitoring, Testing, Replay

- **Unit test:** normalize, sanity, entity‑key, scoring, chọn best với các tình huống: nguồn đến trước/sau, ts mới/cũ, teleport, thiếu MMSI/IMO…
- **Replay:** lưu `*.normalized` để chạy lại khi thay đổi thuật toán.
- **Metrics (Prometheus/Grafana):** tỉ lệ reject, phân phối age/latency, số entity online, độ lệch giữa nguồn, số publish/backfill…
- **Alerting:** spike teleport, latency nguồn, rớt publish.

---

## 13) Pseudocode cốt lõi (TypeScript, rút gọn)

```ts
for (const raw of fetchAllSources()) {
  const m = normalize(raw);
  if (!m || !sane(m)) continue;

  const key = keyOf(m); // MMSI -> IMO -> name+callsign
  const win = windows.get(key) ?? [];
  win.push(m);
  prune(win, now - WINDOW_MS); // giữ trong 5′
  windows.set(key, win);
}

for (const [key, win] of windows) {
  const last = lastPublished.get(key); // ISO
  const newer = win.filter(m =>
    (!last || Date.parse(m.ts) > Date.parse(last)) &&
    (now - Date.parse(m.ts) <= ALLOWED_LATENESS_MS) &&
    sane(m)
  );

  let best: NormVesselMsg | undefined;
  if (newer.length) {
    best = newer.sort((a,b) =>
      Date.parse(b.ts) - Date.parse(a.ts) || (score(b) - score(a))
    )[0];
  } else {
    best = win.filter(sane).sort((a,b)=> score(b) - score(a))[0];
    if (best && last && Date.parse(best.ts) <= Date.parse(last)) {
      backfillTimeseries(best); // optional
      continue;
    }
  }

  const vesselId = upsertVesselIdentity(best);
  insertPosition(vesselId, best); // idempotent
  publishRealtime(vesselId, best);
  lastPublished.set(key, best.ts);
}
```

---

## 14) Mở rộng cho **Aircraft**

- **Khóa:** `icao24` → `registration` → `callsign`.
- **Trường:** thêm `altitude`, `vertical_rate`, `ground_speed`.
- **Ngưỡng:** tốc độ/độ cao khác (vd `GS > 700 kn` bất thường).
- **Lateness:** thường ngắn hơn tàu (vd 5′) vì ADS‑B dày đặc.
- **Làm mượt:** α‑β/Kalman cho (x,y) + altitude (1D) + vertical rate.

---

## 15) Phụ lục A — Gợi ý lược đồ SQL (PostgreSQL/TimescaleDB + PostGIS)

```sql
-- Master tàu (1 hàng/ tàu)
CREATE TABLE vessels (
  vessel_id    BIGSERIAL PRIMARY KEY,
  mmsi         TEXT UNIQUE,
  imo          TEXT UNIQUE,
  callsign     TEXT,
  name         TEXT,
  vessel_type  TEXT,
  flag         TEXT,
  dims         JSONB,
  updated_at   TIMESTAMPTZ
);

-- Lịch sử thuộc tính (SCD2)
CREATE TABLE vessel_attributes_history (
  id         BIGSERIAL PRIMARY KEY,
  vessel_id  BIGINT REFERENCES vessels(vessel_id),
  valid_from TIMESTAMPTZ,
  valid_to   TIMESTAMPTZ,
  data       JSONB
);

-- Dòng vị trí theo thời gian
CREATE TABLE vessel_positions (
  vessel_id       BIGINT REFERENCES vessels(vessel_id),
  ts              TIMESTAMPTZ NOT NULL,
  geom            GEOMETRY(Point, 4326) NOT NULL,
  sog             DOUBLE PRECISION,
  cog             DOUBLE PRECISION,
  heading         DOUBLE PRECISION,
  nav_status      TEXT,
  source          TEXT,
  score           DOUBLE PRECISION,
  PRIMARY KEY (vessel_id, ts, source)
);
-- Timescale + PostGIS indexes
SELECT create_hypertable('vessel_positions','ts');
CREATE INDEX ON vessel_positions USING GIST (geom);
```

---

## 16) Phụ lục B — Bảng trọng số nguồn (ví dụ)

```ts
export const SOURCE_WEIGHT = {
  marine_traffic: 0.90,
  vessel_finder:  0.85,
  china_port:     0.80,
  custom:         0.70,
  default:        0.70,
} as const;
```

---

## 17) Phụ lục C — Tham số cấu hình (config.ts – ví dụ)

```ts
export const FUSION_CONFIG = {
  WINDOW_MS: 5 * 60 * 1000,
  ALLOWED_LATENESS_MS: 10 * 60 * 1000,
  MAX_EVENT_AGE_MS: 24 * 60 * 60 * 1000,
  SPEED_LIMIT_KN: 60,
  ALPHA: 0.25,
  BETA: 0.08,
};
```

---

**End of document.**

