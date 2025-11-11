# Predicted Vessels UI Implementation Guide 🎨

## Overview

Display vessels with **dead reckoning predictions** when signal is lost, with clear visual indicators to distinguish from real-time data.

## Visual Design

### Real-time Vessel (Normal)
```
🚢 ━━━━━━━━━━━━━━━━━━━━→
   Solid line
   Full opacity
   Blue color
   "Last update: 5s ago"
```

### Predicted Vessel (Signal Lost)
```
👻 ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈→
   Dashed line
   50% opacity
   Gray color
   "Predicted (2m ago)"
   Confidence indicator
```

## Implementation Steps

### 1. Update Vessel Store Type

**File:** `frontend/src/stores/vesselStore.ts`

Add `predicted` and `confidence` fields to vessel type:

```typescript
export interface Vessel {
  id: number | string;
  mmsi: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  operator?: string;
  length?: number;
  width?: number;
  createdAt: Date;
  updatedAt: Date;
  lastPosition?: {
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    heading?: number;
    status?: string;
    timestamp: Date;
  };
  images?: VesselImage[];
  
  // ✅ NEW: Prediction fields
  predicted?: boolean;           // Is this position predicted?
  confidence?: number;           // 0-1, prediction confidence
  timeSinceLastMeasurement?: number;  // seconds
}
```

### 2. Update Backend Response

**File:** `backend/src/vessel/vessel.controller.ts`

Modify `/vessels/online` endpoint to include prediction data:

```typescript
@Get('online')
@ApiOperation({ summary: 'Get online vessels with predictions' })
async getOnline(
  @Query('bbox') bbox?: string,
  @Query('limit') limitStr?: string,
  @Query('stalenessSec') stalenessStr?: string,
  @Query('includePredicted') includePredictedStr?: string,
) {
  const includePredicted = includePredictedStr === 'true';
  const limit = limitStr ? Math.max(1, Math.min(50000, parseInt(limitStr, 10))) : 1000;
  const stalenessSec = stalenessStr ? Math.max(10, parseInt(stalenessStr, 10)) : 3600;
  
  // ... existing bbox parsing ...
  
  const minTs = Date.now() - stalenessSec * 1000;
  const results: any[] = [];
  
  // Get real-time vessels from Redis
  for (const { mmsi, hash } of hashResults) {
    if (results.length >= limit) break;
    if (!hash || !hash.ts) continue;
    
    const ts = Number(hash.ts);
    const timeSinceUpdate = (Date.now() - ts) / 1000; // seconds
    
    // Real-time vessel
    if (ts >= minTs) {
      results.push({
        mmsi,
        vesselName: hash.name || undefined,
        latitude: Number(hash.lat),
        longitude: Number(hash.lon),
        timestamp: new Date(ts).toISOString(),
        speed: hash.speed ? Number(hash.speed) : undefined,
        course: hash.course ? Number(hash.course) : undefined,
        sourceId: hash.sourceId || undefined,
        score: hash.score ? Number(hash.score) : undefined,
        predicted: false,
        confidence: 1.0,
        timeSinceLastMeasurement: timeSinceUpdate,
      });
    }
    // Predicted vessel (if enabled and within prediction window)
    else if (includePredicted && timeSinceUpdate <= 600) { // 10 min max
      // Get prediction from fusion service
      const prediction = await this.vesselFusion.predictPosition(mmsi, Date.now());
      
      if (prediction && prediction.confidence > 0.3) {
        results.push({
          mmsi,
          vesselName: hash.name || undefined,
          latitude: prediction.lat,
          longitude: prediction.lon,
          timestamp: new Date(ts).toISOString(),
          speed: prediction.speed,
          course: prediction.course,
          sourceId: 'predicted',
          score: prediction.confidence,
          predicted: true,
          confidence: prediction.confidence,
          timeSinceLastMeasurement: prediction.timeSinceLastMeasurement,
        });
      }
    }
  }
  
  return {
    count: results.length,
    stalenessSec,
    bbox: bboxNums,
    data: results,
  };
}
```

### 3. Update Map Marker Rendering

**File:** `frontend/src/components/map/VesselMarker.tsx` (create if not exists)

```typescript
'use client';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { Style, Icon, Stroke, Fill, Text } from 'ol/style';
import { fromLonLat } from 'ol/proj';

export interface VesselMarkerProps {
  vessel: {
    mmsi: string;
    vesselName?: string;
    latitude: number;
    longitude: number;
    course?: number;
    predicted?: boolean;
    confidence?: number;
    timeSinceLastMeasurement?: number;
  };
}

/**
 * Create OpenLayers feature for vessel marker
 */
export function createVesselFeature(vessel: VesselMarkerProps['vessel']): Feature {
  const coords = fromLonLat([vessel.longitude, vessel.latitude]);
  const feature = new Feature({
    geometry: new Point(coords),
    vessel: vessel,
  });

  feature.setId(`vessel-${vessel.mmsi}`);
  feature.setStyle(createVesselStyle(vessel));

  return feature;
}

/**
 * Create style for vessel marker
 */
function createVesselStyle(vessel: VesselMarkerProps['vessel']): Style {
  const isPredicted = vessel.predicted === true;
  const confidence = vessel.confidence ?? 1.0;
  
  // Base colors
  const realTimeColor = '#2563eb'; // blue-600
  const predictedColor = '#6b7280'; // gray-500
  const color = isPredicted ? predictedColor : realTimeColor;
  
  // Opacity based on prediction confidence
  const opacity = isPredicted ? confidence * 0.7 : 1.0;
  
  // Icon rotation (course)
  const rotation = vessel.course ? (vessel.course * Math.PI) / 180 : 0;

  return new Style({
    image: new Icon({
      src: isPredicted 
        ? '/icons/vessel-predicted.svg'  // Ghost ship icon
        : '/icons/vessel.svg',            // Normal ship icon
      scale: isPredicted ? 0.8 : 1.0,
      rotation: rotation,
      opacity: opacity,
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    }),
    text: new Text({
      text: vessel.vesselName || vessel.mmsi,
      offsetY: -20,
      font: '12px sans-serif',
      fill: new Fill({
        color: isPredicted ? 'rgba(107, 114, 128, 0.9)' : 'rgba(0, 0, 0, 0.9)',
      }),
      stroke: new Stroke({
        color: 'rgba(255, 255, 255, 0.8)',
        width: 3,
      }),
      textAlign: 'center',
      textBaseline: 'bottom',
    }),
  });
}

/**
 * Format time since last measurement
 */
export function formatTimeSince(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Get confidence label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

/**
 * Get confidence color
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}
```

### 4. Update Vessel Popup/Tooltip

**File:** `frontend/src/components/map/VesselPopup.tsx`

```typescript
'use client';
import { formatTimeSince, getConfidenceLabel, getConfidenceColor } from './VesselMarker';

interface VesselPopupProps {
  vessel: {
    mmsi: string;
    vesselName?: string;
    vesselType?: string;
    flag?: string;
    speed?: number;
    course?: number;
    predicted?: boolean;
    confidence?: number;
    timeSinceLastMeasurement?: number;
  };
}

export default function VesselPopup({ vessel }: VesselPopupProps) {
  const isPredicted = vessel.predicted === true;
  const confidence = vessel.confidence ?? 1.0;
  const timeSince = vessel.timeSinceLastMeasurement ?? 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 min-w-[250px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg">
            {vessel.vesselName || 'Unknown Vessel'}
          </h3>
          <p className="text-sm text-gray-500">MMSI: {vessel.mmsi}</p>
        </div>
        {isPredicted && (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
            👻 Predicted
          </span>
        )}
      </div>

      {/* Status Alert */}
      {isPredicted && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600">⚠️</span>
            <div className="text-xs">
              <p className="font-medium text-yellow-800">Signal Lost</p>
              <p className="text-yellow-700">
                Position predicted using last known course and speed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-2 text-sm">
        {vessel.vesselType && (
          <div className="flex justify-between">
            <span className="text-gray-600">Type:</span>
            <span className="font-medium">{vessel.vesselType}</span>
          </div>
        )}
        
        {vessel.flag && (
          <div className="flex justify-between">
            <span className="text-gray-600">Flag:</span>
            <span className="font-medium">{vessel.flag}</span>
          </div>
        )}
        
        {vessel.speed !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600">Speed:</span>
            <span className="font-medium">{vessel.speed.toFixed(1)} kn</span>
          </div>
        )}
        
        {vessel.course !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600">Course:</span>
            <span className="font-medium">{vessel.course.toFixed(0)}°</span>
          </div>
        )}

        {/* Time Since Last Update */}
        <div className="flex justify-between pt-2 border-t">
          <span className="text-gray-600">Last Update:</span>
          <span className={isPredicted ? 'text-yellow-600 font-medium' : 'text-gray-900'}>
            {formatTimeSince(timeSince)}
          </span>
        </div>

        {/* Confidence (for predicted) */}
        {isPredicted && (
          <div className="flex justify-between">
            <span className="text-gray-600">Confidence:</span>
            <span className={`font-medium ${getConfidenceColor(confidence)}`}>
              {getConfidenceLabel(confidence)} ({(confidence * 100).toFixed(0)}%)
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t flex gap-2">
        <button
          onClick={() => window.open(`/vessels/${vessel.mmsi}`, '_blank')}
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          View Details
        </button>
        {isPredicted && (
          <button
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
            title="Refresh to get latest position"
          >
            🔄 Refresh
          </button>
        )}
      </div>
    </div>
  );
}
```

### 5. Add Vessel Trail (Track History)

**File:** `frontend/src/components/map/VesselTrail.tsx`

```typescript
'use client';
import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import { Style, Stroke } from 'ol/style';
import { fromLonLat } from 'ol/proj';

export interface TrailPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  predicted?: boolean;
}

/**
 * Create vessel trail feature
 */
export function createVesselTrail(
  mmsi: string,
  points: TrailPoint[],
): Feature {
  if (points.length < 2) return null;

  // Convert to map coordinates
  const coords = points.map(p => fromLonLat([p.longitude, p.latitude]));
  
  const feature = new Feature({
    geometry: new LineString(coords),
    mmsi: mmsi,
    points: points,
  });

  feature.setId(`trail-${mmsi}`);
  
  // Style: solid for real-time, dashed for predicted
  const hasPredicted = points.some(p => p.predicted);
  
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: hasPredicted ? 'rgba(107, 114, 128, 0.6)' : 'rgba(37, 99, 235, 0.6)',
      width: 2,
      lineDash: hasPredicted ? [10, 5] : undefined,
    }),
  }));

  return feature;
}
```

### 6. Add Filter Toggle

**File:** `frontend/src/components/MapFilters.tsx`

Add toggle to show/hide predicted vessels:

```typescript
// Add to filter state
const [showPredicted, setShowPredicted] = useState(true);

// Add to UI
<div className="flex items-center justify-between p-3 border-b">
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium">Show Predicted Vessels</span>
    <span className="text-xs text-gray-500">(signal lost)</span>
  </div>
  <label className="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      checked={showPredicted}
      onChange={(e) => setShowPredicted(e.target.checked)}
      className="sr-only peer"
    />
    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
  </label>
</div>
```

### 7. Update Viewport Loader

**File:** `frontend/src/hooks/useVesselViewportLoader.ts`

Add `includePredicted` parameter:

```typescript
const qsOnline = `?bbox=${encodeURIComponent(bboxStr)}&limit=50000&includePredicted=true`;
```

## Icon Assets

Create SVG icons:

**File:** `public/icons/vessel.svg` (normal vessel)
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2L4 8V12L12 18L20 12V8L12 2Z" fill="#2563eb" stroke="#1e40af" stroke-width="2"/>
  <path d="M12 10L8 12V14L12 16L16 14V12L12 10Z" fill="#60a5fa"/>
</svg>
```

**File:** `public/icons/vessel-predicted.svg` (ghost vessel)
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2L4 8V12L12 18L20 12V8L12 2Z" fill="#6b7280" stroke="#4b5563" stroke-width="2" opacity="0.5" stroke-dasharray="4 2"/>
  <path d="M12 10L8 12V14L12 16L16 14V12L12 10Z" fill="#9ca3af" opacity="0.5"/>
</svg>
```

## Testing

### Manual Test Scenarios:

1. **Normal Vessel Display:**
   - Load map with vessels
   - Verify solid blue markers
   - Check popup shows "Last update: Xs ago"

2. **Predicted Vessel Display:**
   - Wait for vessel signal to be lost (or simulate)
   - Verify marker changes to ghost icon
   - Verify dashed trail
   - Check popup shows "Signal Lost" warning

3. **Confidence Indicator:**
   - Check confidence decreases over time
   - Verify color changes (green → yellow → red)
   - Verify vessel disappears when confidence < 0.3

4. **Toggle Filter:**
   - Turn off "Show Predicted"
   - Verify predicted vessels disappear
   - Turn back on, verify they reappear

## Performance Considerations

- Predicted vessels are cached in frontend for 1 minute
- Backend prediction is computed on-demand (not stored)
- Filter manager auto-cleans old filters (> 30 min)
- Maximum 10 minutes prediction window

## Future Enhancements

1. **Collision Prediction:**
   - Predict future positions (5-10 min ahead)
   - Show collision warnings

2. **Confidence Visualization:**
   - Show prediction cone (uncertainty area)
   - Animate prediction update

3. **Historical Playback:**
   - Show vessel track over time
   - Distinguish real vs predicted segments

---

**Status:** ✅ Ready for implementation
**Estimated Time:** 4-6 hours
**Priority:** Medium (nice-to-have feature)

