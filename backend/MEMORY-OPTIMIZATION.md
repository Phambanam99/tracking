# Memory Optimization Guide for Tracking Backend

## Problem

JavaScript heap out of memory errors occur when Node.js runs out of allocated memory during runtime.

## Solutions Implemented

### 1. Increased Memory Allocation in package.json

Updated all npm scripts to include memory flags:

```json
"start:dev": "node --max-old-space-size=4096 ..."  // 4GB for development
"start:prod": "node --max-old-space-size=8192 ..."  // 8GB for production
```

### 2. Added NODE_OPTIONS to .env

```bash
NODE_OPTIONS=--max-old-space-size=4096
```

### 3. Memory Allocation Guide

**Available Memory Flags:**

- `--max-old-space-size=SIZE` - Old space memory in MB (default: ~2GB on 64-bit)
- `--max-new-space-size=SIZE` - New space memory in MB
- `--expose-gc` - Allow manual garbage collection

**Recommended Settings:**

- Development: 4096 MB (4 GB)
- Production: 8192 MB (8 GB)
- Testing: 2048 MB (2 GB)

### 4. Code Optimization Tips

#### Memory Leaks to Check:

1. **Event Listeners**: Remove unused listeners

```typescript
// Bad
setInterval(() => {}, 1000); // Never cleared

// Good
const interval = setInterval(() => {}, 1000);
// Clear when done
clearInterval(interval);
```

2. **Large Arrays/Objects**: Clear when not needed

```typescript
// Bad
let bigArray = [];
for (let i = 0; i < 1000000; i++) {
  bigArray.push(data);
}
// bigArray never cleared

// Good
let bigArray = [];
for (let i = 0; i < 1000000; i++) {
  bigArray.push(data);
}
// Process and clear
processBatch(bigArray);
bigArray = null; // Help GC
```

3. **Closures**: Avoid capturing large objects

```typescript
// Bad
function createHandler(hugeData) {
  return () => console.log(hugeData.length);
}

// Good
function createHandler(hugeData) {
  const length = hugeData.length;
  return () => console.log(length);
}
```

### 5. Monitoring Memory Usage

#### In Code:

```typescript
const used = process.memoryUsage();
console.log({
  rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
  heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
  heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
  external: `${Math.round(used.external / 1024 / 1024)} MB`,
});
```

#### From Terminal:

```bash
# Monitor Node.js memory
node --inspect dist/main.js
# Open chrome://inspect in Chrome

# Or use clinic.js
npm install -g clinic
clinic doctor -- node dist/main.js
```

### 6. Potential Memory Issues in Your Code

Check these areas:

1. **WebSocket connections**: Ensure proper cleanup
2. **Redis subscriptions**: Close unused connections
3. **Database queries**: Use pagination for large datasets
4. **File uploads**: Stream large files instead of loading in memory
5. **Caching**: Implement cache size limits

### 7. Quick Fixes

#### If still experiencing issues:

**Option 1: Increase memory further**

```bash
NODE_OPTIONS=--max-old-space-size=6144  # 6GB
```

**Option 2: Enable garbage collection**

```bash
NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"
```

Then in code:

```typescript
if (global.gc) {
  global.gc();
}
```

**Option 3: Use streaming for large data**

```typescript
// Instead of loading all at once
const allData = await prisma.vessel.findMany();

// Use cursor-based pagination
const stream = await prisma.vessel.findMany({
  take: 100,
  cursor: { id: lastId },
});
```

### 8. Docker Memory Limits

If running in Docker, ensure container has enough memory:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 8G
        reservations:
          memory: 4G
```

### 9. System Requirements

**Minimum:**

- 4GB RAM available for Node.js process
- 8GB total system RAM

**Recommended:**

- 8GB RAM available for Node.js process
- 16GB total system RAM

### 10. Verification

After applying fixes, verify:

```bash
# 1. Clear node_modules
rm -rf node_modules
npm install

# 2. Clear build
rm -rf dist
npm run build

# 3. Start with monitoring
npm run start:dev

# 4. Check memory
curl http://localhost:3001/api/health
```

## Additional Resources

- [Node.js Memory Management](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes)
- [V8 Heap Options](https://nodejs.org/en/docs/guides/debugging-memory-leaks/)
- [NestJS Performance](https://docs.nestjs.com/techniques/performance)
