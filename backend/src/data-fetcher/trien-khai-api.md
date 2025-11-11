- Chỗ cần gắn API thật: thay phần “giả lập” trong `DataFetcherService` bằng các provider gọi API thật, normalize về định dạng chuẩn, rồi đẩy vào fusion + lưu DB.

Triển khai theo 6 bước:

1. Tạo provider cho từng nguồn

- Mỗi nguồn 1 service riêng, ví dụ:
  - `backend/src/data-fetcher/sources/ais.provider.ts` (vessel)
  - `backend/src/data-fetcher/sources/adsb.provider.ts` (aircraft)
- Mỗi provider expose hàm như:
  - `fetchVessels(bbox?: [minLon,minLat,maxLon,maxLat]): Promise<RawVessel[]>`
  - `fetchAircraft(bbox?: ...): Promise<RawAircraft[]>`
- Đọc API key/url từ `.env` (qua `ConfigService`).

2. Viết normalizer về kiểu chuẩn fusion

- Map raw → `NormVesselMsg`/`NormAircraftMsg` trong `backend/src/fusion/normalizers.ts`:
  - Bắt buộc: `ts` (ISO), `lat`, `lon`
  - Tàu: `speed`(sog), `course`(cog), `heading`, `status`, `source`
  - Máy bay: `groundSpeed`, `altitude`, `heading`, `source`
- Gắn `source` là tên nguồn: ví dụ `ais_marine`, `adsb_exch`,…

3. Ingest vào fusion và quyết định publish

- Thay phần giả lập trong `DataFetcherService`:
  - Gọi provider → normalize → `this.vesselFusion.ingest(msgs, now)` hoặc `this.aircraftFusion.ingest(msgs, now)`
  - Với mỗi object (key: `mmsi` cho vessel, `flightId`/định danh phù hợp cho aircraft):
    - `const decision = await fusion.decide(key, now)`
    - Nếu `decision.best`, gọi service lưu DB (đã hỗ trợ `source` và `score`):
      - Vessel: `vesselService.addPosition(vesselId, { ..., source: decision.best.source, score: scoreVessel(decision.best, now) })`
      - Aircraft: tương tự với `scoreAircraft`
    - Nếu `decision.publish` và trong hạn `ALLOWED_LATENESS_MS`, publish Redis event (hiện có), rồi `fusion.markPublished(key, best.ts)`

4. Lưu DB và ràng buộc trùng

- Prisma đã có unique `[vesselId, timestamp, source]` và `[aircraftId, timestamp, source]`, tránh trùng khi một thời điểm đến từ nhiều nguồn.
- Bạn đã có `source`/`score` map xuống DB (mình vừa nối).

5. Lên lịch/push

- Polling: dùng `@Cron` ở `DataFetcherService` (đã sẵn), gọi provider theo chu kỳ; có thể theo `bbox` hiện tại nếu muốn tiết kiệm (đọc từ Redis hoặc tắt nếu nguồn không hỗ trợ bbox).
- Push/webhook: thêm controller như `POST /ingest/vessels` và `POST /ingest/aircraft` nhận payload raw, normalize → ingest tương tự.

6. Cấu hình và mở rộng

- Chỉnh trọng số/logic chấm điểm trong `backend/src/fusion/utils.ts` (`scoreVessel`, `scoreAircraft`) và `backend/src/fusion/config.ts` (cửa sổ thời gian, lateness).
- Nếu nhiều nguồn, gọi nhiều provider trong 1 tick; normalize mỗi nguồn, cùng `ingest` là đủ để fusion tự chọn “best”.

File cần sửa/điền:

- `backend/src/data-fetcher/data-fetcher.module.ts`: provide các source provider.
- `backend/src/data-fetcher/data-fetcher.service.ts`: thay 2 hàm giả lập bằng gọi provider + normalize + fusion như mô tả.
- `backend/src/fusion/normalizers.ts`: thêm các normalizer cho nguồn thật.
- `.env`: API URL/KEY; đọc qua `ConfigService`.

Kết quả:

- Bản ghi mới trong `vessel_positions`/`aircraft_positions` sẽ có `source` và `score` thay vì null.
- Realtime WS/Redis vẫn hoạt động nhờ publish có sẵn.
