# ✅ Deployment Checklist - P1-P3

## 📋 Pre-Deployment (Do Before Testing)

### Environment Setup

- [ ] Node.js installed (v16+)
- [ ] npm installed
- [ ] Redis running (`redis-cli ping`)
- [ ] PostgreSQL accessible
- [ ] `.env` file configured with:
  - [ ] `DATABASE_URL`
  - [ ] `DIRECT_DATABASE_URL` (new for P2.3)
  - [ ] `REDIS_URL`
  - [ ] `JWT_SECRET`

### Code Preparation

- [ ] All dependencies installed (`npm install`)
- [ ] Code compiles (`npm run build`)
- [ ] TypeScript check passes (`npx tsc --noEmit`)
- [ ] No critical errors in logs

---

## 🧪 Testing Phase (5-10 minutes)

### Basic Tests

- [ ] Backend starts successfully (`npm run start:dev`)
- [ ] Root endpoint responds (`curl http://localhost:3001/`)
- [ ] Metrics endpoint works (`curl http://localhost:3001/metrics`)
- [ ] Prometheus endpoint works (`curl http://localhost:3001/metrics/prometheus`)

### Feature Verification

- [ ] **P1: Deadlock Fix** - No deadlock errors in logs
- [ ] **P1: LRU Cache** - Cache hits visible in logs
- [ ] **P1: Timestamp Validation** - Invalid timestamps rejected
- [ ] **P2: RedisJSON** - Vessel data in Redis (if Redis Stack available)
- [ ] **P2: Batch Insert** - "Batch inserted" messages in logs
- [ ] **P2: Connection Pool** - Connection pooling active
- [ ] **P3: Circuit Breaker** - Circuit breaker initialized
- [ ] **P3: DLQ** - DLQ service started
- [ ] **P3: Prometheus** - Metrics exported correctly

### Metrics Check

- [ ] `ais_messages_processed_total` present
- [ ] `ais_latency_p99_ms` present
- [ ] `ais_dlq_size` present
- [ ] `circuit_breaker_state` present
- [ ] No error metrics spiking

---

## 🚀 Deployment Phase (2-5 minutes)

### Backup

- [ ] **CRITICAL:** Database backed up
  ```bash
  pg_dump tracking > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Backup file verified (non-zero size)
- [ ] Backup location noted: `___________________`

### Stop Old Version

- [ ] Current backend stopped gracefully
- [ ] No active connections remaining
- [ ] Old process fully terminated

### Deploy New Version

- [ ] Code pulled/copied to production server
- [ ] Dependencies installed (`npm install`)
- [ ] Production build created (`npm run build`)
- [ ] Environment variables updated
- [ ] New version started:
  - [ ] PM2: `pm2 start dist/main.js --name backend`
  - [ ] Docker: `docker run -d ais-backend`
  - [ ] Direct: `node dist/main.js`

### Immediate Verification

- [ ] Backend started without errors
- [ ] Health check passes (within 30 seconds)
- [ ] No critical errors in first 2 minutes of logs
- [ ] Metrics endpoint responding

---

## 📊 Post-Deployment Monitoring

### First 5 Minutes

- [ ] No crashes
- [ ] No error spikes
- [ ] Metrics updating
- [ ] Logs look normal

### First 15 Minutes

- [ ] Throughput: `_____` msg/sec (target: 5-10k)
- [ ] Latency p99: `_____` ms (target: <50ms)
- [ ] Error rate: `_____` % (target: <1%)
- [ ] DLQ size: `_____` (target: <10)
- [ ] Circuit breaker: CLOSED (0)

### First Hour (Check every 10 minutes)

**10 min:**

- [ ] Throughput stable
- [ ] Latency acceptable
- [ ] No errors

**20 min:**

- [ ] Throughput stable
- [ ] Latency acceptable
- [ ] No errors

**30 min:**

- [ ] Throughput stable
- [ ] Latency acceptable
- [ ] No errors

**40 min:**

- [ ] Throughput stable
- [ ] Latency acceptable
- [ ] No errors

**50 min:**

- [ ] Throughput stable
- [ ] Latency acceptable
- [ ] No errors

**60 min:**

- [ ] Throughput stable
- [ ] Latency acceptable
- [ ] No errors
- [ ] **MILESTONE: 1 hour stable ✅**

---

## 🎯 Success Criteria

### Must Pass (Critical)

- [ ] Uptime: 100% (no crashes in first hour)
- [ ] Error rate: <1%
- [ ] Data loss: 0%
- [ ] Circuit breaker: CLOSED

### Should Pass (Important)

- [ ] Throughput: 5-10k msg/sec
- [ ] Latency p99: <50ms
- [ ] DLQ size: <10
- [ ] Memory usage: <1GB

### Nice to Have (Optimal)

- [ ] Throughput: 8-10k msg/sec
- [ ] Latency p99: <30ms
- [ ] DLQ size: 0
- [ ] Cache hit rate: >90%

---

## ⚠️ Rollback Triggers

**Rollback immediately if:**

- [ ] Backend crashes more than once
- [ ] Error rate >10%
- [ ] Data loss detected
- [ ] Circuit breaker stuck OPEN for >5 minutes
- [ ] Memory leak detected (>2GB)
- [ ] Database corruption

**Consider rollback if:**

- [ ] Throughput <2k msg/sec (worse than before)
- [ ] Latency p99 >200ms (worse than before)
- [ ] DLQ size >100
- [ ] Unusual errors in logs

---

## 🔄 Rollback Procedure

### If Rollback Needed:

1. [ ] **Stop new version**

   ```bash
   pm2 stop backend
   ```

2. [ ] **Restore database** (if needed)

   ```bash
   psql tracking < backup_TIMESTAMP.sql
   ```

3. [ ] **Start old version**

   ```bash
   git checkout previous_commit
   npm run build
   pm2 start dist/main.js --name backend
   ```

4. [ ] **Verify old version working**

   ```bash
   curl http://localhost:3001/
   pm2 logs backend
   ```

5. [ ] **Document issue**
   - What went wrong: `___________________`
   - Error messages: `___________________`
   - Metrics at failure: `___________________`

---

## 📝 Deployment Log

**Date:** `___________________`  
**Time:** `___________________`  
**Deployed by:** `___________________`  
**Version:** P1-P3-complete

### Pre-Deployment

- Environment checks: ✅ / ❌
- Code compiled: ✅ / ❌
- Tests passed: ✅ / ❌
- Backup created: ✅ / ❌

### Deployment

- Old version stopped: ✅ / ❌
- New version deployed: ✅ / ❌
- New version started: ✅ / ❌
- Health check passed: ✅ / ❌

### Post-Deployment (1 hour)

- No crashes: ✅ / ❌
- Metrics acceptable: ✅ / ❌
- No errors: ✅ / ❌
- Success criteria met: ✅ / ❌

### Issues Encountered

```
[None / List issues here]
```

### Rollback Performed

- [ ] No rollback needed
- [ ] Rollback performed - Reason: `___________________`

### Final Status

- [ ] ✅ **DEPLOYMENT SUCCESSFUL**
- [ ] ❌ **DEPLOYMENT FAILED** - Rolled back

### Notes

```
[Any additional notes, observations, or recommendations]
```

---

## 📞 Contact Information

**In case of emergency:**

- Primary contact: `___________________`
- Secondary contact: `___________________`
- Database admin: `___________________`
- DevOps team: `___________________`

**Useful links:**

- Monitoring dashboard: `___________________`
- Logs location: `___________________`
- Backup location: `___________________`
- Documentation: `backend/IMPLEMENTATION_SUMMARY.md`

---

## 🎉 Post-Deployment Tasks

### After Successful Deployment

- [ ] Update team on deployment status
- [ ] Schedule 24-hour review
- [ ] Set up monitoring alerts
- [ ] Document any issues encountered
- [ ] Plan next optimization phase

### Next Steps

- [ ] Monitor for 24 hours
- [ ] Set up Prometheus + Grafana
- [ ] Configure alerting rules
- [ ] Plan load testing
- [ ] Continue with remaining todos

---

**Signature:** `___________________`  
**Date:** `___________________`  
**Status:** `___________________`
