# Quick Start Guide for Production Deployment

## 🚀 Quick Deploy (5 minutes)

### Step 1: Configure Environment

```bash
# Copy and edit environment file
cp .env.prod.example .env.prod
```

Edit `.env.prod` and set these **critical** values:

```bash
POSTGRES_PASSWORD=your-strong-password-here
REDIS_PASSWORD=your-redis-password-here
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
CORS_ORIGIN=http://localhost:4000  # Change to your domain in production
```

### Step 2: Deploy

**Windows:**

```powershell
.\deploy.ps1
```

**Linux/Mac:**

```bash
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Verify

Visit:

- Frontend: http://localhost:4000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api

## ⚡ Quick Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Backup database
.\backup-database.ps1  # Windows
./backup-database.sh   # Linux/Mac
```

## 📂 Where Data is Stored

All persistent data is in the `data/` directory:

- `data/postgres/` - Database
- `data/redis/` - Cache
- `data/uploads/` - User files
- `data/logs/` - Application logs
- `backups/` - Database backups

**IMPORTANT: Backup the `data/` directory regularly!**

## 🔧 Troubleshooting

### Services won't start?

```bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs
```

### Port already in use?

Edit `.env.prod` and change:

```bash
FRONTEND_PORT=4001  # Instead of 4000
BACKEND_PORT=3002   # Instead of 3001
```

### Need to rebuild?

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## 📖 Full Documentation

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

## ⚠️ Security Checklist

Before going to production:

- [ ] Changed all default passwords
- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Updated CORS_ORIGIN to your domain
- [ ] Configured HTTPS (use nginx/traefik)
- [ ] Set up regular backups
- [ ] Configured firewall rules
- [ ] Disabled admin tools (pgAdmin, RedisInsight)
