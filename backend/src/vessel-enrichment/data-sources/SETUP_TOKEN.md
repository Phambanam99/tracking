# Quick Setup: MarineTraffic Access Token

## Tại sao cần Access Token?

MarineTraffic yêu cầu authentication để:

- Tránh rate limiting nghiêm ngặt
- Truy cập đầy đủ data (không bị limit "Upgrade to unlock")
- Tăng tốc độ response

## Cách lấy Access Token

### Bước 1: Đăng nhập MarineTraffic

1. Truy cập: https://www.marinetraffic.com
2. Đăng nhập tài khoản của bạn (hoặc tạo tài khoản mới - miễn phí)

### Bước 2: Lấy Token từ Browser

1. Mở DevTools (nhấn F12)
2. Chuyển sang tab **Network**
3. Reload trang hoặc search 1 tàu bất kỳ
4. Tìm request có URL chứa `/search` hoặc `/ships/`
5. Click vào request → Tab **Headers**
6. Scroll xuống tìm section **Request Headers**
7. Copy giá trị của header `x-access-token`

**Example token format:**

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtyRU03...
```

### Bước 3: Set Token

#### Option A: Environment Variable (Recommended cho testing)

```bash
# Windows PowerShell
$env:MARINETRAFFIC_ACCESS_TOKEN="your_token_here"
npm run test:marinetraffic

# Linux/Mac/WSL
export MARINETRAFFIC_ACCESS_TOKEN="your_token_here"
npm run test:marinetraffic
```

#### Option B: .env File (Recommended cho production)

```bash
cd backend
nano .env
```

Thêm dòng:

```env
MARINETRAFFIC_ACCESS_TOKEN=your_token_here
```

Save và restart backend:

```bash
npm run start:dev
```

## Test Token

Chạy test để verify token hoạt động:

```bash
cd backend

# Set token
$env:MARINETRAFFIC_ACCESS_TOKEN="your_token_here"

# Run test
npm run test:marinetraffic
```

**Expected output nếu token OK:**

```
🚢 MarineTraffic Scraper Test Suite
============================================================
✅ Access token found (length: 500+)

📡 Test 1: Checking MarineTraffic availability...
   Status: ✅ Online
```

**Expected output nếu token SAI hoặc expired:**

```
⚠️  No access token found - will use public access only
📡 Test 1: Checking MarineTraffic availability...
   Status: ❌ Offline
```

## Troubleshooting

### Token expired

**Symptom**: Tests fail với "HTTP 401" hoặc "Offline"

**Solution**:

1. Clear browser cookies/cache
2. Logout và login lại MarineTraffic
3. Lấy token mới từ DevTools

### Token không hoạt động

**Symptom**: Tests vẫn fail dù có token

**Solution**:

1. Verify token không có ký tự thừa (spaces, quotes)
2. Check token length (thường > 400 characters)
3. Verify format bắt đầu với `eyJ...`

### Rate limiting vẫn xảy ra

**Symptom**: "HTTP 429" errors

**Solution**:

1. Token có thể bị rate limited nếu dùng quá nhiều
2. Chờ 5-10 phút
3. Sử dụng account khác nếu cần

## Token Security

⚠️ **IMPORTANT**:

- **KHÔNG commit** token vào Git
- **KHÔNG share** token publicly
- Token có giá trị như password
- `.env` file đã được add vào `.gitignore`

## Alternative: Public Access

Nếu không có token, scraper vẫn hoạt động nhưng:

- ⚠️ Rate limit rất nghiêm: 1-2 requests/phút
- ⚠️ Một số data sẽ bị hide ("Upgrade to unlock")
- ⚠️ Higher chance of being blocked

## Token Lifespan

MarineTraffic access tokens thường:

- ⏱️ Expire sau: **1-2 giờ**
- 🔄 Auto refresh: Khi còn login
- 💡 Best practice: Script auto-refresh token

## Next Steps

Sau khi setup token:

1. **Test ngay**: `npm run test:marinetraffic`
2. **Check logs**: Xem có `✅ with token` message
3. **Run enrichment**: Enrich vessels qua API
4. **Monitor**: Check logs cho rate limiting

## Example: Complete Setup

```bash
# 1. Get token from browser
# (following steps above)

# 2. Set token
$env:MARINETRAFFIC_ACCESS_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtyRU03TTJKZDY5NWZRZ3dsOG4tYyJ9..."

# 3. Test
cd backend
npm run test:marinetraffic

# 4. If successful, add to .env for persistence
echo "MARINETRAFFIC_ACCESS_TOKEN=$env:MARINETRAFFIC_ACCESS_TOKEN" >> .env

# 5. Restart backend
npm run start:dev
```

Done! 🎉
