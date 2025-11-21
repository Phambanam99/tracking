# Testing MarineTraffic Scraper

## Setup Access Token (Optional but Recommended)

MarineTraffic có thể yêu cầu access token để tránh rate limiting.

### Lấy Access Token:

1. Đăng nhập vào https://www.marinetraffic.com
2. Mở DevTools (F12) → Network tab
3. Tìm request có header `x-access-token`
4. Copy token value

### Set Access Token:

**Option 1: Environment Variable (Recommended)**

```bash
# Windows PowerShell
$env:MARINETRAFFIC_ACCESS_TOKEN="your_token_here"

# Linux/Mac
export MARINETRAFFIC_ACCESS_TOKEN="your_token_here"
```

**Option 2: Add to .env file**

```env
MARINETRAFFIC_ACCESS_TOKEN=your_token_here
```

⚠️ **Note**: Token thường expire sau vài giờ, cần refresh định kỳ.

## Quick Test

Chạy test nhanh với script đã chuẩn bị sẵn:

```bash
cd backend
npm run test:marinetraffic
```

Script này sẽ:

- ✅ Kiểm tra MarineTraffic availability
- ✅ Test fetch data bằng MMSI (2 vessels)
- ✅ Test search bằng IMO
- ✅ Test invalid input handling
- ✅ Verify data correctness

## Full Test Suite

Chạy full test suite với Jest:

```bash
cd backend
npm test -- marinetraffic-scraper.spec.ts
```

### Run Specific Tests

```bash
# Test availability only
npm test -- marinetraffic-scraper.spec.ts -t "availability"

# Test MMSI search
npm test -- marinetraffic-scraper.spec.ts -t "Search by MMSI"

# Test IMO search
npm test -- marinetraffic-scraper.spec.ts -t "Search by IMO"

# Test rate limiting
npm test -- marinetraffic-scraper.spec.ts -t "rate limit"
```

## Test Data

### Test Vessel 1: LIBERTY EAGLE

- **MMSI**: 369344000
- **IMO**: 9206929
- **Flag**: United States
- **Ship ID**: 455948

### Test Vessel 2: HAI YANG SHI YOU 944

- **MMSI**: 413213250
- **IMO**: 9739886
- **Flag**: China
- **Ship ID**: 4801835

## Manual Testing

### Test trong VS Code Terminal:

```bash
cd backend

# Quick test
npm run test:marinetraffic

# Or use ts-node directly
npx ts-node -r tsconfig-paths/register src/vessel-enrichment/data-sources/test-marinetraffic.ts
```

### Test trong Node REPL:

```bash
cd backend
npm run start:dev
```

Trong API, gọi endpoint:

```bash
POST http://localhost:3000/vessel-enrichment/enrich/369344000
Authorization: Bearer YOUR_ADMIN_TOKEN
```

## Expected Output

### Successful Test Output:

```
🚢 MarineTraffic Scraper Test Suite

============================================================

📡 Test 1: Checking MarineTraffic availability...
   Status: ✅ Online

============================================================
🔍 Test 2: Fetching vessel data by MMSI...

🎯 Testing: LIBERTY EAGLE (MMSI: 369344000)
   Expected IMO: 9206929
   Expected Country: United States
   ⏳ Fetching...
   ✅ Success! (2543ms)
   Retrieved data:
      Name: LIBERTY EAGLE
      MMSI: 369344000
      IMO: 9206929
      Call Sign: WDD3894
      Flag: United States
      Type: Tanker
      Year Built: 2001
      Home Port: US
      Destination: NEW YORK
      Quality Score: 90/100
   Verification:
      ✅ IMO matches
      ✅ Country matches
```

## Troubleshooting

### Rate Limited (HTTP 429)

```
⚠️ MarineTraffic rate limit/blocked (HTTP 429)
```

**Solution**: Chờ 5-10 phút trước khi test lại. Rate limit: 1 req/minute.

### No Data Found

```
❌ Failed - No data retrieved
```

**Possible causes**:

1. MMSI không tồn tại trong database của MarineTraffic
2. Vessel chưa có AIS data
3. Rate limited (check logs)

### Parse Error

```
⚠️ General section not found in HTML
```

**Possible causes**:

1. HTML structure thay đổi
2. Page load chưa hoàn tất
3. Cần update parser

### Network Error

```
❌ MarineTraffic fetch error: timeout
```

**Solution**:

- Kiểm tra internet connection
- Check if MarineTraffic website đang down
- Tăng timeout trong code

## Performance Benchmarks

Expected response times:

- **Search by MMSI**: 2-5 seconds
- **Search by IMO**: 3-7 seconds (includes MMSI lookup)
- **Full enrichment**: 5-10 seconds

Rate limits:

- **MarineTraffic**: 1 request/minute
- **Consecutive requests**: +60s delay between each

## CI/CD Integration

Để chạy tests trong CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Test MarineTraffic Scraper
  run: |
    cd backend
    npm run test:marinetraffic
  env:
    NODE_ENV: test
```

⚠️ **Note**: Tests này gọi real APIs, nên:

- Có thể bị rate limited trong CI
- Nên mock cho unit tests
- Chỉ chạy integration tests trong staging/manual

## Mock Data for Unit Tests

Để test mà không gọi real API, tạo mock:

```typescript
jest.mock('./marinetraffic-scraper', () => ({
  MarineTrafficScraper: jest.fn().mockImplementation(() => ({
    fetchByMmsi: jest.fn().mockResolvedValue({
      mmsi: '369344000',
      vesselName: 'LIBERTY EAGLE',
      imo: '9206929',
      flag: 'United States',
      dataQualityScore: 90,
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
  })),
}));
```
