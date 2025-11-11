# 🚀 Predicted Vessels - Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Start Backend
```bash
cd backend
npm run start:dev
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Open Browser
```
http://localhost:3000
```

### 4. Test Predicted Vessels

#### Enable Toggle
1. Click on **Filter** icon (top-right)
2. Switch to **Vessel** tab
3. Scroll down to find **"Hiển thị tàu dự đoán (mất tín hiệu)"**
4. Toggle **ON** (yellow switch)

#### View Predicted Vessel
1. Wait for a vessel to lose signal (>1 hour no updates)
2. Or use API to test:

```bash
# Test API with predictions
curl "http://localhost:3001/api/vessels/online?bbox=90,5,126,26&limit=100&includePredicted=true"
```

#### Check Popup
1. Click on a **ghost vessel** (👻 icon)
2. Verify popup shows:
   - ⚠️ "Signal Lost" warning
   - Confidence level (High/Medium/Low)
   - Time since last measurement
   - Refresh button

---

## 🧪 Quick Test Script

### Test Predicted Vessel API

```bash
# 1. Get vessels with predictions
curl -X GET "http://localhost:3001/api/vessels/online?includePredicted=true&limit=10" | jq

# 2. Check for predicted vessels
curl -X GET "http://localhost:3001/api/vessels/online?includePredicted=true&limit=100" | jq '.data[] | select(.predicted == true)'

# 3. Count predicted vs real-time
curl -X GET "http://localhost:3001/api/vessels/online?includePredicted=true&limit=1000" | jq '{predicted: .predictedCount, realTime: .realTimeCount}'
```

---

## 🎯 Expected Results

### API Response (with predictions)
```json
{
  "count": 150,
  "stalenessSec": 3600,
  "includePredicted": true,
  "predictedCount": 15,
  "realTimeCount": 135,
  "data": [
    {
      "mmsi": "123456789",
      "vesselName": "Test Vessel",
      "latitude": 10.5,
      "longitude": 105.2,
      "predicted": true,
      "confidence": 0.75,
      "timeSinceLastMeasurement": 120
    }
  ]
}
```

### UI Behavior
- **Toggle ON:** Shows both real-time and predicted vessels
- **Toggle OFF:** Shows only real-time vessels
- **Predicted vessels:**
  - Gray color
  - Dashed line
  - 👻 icon
  - Reduced opacity (30-70%)
  - Yellow badge in popup

---

## 🐛 Troubleshooting

### No Predicted Vessels Showing

**Problem:** Toggle is ON but no ghost vessels appear

**Solutions:**
1. Check if any vessels have lost signal (>1 hour)
2. Verify API returns predicted vessels:
   ```bash
   curl "http://localhost:3001/api/vessels/online?includePredicted=true" | jq '.predictedCount'
   ```
3. Check browser console for errors
4. Verify Redis has vessel data:
   ```bash
   redis-cli
   > ZCARD ais:vessels:active
   ```

### Toggle Not Working

**Problem:** Toggle doesn't change vessel display

**Solutions:**
1. Check browser console for errors
2. Verify state is updating:
   - Open React DevTools
   - Check `mapStore.showPredictedVessels`
3. Clear browser cache and reload
4. Check network tab for API calls with `includePredicted` parameter

### Confidence Always 100%

**Problem:** All vessels show 100% confidence

**Solutions:**
1. This is normal for real-time vessels
2. Only predicted vessels have <100% confidence
3. Check `predicted: true` field in API response
4. Verify vessels have lost signal (check `timeSinceLastMeasurement`)

---

## 📊 Performance Check

### Backend
```bash
# Check API response time
time curl "http://localhost:3001/api/vessels/online?includePredicted=true&limit=1000"

# Expected: <200ms
```

### Frontend
```javascript
// Open browser console
console.time('vessel-render');
// Toggle predicted vessels ON/OFF
console.timeEnd('vessel-render');

// Expected: <50ms
```

---

## ✅ Verification Checklist

- [ ] Backend running on port 3001
- [ ] Frontend running on port 3000
- [ ] Redis running and has vessel data
- [ ] Toggle switch visible in vessel filters
- [ ] Toggle changes `includePredicted` parameter in API calls
- [ ] Predicted vessels show ghost icon (👻)
- [ ] Popup shows "Signal Lost" warning
- [ ] Confidence level displays correctly
- [ ] Refresh button works

---

## 🎉 Success Criteria

You've successfully implemented predicted vessels if:

1. ✅ Toggle switch appears in vessel filters
2. ✅ API returns `predictedCount` and `realTimeCount`
3. ✅ Predicted vessels show with ghost icon
4. ✅ Popup displays confidence and warning
5. ✅ Toggle ON/OFF changes vessel display
6. ✅ Performance remains smooth (<50ms toggle)

---

## 📞 Need Help?

Check these files for reference:
- `PREDICTED_VESSELS_COMPLETE.md` - Full documentation
- `PREDICTED_VESSELS_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `PREDICTED_VESSELS_UI_GUIDE.md` - UI design guide

---

**Ready to test!** 🚀


