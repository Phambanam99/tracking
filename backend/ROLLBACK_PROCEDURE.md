# 🔄 Rollback Procedure

## Quick Rollback (5 minutes)

### Step 1: Stop Current Version

```bash
pm2 stop backend
# or
docker stop ais-backend
```

### Step 2: Restore Database

```bash
# Find latest backup
ls -lh backups/ | tail -5

# Restore
gunzip -c backups/backup_TIMESTAMP.sql.gz | psql -h localhost -U postgres tracking
```

### Step 3: Revert Code

```bash
# Option A: Git revert
git log --oneline -10
git revert COMMIT_HASH

# Option B: Git reset (if not pushed)
git reset --hard HEAD~1

# Option C: Checkout previous tag
git checkout v1.0.0
```

### Step 4: Rebuild & Start

```bash
npm install
npm run build
pm2 start dist/main.js --name backend
```

### Step 5: Verify

```bash
curl http://localhost:3001/
pm2 logs backend
```

---

## Full Rollback Checklist

- [ ] **Stop backend** - `pm2 stop backend`
- [ ] **Backup current state** - Just in case
- [ ] **Restore database** - From backup
- [ ] **Revert code** - Git revert/reset
- [ ] **Clear Redis** - `redis-cli FLUSHDB` (if needed)
- [ ] **Rebuild** - `npm run build`
- [ ] **Start old version** - `pm2 start`
- [ ] **Verify health** - Check endpoints
- [ ] **Monitor logs** - Watch for errors
- [ ] **Update team** - Notify of rollback

---

## Rollback Scenarios

### Scenario 1: High Error Rate

```bash
# Immediate rollback
pm2 stop backend
git checkout previous_stable_tag
npm run build
pm2 start dist/main.js
```

### Scenario 2: Database Corruption

```bash
# Restore DB first
gunzip -c backups/backup_LATEST.sql.gz | psql tracking
# Then rollback code
git revert COMMIT_HASH
npm run build
pm2 restart backend
```

### Scenario 3: Memory Leak

```bash
# Quick restart first
pm2 restart backend
# If persists, rollback
pm2 stop backend
git checkout stable
npm run build
pm2 start dist/main.js
```

---

## Prevention

- Always backup before deployment
- Test in staging first
- Use feature flags
- Deploy during low-traffic hours
- Have monitoring alerts
- Keep previous version ready
