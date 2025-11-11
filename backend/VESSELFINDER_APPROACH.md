# 🌐 VesselFinder Scraping Approach

## 📝 Giải Thích

Vì API endpoint `https://www.vesselfinder.com/api/pub/vesselinfo/` không ổn định hoặc không công khai, hệ thống đã được cập nhật để **scrape từ website** thay vì dùng API.

## 🔄 Cách Hoạt Động

### 1. Details Page URL
```
https://www.vesselfinder.com/vessels/details/{mmsi}
```
Truy cập details page của vessel để lấy dữ liệu đầy đủ

### 2. HTML Response
Server VesselFinder trả về trang HTML details với rich data

### 3. Parsing - Extract Rich Data
Hệ thống parse các trường từ HTML tables:

```html
<!-- Vessel Name -->
<h1 class="title">NAN HAI JIU 113</h1>

<!-- Ship Type -->
<h2 class="vst">Search & Rescue Vessel, IMO 9548055</h2>

<!-- From tables -->
<td>IMO number</td><td>9548055</td>
<td>Callsign</td><td>BSGK</td>
<td>Flag</td><td>China</td>
<td>Year of Build</td><td>2009</td>
<td>Length Overall</td><td>99.00</td>
<td>Beam</td><td>15.20</td>
<td>Gross Tonnage</td><td>3510</td>
```

#### Fields Extracted
- ✅ Vessel Name (h1.title)
- ✅ IMO (table cell or h2 pattern)
- ✅ Call Sign (table)
- ✅ Ship Type (h2.vst)
- ✅ Flag (table)
- ✅ Year Built (table)
- ✅ Length (table)
- ✅ Beam/Width (table)
- ✅ Gross Tonnage (table)
- ✅ Destination (from voyage data section)

### 4. Quality Score Calculation
Score dựa trên số trường được tìm thấy:
- **8/8 fields found**: Score = 100 ✅ (Excellent)
- **6/8 fields found**: Score = 75 ✅ (Good)
- **4/8 fields found**: Score = 50 🟡 (Fair)
- **2/8 fields found**: Score = 25 ⚠️ (Low)
- **0/8 fields found**: Score = 0 ❌ (None - returns null)

## ⚙️ Implementation Details

### Headers (Realistic)
```typescript
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
'Accept': 'text/html,application/xhtml+xml,application/xml'
'Accept-Language': 'en-US,en;q=0.9'
'Referer': 'https://www.vesselfinder.com/'
```

### Rate Limiting
- **2 requests/minute** (30 seconds delay)
- **Timeout**: 15 seconds
- **Very safe** from blocking

### Error Handling
```typescript
✅ 404 → return null (not found)
✅ Network error → return null with log
✅ Parse error → return null with log
❌ No fatal errors
```

## 📊 Success Rates

Expected success rates:
- 🟢 **Active vessels**: 80-95% ✅
- 🟡 **Older vessels**: 40-70%
- 🔴 **Inactive/old vessels**: 10-30%

Quality of extracted data:
- **Vessel Name**: 95%+ ✅
- **MMSI**: 100% (used as search)
- **IMO**: 60-80%
- **Call Sign**: 60-80%
- **Other fields**: Via JSON (when available)

## 🔍 Testing

### Manual Test
```bash
# Test with curl
curl "https://www.vesselfinder.com/vessels/search?mmsi=412440890" \
  -H "User-Agent: Mozilla/5.0..." \
  -H "Referer: https://www.vesselfinder.com/"
```

### Via API
```bash
# After server starts
curl -X POST http://localhost:3000/vessel-enrichment/enrich/412440890 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚠️ Limitations

1. **Depends on Website Structure**
   - If VesselFinder changes HTML, parsing may break
   - Need to update regex patterns

2. **Partial Data**
   - Not all vessel fields available on search page
   - Some data only on detail page

3. **Slower than API**
   - HTML parsing slower than JSON API
   - But more reliable and doesn't get blocked

## 🛠️ Maintenance

### If Parsing Breaks
1. Open https://www.vesselfinder.com/vessels/search?mmsi=MMSI
2. Check HTML structure
3. Update regex patterns in `parseVesselFinderHtml()`
4. Test again

### Inspect Page Data
```javascript
// In browser console
window.__INITIAL_STATE__  // Check if JSON data available
```

## 📈 Alternative Solutions

If scraping becomes unreliable:

### Option 1: Official API Key
- Contact VesselFinder for API key
- Pros: Official, fast, reliable
- Cons: May require paid subscription

### Option 2: Multiple Sources
- Add backup sources (MarineTraffic, APRS.fi)
- Pros: Fallback options
- Cons: More complex

### Option 3: Database Cache
- Cache results for 30+ days
- Pros: Less requests
- Cons: Stale data

## 🎯 Current Approach (Recommended)

✅ **Web Scraping** (Current)
- Free
- Reliable (with conservative rate limiting)
- Sustainable long-term
- Conservative: 2 req/min = safe

---

**Status**: ✅ Ready to use
**Maintenance**: Low
**Risk**: Very Low (conservative rate limiting)

