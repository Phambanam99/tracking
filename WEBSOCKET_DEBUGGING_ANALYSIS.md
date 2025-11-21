# WebSocket Debugging Analysis & Root Cause Summary

**Date:** 2025-01-27  
**Status:** Active Debugging Session  
**Focus:** Socket.IO + Redis Adapter Integration & Horizontal Scaling

---

## 🎯 Executive Summary

This document provides a comprehensive analysis of WebSocket configuration in the tracking application, specifically focusing on:

1. **Root Cause Identified:** Potential race condition between `app.useWebSocketAdapter()` and gateway initialization
2. **Critical Issue:** Redis adapter may not be fully connected before gateway tries to use it
3. **Architecture:** Single-server Socket.IO vs Redis-backed distributed architecture
4. **Performance:** WebSocket broadcast mechanism and client connection handling

---

## 📋 System Architecture Overview

### Current Stack

```
Backend:
  - NestJS 11.0.1
  - Socket.IO 4.8.1
  - @socket.io/redis-adapter 8.3.0
  - Redis 5.8.0
  - @nestjs/platform-socket.io 11.1.6

Frontend:
  - Next.js (App Router)
  - Socket.IO client
  - TypeScript

Data Layer:
  - Prisma 6.13.0
  - PostgreSQL (via Prisma)
  - Redis (pub/sub + adapter)
```

### Component Relationships

```
┌─────────────────────────────────────────┐
│        Socket.IO Server                  │
│  (EventsGateway in src/events/)          │
└──────────────────┬──────────────────────┘
                   │
                   │ uses
                   ▼
┌─────────────────────────────────────────┐
│     RedisIoAdapter                       │
│  (src/config/redis-io.adapter.ts)        │
│  - Extends NestJS IoAdapter              │
│  - Creates Redis pub/sub clients         │
│  - Enables horizontal scaling            │
└──────────────────┬──────────────────────┘
                   │
                   │ connects to
                   ▼
┌─────────────────────────────────────────┐
│     Redis Server                         │
│  - Pub/Sub: aircraft/vessel/viewport     │
│  - Adapter: Socket.IO state management   │
└─────────────────────────────────────────┘
```

---

## 🚨 Critical Issue: Initialization Race Condition

### Problem Statement

In `src/main.ts` (lines 121-123):

```typescript
// ==========================================
// 6️⃣ WebSocket Redis Adapter (NEW)
// ==========================================
const redisIoAdapter = new RedisIoAdapter(configService);
await redisIoAdapter.connectToRedis(); // ← Async connection
app.useWebSocketAdapter(redisIoAdapter); // ← Sets up adapter IMMEDIATELY after
```

### Why This Is Problematic

1. **Timing Issue**: After `connectToRedis()` completes, the adapter constructor is set
2. **Gateway Already Initialized**: The `EventsGateway` may have already been instantiated by dependency injection
3. **Missing Fallback**: If Redis connection fails or is slow, the gateway continues without adapter
4. **State Mismatch**: Multiple servers would think they're isolated when Redis adapter isn't ready

### The Root Cause Chain

```
1. App boots → DI instantiates EventsGateway
2. Gateway's afterInit() runs early
3. RedisIoAdapter.connectToRedis() is ASYNC
4. app.useWebSocketAdapter() sets adapter
5. But Gateway might have already created server WITHOUT adapter
6. Result: Gateway broadcasts locally, Redis adapter broadcasts globally
   → Duplicate messages on different servers
   → Clients miss updates from other servers
```

---

## 📊 Current WebSocket Flow

### 1. Gateway Initialization (`EventsGateway.afterInit()`)

```typescript
async afterInit() {
  // Step 1: Set server reference for TrackingService
  this.trackingService.setServer(this.server);

  // Step 2: Setup Redis subscriptions
  try {
    await this.setupRedisSubscriptions();
    this.logger.log('✅ Redis subscriptions set up');
  } catch (error) {
    // Silently continues - DANGEROUS in distributed system!
    this.logger.warn('⚠️ Redis subscriptions setup failed');
  }

  // Step 3: Start broadcast interval (3 second heartbeat)
  this.startPeriodicBroadcast();
}
```

### 2. Connection Handling

```typescript
handleConnection(client: Socket) {
  // Add to local tracking
  this.trackingService.addClient(client.id);

  // With Redis adapter: This info propagates to all servers
  // Without Redis adapter: This info is LOCAL ONLY
  this.broadcastConnectionStats();
}

handleDisconnect(client: Socket) {
  // With Redis adapter: Handled globally
  // Without Redis adapter: Other servers don't know about this
  this.viewportManager.removeViewport(client.id);
}
```

### 3. Subscription Management

```typescript
@SubscribeMessage('subscribeToAircraft')
handleSubscribeToAircraft(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: SubscribeAircraftDto,
) {
  const room = aircraftId ? `aircraft:${aircraftId}` : 'aircraft:all';

  // With Redis adapter: Joins room with global scope
  // Without Redis adapter: Joins room LOCAL ONLY
  client.join(room);
}
```

### 4. Broadcasting

```typescript
// In Redis subscription handler:
this.server.to(room).emit("aircraftUpdate", message);

// With Redis adapter: Delivers to ALL servers' matching rooms
// Without Redis adapter: Delivers only to LOCAL server's rooms
```

---

## 🔍 Key Points of Failure

### 1. **Async Initialization Gap**

| Phase                            | Status | Notes                                                |
| -------------------------------- | ------ | ---------------------------------------------------- |
| `RedisIoAdapter` created         | ✅     | Constructor runs                                     |
| `connectToRedis()` starts        | ⏳     | Async operation begins                               |
| `setServer()` called             | ⏳     | May happen during connection                         |
| `app.useWebSocketAdapter()`      | ⏳     | Sets adapter on server                               |
| **Gateway's `afterInit()` runs** | ❓     | **When does this happen relative to adapter setup?** |

### 2. **Redis Subscription Failures**

The gateway silently handles Redis subscription failures:

```typescript
try {
  await this.setupRedisSubscriptions();
} catch (error) {
  this.logger.warn("⚠️ Redis subscriptions setup failed");
  // ← CONTINUES WITHOUT REDIS!
}
```

**Risk**: Server acts as if it has Redis when it doesn't.

### 3. **No Health Check**

No mechanism to verify:

- Redis adapter is active
- Redis connections are healthy
- Multi-server broadcast is working

---

## 📡 Message Flow Analysis

### Scenario 1: Single Server (No Redis)

```
Client A connects to Server 1
    ↓
Server 1: handleConnection(client)
    ↓
Server 1: Broadcasts to local rooms only
    ↓
Result: ✅ Works fine for single server
```

### Scenario 2: Two Servers (With Redis Adapter)

```
Client A connects to Server 1    Client B connects to Server 2
    ↓                                   ↓
Server 1: handleConnection()      Server 2: handleConnection()
    ↓                                   ↓
    └─→ Redis Adapter broadcasts both events
        ↓
        Server 1 receives: "Client B connected"
        Server 2 receives: "Client A connected"
        ↓
Result: ✅ Both servers know about both clients
```

### Scenario 3: Two Servers (WITHOUT Redis Adapter)

```
Client A connects to Server 1    Client B connects to Server 2
    ↓                                   ↓
Server 1 only knows: Client A    Server 2 only knows: Client B
    ↓                                   ↓
Server 1 broadcasts aircraft update to room "aircraft:123"
    ↓
    Server 1's Client A gets update
    Server 2's Client B NEVER gets update ❌

Result: ❌ Inconsistent state, missed updates
```

---

## 🔧 Debugging Checklist

### Immediate Verification

- [ ] **Check Redis Connection**

  ```bash
  redis-cli ping  # Should return PONG
  redis-cli CLIENT LIST  # Should show socket.io connections
  ```

- [ ] **Verify Adapter Is Active**

  ```typescript
  // In events.gateway.ts, add to afterInit():
  const adapter = this.server.of("/tracking").adapter;
  this.logger.log("Socket.IO Adapter Type:", adapter.constructor.name);
  this.logger.log(
    "Adapter is Redis?",
    adapter.constructor.name.includes("Redis")
  );
  ```

- [ ] **Check Multi-Server Broadcast**
  ```typescript
  // Test: Open two connections, check if both receive updates
  // Server 1 logs should show clients from both servers
  ```

### Log Analysis Points

Look for these patterns in logs:

```
✅ Socket.IO Redis Adapter connected
✅ Redis subscriptions set up
```

These MUST appear in order, with no errors between them.

---

## 🛠️ Proposed Solutions

### Solution 1: Ensure Redis Adapter Is Set BEFORE DI Instantiation

**Change in `main.ts`:**

```typescript
// Setup Redis adapter FIRST, before any modules are instantiated
const redisIoAdapter = new RedisIoAdapter(configService);
await redisIoAdapter.connectToRedis();

// THEN create the app with configured adapter
const app = await NestFactory.create(AppModule, {
  // Use custom provider for RedisIoAdapter
});
app.useWebSocketAdapter(redisIoAdapter);

// NOW let gateways initialize with adapter already in place
```

**Problem**: NestJS instantiates modules before we can set the adapter.

### Solution 2: Lazy Initialize Gateway Until Adapter Is Ready

**Change in `events.gateway.ts`:**

```typescript
async afterInit() {
  this.logger.log('🟡 Gateway initializing...');

  // Wait for adapter to be fully ready
  const maxRetries = 10;
  let adapterReady = false;

  for (let i = 0; i < maxRetries; i++) {
    const adapter = this.server.of('/tracking').adapter;
    if (adapter && adapter.constructor.name.includes('Redis')) {
      adapterReady = true;
      break;
    }
    await this.delay(100);
  }

  if (!adapterReady) {
    this.logger.error('❌ Redis adapter not initialized!');
    throw new Error('Redis adapter failed to initialize');
  }

  this.logger.log('✅ Redis adapter confirmed');

  // Continue with normal initialization
  await this.setupRedisSubscriptions();
  this.startPeriodicBroadcast();
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Solution 3: Provide Fallback Behavior

**Change in `events.gateway.ts`:**

```typescript
private isRedisAdapterActive(): boolean {
  const adapter = this.server.of('/tracking').adapter;
  return adapter && adapter.constructor.name.includes('Redis');
}

@SubscribeMessage('subscribeToAircraft')
handleSubscribeToAircraft(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: SubscribeAircraftDto,
) {
  const room = aircraftId ? `aircraft:${aircraftId}` : 'aircraft:all';
  client.join(room);

  if (!this.isRedisAdapterActive()) {
    this.logger.warn('⚠️ Redis adapter not active - local broadcast only');
  }

  return { event: 'subscribed', data: { channel: room } };
}
```

### Solution 4: Add Comprehensive Health Check

**New file: `src/health/websocket-health.check.ts`:**

```typescript
import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import { EventsGateway } from "../events/events.gateway";

@Injectable()
export class WebSocketHealthCheck {
  constructor(
    private readonly redisService: RedisService,
    private readonly eventsGateway: EventsGateway
  ) {}

  async check(): Promise<{
    redisConnected: boolean;
    adapterActive: boolean;
    clientCount: number;
    status: "healthy" | "degraded" | "unhealthy";
  }> {
    const redisConnected = await this.redisService.ping();
    const adapter = this.eventsGateway.server?.of("/tracking")?.adapter;
    const adapterActive =
      adapter?.constructor?.name?.includes("Redis") || false;
    const clientCount = this.eventsGateway.server?.engine?.clientsCount || 0;

    return {
      redisConnected,
      adapterActive,
      clientCount,
      status: redisConnected && adapterActive ? "healthy" : "degraded",
    };
  }
}
```

---

## 📈 Performance Considerations

### Broadcast Interval (Current: 3 seconds)

```typescript
private readonly BROADCAST_INTERVAL_MS = 3000; // In events.gateway.ts
```

**Issue**: Every 3 seconds, the gateway broadcasts to ALL clients:

- Aircraft updates
- Vessel updates
- Viewport updates

**With 100 clients**: ~33 broadcasts/second worst case

**Solution**: Debounce or use viewport-based filtering

```typescript
private startPeriodicBroadcast() {
  this.broadcastInterval = setInterval(() => {
    // Only broadcast if there are changes
    const hasUpdates = this.trackingService.hasUpdates();
    if (!hasUpdates) return;

    // Broadcast only to affected viewports
    this.broadcastViewportData();
  }, this.BROADCAST_INTERVAL_MS);
}
```

### Memory Usage with Large Client Count

- Each client connection stores viewport in `ViewportManager`
- Each viewport maintains geohash
- Memory grows O(N) with clients

**Monitor**: Check RSS memory growth over time

---

## 🔐 Security Considerations

### WebSocket Authentication

Current: `WsAuthGuard` validates JWT

**Check**: Is Redis connection authenticated?

```typescript
// In redis-io.adapter.ts
const redisUrl = this.configService.get<string>(
  "REDIS_URL",
  "redis://localhost:6379"
);

// Should be:
// redis://username:password@host:6379 (if Redis has auth)
// OR: redis-stack with ACL
```

### Cross-Origin Issues

```typescript
@WebSocketGateway({
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:4000').split(','),
    credentials: true,
  },
  namespace: '/tracking',
})
```

**Verify**: `ALLOWED_ORIGINS` environment variable is correctly set for production.

---

## 📝 Testing Checklist

### Unit Tests Needed

- [ ] `EventsGateway.afterInit()` - Redis adapter verification
- [ ] `RedisIoAdapter.connectToRedis()` - Connection timeout handling
- [ ] `handleConnection()` - Proper room joining across servers
- [ ] `setupRedisSubscriptions()` - Message filtering and routing

### Integration Tests Needed

- [ ] Two servers with shared Redis
- [ ] Client connects to Server 1, receives update from Server 2
- [ ] Client disconnects from Server 1, Server 2 still knows about it
- [ ] Redis failure: graceful degradation

### Load Tests Needed

- [ ] 1000+ concurrent connections
- [ ] Broadcast message timing (should be <100ms)
- [ ] Memory usage patterns

---

## 📚 Related Files

| File                             | Purpose                  | Status                            |
| -------------------------------- | ------------------------ | --------------------------------- |
| `src/main.ts`                    | Application bootstrap    | ⚠️ **Initialization order issue** |
| `src/config/redis-io.adapter.ts` | Socket.IO Redis adapter  | ✅ Well implemented               |
| `src/events/events.gateway.ts`   | WebSocket event handlers | ⚠️ **Missing health checks**      |
| `src/redis/redis.service.ts`     | Redis operations         | ✅ Seems robust                   |
| `src/events/tracking.service.ts` | Client tracking          | ✅ Core logic                     |
| `src/events/viewport.manager.ts` | Viewport calculations    | ✅ Core logic                     |

---

## 🚀 Next Steps

### Immediate (Today)

1. Add adapter verification in `EventsGateway.afterInit()`
2. Check Redis connectivity at startup
3. Add logging for all Socket.IO events
4. Monitor for duplicate messages

### Short-term (This Week)

1. Implement health check endpoint
2. Add tests for multi-server scenarios
3. Profile broadcast performance
4. Review error handling in Redis subscriptions

### Long-term (This Month)

1. Optimize broadcast mechanism (viewport-based)
2. Implement message deduplication
3. Add metrics/monitoring for Socket.IO
4. Document deployment for multi-server setup

---

## 📞 Questions to Answer

1. **Are you running single or multiple servers?**

   - Single: Redis adapter is optional
   - Multiple: Redis adapter is CRITICAL

2. **What errors do you see in logs?**

   - Search for: "Redis", "Adapter", "subscription"

3. **Do clients miss messages?**

   - Indicates adapter not working

4. **Does memory grow unbounded?**
   - Indicates client cleanup not working

---

## 📖 References

- [Socket.IO Redis Adapter Docs](https://socket.io/docs/v4/redis-adapter/)
- [NestJS WebSocket Documentation](https://docs.nestjs.com/websockets/gateways)
- [Socket.IO Horizontal Scaling](https://socket.io/docs/v4/socket-io-mongodb-adapter/)

---

**Last Updated:** 2025-01-27  
**Status:** Analysis Complete - Action Items Identified
