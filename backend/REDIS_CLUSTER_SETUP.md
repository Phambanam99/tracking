# Redis Cluster Setup Guide

## Overview

Redis Cluster provides horizontal scaling and high availability.

## Configuration

```typescript
// redis.service.ts - Cluster mode
const redisConfig = {
  cluster: [
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 },
  ],
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    keyPrefix: process.env.REDIS_KEY_PREFIX,
  },
};

this.redisClient = new Redis.Cluster(redisConfig.cluster, {
  redisOptions: redisConfig.redisOptions,
});
```

## Environment Variables

```env
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379
REDIS_KEY_PREFIX=ais:production:
```

## Benefits

- Horizontal scaling
- High availability
- Automatic failover
- Data sharding
