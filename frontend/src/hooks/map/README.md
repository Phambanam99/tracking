# Map Initialization Architecture - Refactored

## 📋 Tổng quan

Đây là kiến trúc mới được refactor cho hệ thống khởi tạo bản đồ, áp dụng các pattern và best practices:

- **Plugin Architecture**: Dễ dàng thêm loại đối tượng mới (drone, satellite, ...)
- **Factory Pattern**: Tạo configuration và layer một cách nhất quán
- **LRU Cache**: Tối ưu hiệu suất với cache thông minh
- **Separation of Concerns**: Mỗi file có trách nhiệm rõ ràng
- **Type Safety**: Full TypeScript với interfaces đầy đủ

## 🏗️ Cấu trúc thư mục

```
frontend/src/hooks/map/
├── types.ts                           # Core types và interfaces
├── cache.ts                           # LRU Cache implementation
├── useIconCache.ts                    # Icon loading và tinting
├── useVehicleStyleFactory.ts          # Style creation và caching
├── VehicleLayerPlugin.ts              # Plugin pattern cho layers
├── vehicleConfigFactory.ts            # Configuration factory
├── useBaseMapLayer.ts                 # Base map management
├── useMapInitialization.refactored.ts # Main orchestrator hook
└── README.md                          # Documentation (file này)
```

## 🎯 Cải tiến chính

### 1. Plugin Architecture

Thêm loại đối tượng mới chỉ cần:

```typescript
// 1. Tạo configuration
const droneConfig = VehicleConfigFactory.createConfig('drone', {
  clusterEnabled: true,
  operatorColors: colors,
  flagColors: {},
});

// 2. Tạo plugin
const dronePlugin = VehicleLayerFactory.createPlugin(droneConfig, styleFactory);

// 3. Thêm vào map
const droneLayer = dronePlugin.createLayer();
map.addLayer(droneLayer);
```

### 2. LRU Cache System

```typescript
// Cache tự động cleanup các entry ít dùng
const cache = new LRUCache<Style>({
  maxSize: 500,
  ttl: 60000, // Optional: auto-expire sau 60s
});

cache.set('key', style);
const style = cache.get('key'); // Tự động update lastUsed

// Monitor cache performance
const stats = cache.getStats();
console.log(stats); // { size, maxSize, totalUsage, averageUsage }
```

### 3. Icon Cache với Lazy Loading

```typescript
const iconCache = useIconCache();

// Preload icons
iconCache.preloadImage('./icon.svg', () => {
  console.log('Icon loaded!');
});

// Get loaded image (returns null if not ready)
const img = iconCache.getImage('./icon.svg');

// Get tinted version (cached)
const canvas = iconCache.getTintedCanvas(img, '#ff0000', './icon.svg');
```

### 4. Style Factory Pattern

```typescript
const styleFactory = useVehicleStyleFactory(vehicleConfig);

// Tất cả đều cached tự động
const clusterStyle = styleFactory.createClusterStyle({...});
const dotStyle = styleFactory.createDotStyle('#ff0000');
const iconStyle = styleFactory.createIconStyle(45, 'VN');

// Clear cache khi cần
styleFactory.clearCache();

// Monitor performance
const stats = styleFactory.getCacheStats();
```

## 📦 Component Usage

### Sử dụng hook mới

```typescript
import { useMapInitialization } from '@/hooks/map/useMapInitialization.refactored';

function MapComponent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map>(null);
  const aircraftLayerRef = useRef<VectorLayer>(null);
  const vesselLayerRef = useRef<VectorLayer>(null);

  useMapInitialization({
    mapRef,
    mapInstanceRef,
    aircraftLayerRef,
    vesselLayerRef,
  });

  return <div ref={mapRef} className="map-container" />;
}
```

### Thêm loại đối tượng mới

**Ví dụ: Thêm Drone Layer**

1. **Thêm type vào types.ts**:

```typescript
export interface VehicleTypeConfig {
  type: 'aircraft' | 'vessel' | 'drone' | 'satellite';
  // ...
}
```

2. **Thêm factory method vào vehicleConfigFactory.ts**:

```typescript
export function createDroneConfig(
  options: ConfigFactoryOptions,
): VehicleTypeConfig {
  return {
    type: 'drone',
    iconPath: './drone-icon.svg',
    defaultColor: '#8b5cf6',
    clusterEnabled: true,
    clusterDistance: 40,
    minClusterDistance: 15,
    getColor: (operator) =>
      options.operatorColors[operator?.toUpperCase()] || '#8b5cf6',
    getHeading: (data) => data?.heading || 0,
    getIdentifier: (data) => data?.operator,
  };
}
```

3. **Sử dụng trong useMapInitialization**:

```typescript
const droneConfig = VehicleConfigFactory.createConfig('drone', configOptions);
const droneStyleFactory = useVehicleStyleFactory(droneConfig);
const dronePlugin = VehicleLayerFactory.createPlugin(
  droneConfig,
  droneStyleFactory,
);
const droneLayer = dronePlugin.createLayer();

// Add to map
map.getLayers().push(droneLayer);
```

## 🔧 API Reference

### VehicleLayerPlugin

```typescript
interface IMapLayerPlugin {
  readonly id: string;
  readonly name: string;

  initialize(map: Map): void;
  createLayer(): VectorLayer<VectorSource>;
  getSource(): VectorSource;
  setVisible(visible: boolean): void;
  updateClusterDistance(distance: number): void;
  destroy(): void;
}
```

### IconCache

```typescript
interface IconCacheAPI {
  loadImage(src: string): Promise<HTMLImageElement>;
  preloadImage(src: string, onLoad?: () => void): void;
  getImage(src: string): HTMLImageElement | null;
  getTintedCanvas(img: HTMLImageElement, color: string, path: string): HTMLCanvasElement | null;
  clearCache(): void;
  getCacheStats(): { images: {...}, tintedCanvases: {...} };
}
```

### StyleFactory

```typescript
interface StyleFactoryAPI {
  createClusterStyle(config: ClusterStyleConfig): Style;
  createDotStyle(color: string): Style;
  createIconStyle(heading: number, identifier?: string): Style;
  clearCache(): void;
  getCacheStats(): { clusterStyles: {...}, iconStyles: {...}, icons: {...} };
}
```

## 🚀 Performance Optimizations

### 1. Cache Strategies

- **Icon Cache**: LRU với max 10 images
- **Tinted Canvas Cache**: LRU với max 200 entries
- **Cluster Style Cache**: LRU với max 100 entries
- **Icon Style Cache**: LRU với max 500 entries

### 2. Quantization

- **Heading**: Làm tròn về bội số 15° → Giảm 24x cache entries
- **Cluster Size**: Bucket thành ranges → Giảm cache entries

### 3. Lazy Loading

- Icons chỉ load khi cần
- Fallback to dots khi icon chưa sẵn sàng
- Auto-retry khi image load xong

### 4. Cleanup

- TTL-based expiration (optional)
- LRU eviction khi đạt max size
- Periodic cleanup (mỗi 60s)

## 📊 Monitoring

```typescript
// Get comprehensive cache stats
const aircraftStats = aircraftStyleFactory.getCacheStats();
console.log(aircraftStats);
// {
//   clusterStyles: { size: 10, maxSize: 100, totalUsage: 150, averageUsage: 15 },
//   iconStyles: { size: 45, maxSize: 500, totalUsage: 890, averageUsage: 19.7 },
//   icons: {
//     images: { total: 2, loaded: 2 },
//     tintedCanvases: { size: 30, maxSize: 200, ... }
//   }
// }

// Monitor cache hit rate
const cache = new LRUCache({ maxSize: 100 });
let hits = 0,
  misses = 0;
const get = (key: string) => {
  const val = cache.get(key);
  if (val) hits++;
  else misses++;
  return val;
};
console.log(`Hit rate: ${((hits / (hits + misses)) * 100).toFixed(2)}%`);
```

## 🔄 Migration từ code cũ

### Before (Old):

```typescript
// File 716 dòng, tất cả logic trong 1 hook
useEffect(
  () => {
    // 300+ lines of initialization code
    // Style functions inline
    // No caching strategy
    // Hard to extend
  },
  [
    /* many dependencies */
  ],
);
```

### After (New):

```typescript
// Hook chính ~150 dòng, orchestrates các module
useMapInitialization({...});

// Logic tách biệt:
// - useIconCache: Icon management
// - useVehicleStyleFactory: Style creation
// - VehicleLayerPlugin: Layer logic
// - vehicleConfigFactory: Configuration
// - useBaseMapLayer: Base map
```

## ✅ Benefits

1. **Maintainability**: Mỗi file < 300 dòng, 1 trách nhiệm rõ ràng
2. **Extensibility**: Thêm vehicle type mới chỉ cần vài dòng
3. **Performance**: LRU cache + quantization + lazy loading
4. **Testability**: Mỗi module test độc lập
5. **Type Safety**: Full TypeScript, no `any` abuse
6. **Monitoring**: Built-in stats và debugging tools

## 🧪 Testing

```typescript
// Test cache
describe('LRUCache', () => {
  it('should evict LRU when at capacity', () => {
    const cache = new LRUCache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // Touch 'a'
    cache.set('c', 3); // Should evict 'b'
    expect(cache.has('b')).toBe(false);
  });
});

// Test plugin
describe('VehicleLayerPlugin', () => {
  it('should create layer with correct config', () => {
    const plugin = VehicleLayerFactory.createPlugin(config, styleFactory);
    const layer = plugin.createLayer();
    expect(layer).toBeInstanceOf(VectorLayer);
  });
});
```

## 📝 Next Steps

1. ✅ Refactor core architecture
2. ⏳ Migrate existing code to new system
3. ⏳ Add unit tests
4. ⏳ Add drone/satellite support
5. ⏳ Performance benchmarking
6. ⏳ Documentation updates

## 🤝 Contributing

Khi thêm vehicle type mới:

1. Cập nhật `types.ts` với type mới
2. Thêm factory method vào `vehicleConfigFactory.ts`
3. Thêm icon SVG vào `/public`
4. Cập nhật `useMapInitialization` để include layer mới
5. Viết tests
6. Update documentation

## 📚 Related Files

- Original: `frontend/src/hooks/useMapInitialization.ts` (716 lines)
- Refactored: `frontend/src/hooks/map/*` (8 files, avg 150 lines each)

---

**Note**: Đây là kiến trúc mới được thiết kế để scale tốt hơn. Code cũ vẫn hoạt động, có thể migrate dần theo từng phần.
