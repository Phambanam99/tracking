# Hướng dẫn Deploy trên CentOS/RHEL

Hướng dẫn chi tiết cài đặt và deploy ứng dụng Tracking trên CentOS 7/8/9 hoặc RHEL.

## 📋 Yêu cầu hệ thống

- CentOS 7/8/9 hoặc RHEL 7/8/9
- RAM: Tối thiểu 4GB (Khuyến nghị 8GB+)
- CPU: 2 cores trở lên
- Disk: 20GB trống
- Quyền root hoặc sudo

## 🔧 Bước 1: Cài đặt Docker và Docker Compose

### CentOS 7

```bash
# Update hệ thống
sudo yum update -y

# Cài đặt các package cần thiết
sudo yum install -y yum-utils device-mapper-persistent-data lvm2

# Thêm Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Cài đặt Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io

# Start và enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Kiểm tra Docker
sudo docker --version
```

### CentOS 8/9 (hoặc Rocky Linux/AlmaLinux)

```bash
# Update hệ thống
sudo dnf update -y

# Cài đặt các package cần thiết
sudo dnf install -y dnf-plugins-core

# Thêm Docker repository
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Cài đặt Docker
sudo dnf install -y docker-ce docker-ce-cli containerd.io

# Start và enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Kiểm tra Docker
sudo docker --version
```

### Cài đặt Docker Compose

```bash
# Tải Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Cấp quyền thực thi
sudo chmod +x /usr/local/bin/docker-compose

# Tạo symlink (optional)
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Kiểm tra
docker-compose --version
```

### Thêm user vào group docker (không cần sudo)

```bash
sudo usermod -aG docker $USER

# Logout và login lại để apply
# Hoặc chạy:
newgrp docker

# Kiểm tra
docker ps
```

## 🔐 Bước 2: Cấu hình Firewall

```bash
# Mở ports cần thiết
sudo firewall-cmd --permanent --add-port=3001/tcp  # Backend API
sudo firewall-cmd --permanent --add-port=4000/tcp  # Frontend
sudo firewall-cmd --permanent --add-port=5432/tcp  # PostgreSQL (nếu cần)
sudo firewall-cmd --permanent --add-port=6379/tcp  # Redis (nếu cần)

# Reload firewall
sudo firewall-cmd --reload

# Kiểm tra
sudo firewall-cmd --list-ports
```

Nếu dùng Nginx làm reverse proxy:

```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## 📦 Bước 3: Cài đặt Git (nếu chưa có)

```bash
# CentOS 7
sudo yum install -y git

# CentOS 8/9
sudo dnf install -y git

# Kiểm tra
git --version
```

## 🚀 Bước 4: Clone và chuẩn bị source code

```bash
# Tạo thư mục cho application
sudo mkdir -p /opt/tracking
sudo chown $USER:$USER /opt/tracking
cd /opt/tracking

# Clone repository
git clone https://github.com/Phambanam99/tracking.git .

# Hoặc upload code bằng SCP/SFTP
# scp -r ./tracking user@server:/opt/tracking/
```

## ⚙️ Bước 5: Import Database từ Local (Quan trọng!)

### Chuẩn bị file backup trên Local (Windows)

```powershell
# Trên máy local, export database
cd "C:\Program Files\PostgreSQL\16\bin"

# Export database
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking -F c -b -v -f "C:\backups\tracking_backup.dump"

# Hoặc dạng SQL
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking > "C:\backups\tracking_backup.sql"
```

**Nếu database trong Docker:**

```powershell
docker exec -t tracking-postgis pg_dump -U admin -d tracking -F c > C:\backups\tracking_backup.dump
```

### Upload file backup lên Server

```bash
# Từ Windows, upload lên server
scp C:\backups\tracking_backup.dump user@YOUR_SERVER_IP:/opt/tracking/backups/

# Hoặc dùng WinSCP (GUI)
```

### Import database trên Server

```bash
# SSH vào server
ssh user@YOUR_SERVER_IP

# Tạo thư mục backup
sudo mkdir -p /opt/tracking/backups

# Verify file đã upload
ls -lh /opt/tracking/backups/tracking_backup.dump
```

**Nếu sử dụng docker-compose.prod.yml (có database trong Docker):**

```bash
# Start chỉ database trước
cd /opt/tracking
docker-compose -f docker-compose.prod.yml up -d db

# Đợi database sẵn sàng
sleep 15

# Copy file vào container
docker cp /opt/tracking/backups/tracking_backup.dump tracking-postgis-prod:/tmp/

# Import database
docker exec -it tracking-postgis-prod pg_restore -U admin -d tracking -v /tmp/tracking_backup.dump

# Hoặc với SQL file
docker exec -i tracking-postgis-prod psql -U admin -d tracking < /opt/tracking/backups/tracking_backup.sql
```

**Verify import:**

```bash
# Kết nối database
docker exec -it tracking-postgis-prod psql -U admin -d tracking

# Kiểm tra tables và data
\dt
SELECT COUNT(*) FROM "Aircraft";
SELECT COUNT(*) FROM "Vessel";
\q
```

> 📝 **Lưu ý**: Xem chi tiết trong [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)

## ⚙️ Bước 6: Cấu hình môi trường

```bash
# Copy file template
cp .env.production .env.production.local

# Chỉnh sửa cấu hình
nano .env.production.local
# Hoặc dùng vi
vi .env.production.local
```

### Cấu hình quan trọng:

```env
# Database - Kết nối đến database trong Docker (đã import data)
DATABASE_URL=postgresql://admin:Phamnam99@db:5432/tracking?schema=public&connection_limit=50&pool_timeout=10
DIRECT_DATABASE_URL=postgresql://admin:Phamnam99@db:5432/tracking?schema=public

# Hoặc nếu database trên host machine
# DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public

# Security - ĐỔI NGAY!
JWT_SECRET=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 24)

# URLs - Thay YOUR_SERVER_IP bằng IP server
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:3001
NEXT_PUBLIC_WS_URL=ws://YOUR_SERVER_IP:3001
CORS_ORIGIN=http://YOUR_SERVER_IP:4000

# Ports
BACKEND_PORT=3001
FRONTEND_PORT=4000
REDIS_PORT=6379
```

### Generate JWT secret và Redis password tự động:

```bash
# Tạo JWT secret ngẫu nhiên
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"

# Tạo Redis password ngẫu nhiên
REDIS_PASSWORD=$(openssl rand -base64 24)
echo "REDIS_PASSWORD=$REDIS_PASSWORD"

# Copy vào .env.production.local
```

## 🐳 Bước 7: Deploy ứng dụng

### Phương án 1: Dùng script tự động (Khuyến nghị)

```bash
# Cấp quyền thực thi
chmod +x deploy-production.sh

# Deploy
./deploy-production.sh start

# Xem logs
./deploy-production.sh logs

# Kiểm tra status
./deploy-production.sh status
```

### Phương án 2: Dùng Docker Compose trực tiếp

```bash
# Build và start
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d --build

# Xem logs
docker-compose -f docker-compose.production.yml logs -f

# Kiểm tra containers
docker-compose -f docker-compose.production.yml ps
```

## ✅ Bước 8: Kiểm tra deployment

```bash
# Kiểm tra containers đang chạy
docker ps

# Test backend health
curl http://localhost:3001/api/health

# Test frontend
curl http://localhost:4000

# Test từ máy khác (thay YOUR_SERVER_IP)
curl http://YOUR_SERVER_IP:3001/api/health
curl http://YOUR_SERVER_IP:4000
```

## 🌐 Bước 9: Cấu hình Nginx Reverse Proxy (Khuyến nghị cho production)

### Cài đặt Nginx

```bash
# CentOS 7
sudo yum install -y epel-release
sudo yum install -y nginx

# CentOS 8/9
sudo dnf install -y nginx

# Start và enable
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Cấu hình Nginx

```bash
# Tạo file cấu hình
sudo nano /etc/nginx/conf.d/tracking.conf
```

Thêm nội dung:

```nginx
# Upstream backends
upstream backend_api {
    server localhost:3001;
}

upstream frontend_app {
    server localhost:4000;
}

# Redirect HTTP to HTTPS (sau khi có SSL)
# server {
#     listen 80;
#     server_name your-domain.com;
#     return 301 https://$server_name$request_uri;
# }

# Main server block
server {
    listen 80;
    server_name your-domain.com;  # Thay bằng domain hoặc IP của bạn

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Increase upload size
    client_max_body_size 50M;

    # Frontend
    location / {
        proxy_pass http://frontend_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket (Socket.IO)
    location /socket.io {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://backend_api/api/health;
    }
}
```

### Apply cấu hình Nginx

```bash
# Test cấu hình
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Kiểm tra status
sudo systemctl status nginx
```

### Cập nhật .env.production.local sau khi có Nginx

```env
# Nếu dùng Nginx, URLs sẽ là:
NEXT_PUBLIC_API_URL=http://your-domain.com
NEXT_PUBLIC_WS_URL=ws://your-domain.com
CORS_ORIGIN=http://your-domain.com

# Hoặc với IP
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP
NEXT_PUBLIC_WS_URL=ws://YOUR_SERVER_IP
CORS_ORIGIN=http://YOUR_SERVER_IP
```

Sau đó restart containers:

```bash
./deploy-production.sh restart
```

## 🔒 Bước 10: Cài đặt SSL/TLS với Let's Encrypt (Khuyến nghị)

### Cài đặt Certbot

```bash
# CentOS 7
sudo yum install -y certbot python2-certbot-nginx

# CentOS 8/9
sudo dnf install -y certbot python3-certbot-nginx
```

### Lấy SSL certificate

```bash
# Thay your-domain.com bằng domain thật
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Làm theo hướng dẫn:
# 1. Nhập email
# 2. Đồng ý Terms of Service
# 3. Chọn redirect HTTP to HTTPS (khuyến nghị)
```

### Tự động renew certificate

```bash
# Test renew
sudo certbot renew --dry-run

# Certificate sẽ tự động renew, kiểm tra cron job
sudo systemctl status certbot-renew.timer
```

### Cập nhật URLs sau khi có SSL

```env
# Trong .env.production.local
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com
CORS_ORIGIN=https://your-domain.com
```

Restart containers:

```bash
./deploy-production.sh restart
```

## 🔄 Bước 11: Thiết lập tự động khởi động

### Tạo systemd service

```bash
sudo nano /etc/systemd/system/tracking.service
```

Thêm nội dung:

```ini
[Unit]
Description=Tracking Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/tracking
ExecStart=/usr/local/bin/docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.production.yml down
User=root

[Install]
WantedBy=multi-user.target
```

### Enable service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable tracking.service

# Start service
sudo systemctl start tracking.service

# Kiểm tra status
sudo systemctl status tracking.service
```

## 📊 Bước 12: Monitoring và Logging

### Xem logs

```bash
# All containers
docker-compose -f docker-compose.production.yml logs -f

# Backend only
docker logs tracking-backend-prod -f

# Frontend only
docker logs tracking-frontend-prod -f

# Redis only
docker logs tracking-redis-prod -f
```

### Kiểm tra resource usage

```bash
# Docker stats
docker stats

# System resources
top
htop  # Cài: sudo yum install htop
```

### Cài đặt log rotation

```bash
# Tạo logrotate config
sudo nano /etc/logrotate.d/docker-containers
```

Thêm:

```
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

## 🔐 Bước 13: Hardening bảo mật

### Cấu hình SELinux (nếu đang bật)

```bash
# Kiểm tra SELinux status
getenforce

# Nếu đang enforcing, cấu hình cho phép Docker
sudo setsebool -P container_manage_cgroup 1
sudo setsebool -P container_use_devices 1

# Hoặc tạm thời disable (không khuyến nghị production)
# sudo setenforce 0
```

### Cập nhật hệ thống định kỳ

```bash
# Setup auto update
sudo yum install -y yum-cron  # CentOS 7
sudo dnf install -y dnf-automatic  # CentOS 8/9

# Enable
sudo systemctl enable yum-cron  # CentOS 7
sudo systemctl enable dnf-automatic.timer  # CentOS 8/9

sudo systemctl start yum-cron  # CentOS 7
sudo systemctl start dnf-automatic.timer  # CentOS 8/9
```

### Fail2ban (bảo vệ SSH)

```bash
# Cài đặt
sudo yum install -y epel-release
sudo yum install -y fail2ban

# Enable và start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Kiểm tra
sudo fail2ban-client status
```

## 📦 Backup và Restore

### Backup Redis data

```bash
# Tạo backup directory
sudo mkdir -p /opt/tracking/backups

# Backup Redis
docker run --rm \
  -v tracking_redis_data_prod:/data \
  -v /opt/tracking/backups:/backup \
  alpine tar czf /backup/redis_$(date +%Y%m%d_%H%M%S).tar.gz /data
```

### Backup uploaded files

```bash
# Backup uploads
docker run --rm \
  -v tracking_backend_uploads:/data \
  -v /opt/tracking/backups:/backup \
  alpine tar czf /backup/uploads_$(date +%Y%m%d_%H%M%S).tar.gz /data
```

### Script backup tự động

```bash
# Tạo backup script
nano /opt/tracking/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/tracking/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup Redis
docker run --rm \
  -v tracking_redis_data_prod:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/redis_$DATE.tar.gz /data

# Backup uploads
docker run --rm \
  -v tracking_backend_uploads:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/uploads_$DATE.tar.gz /data

# Xóa backup cũ hơn 7 ngày
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Cấp quyền
chmod +x /opt/tracking/backup.sh

# Thêm vào crontab (chạy hàng ngày lúc 2AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/tracking/backup.sh >> /var/log/tracking-backup.log 2>&1") | crontab -
```

## 🔄 Update ứng dụng

```bash
# Vào thư mục project
cd /opt/tracking

# Pull code mới
git pull

# Rebuild và restart
./deploy-production.sh update

# Hoặc thủ công
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d --build
```

## 🔍 Troubleshooting

### Containers không start

```bash
# Xem logs
docker-compose -f docker-compose.production.yml logs

# Kiểm tra ports
sudo netstat -tulpn | grep -E '3001|4000|6379'

# Kiểm tra firewall
sudo firewall-cmd --list-all
```

### Database connection failed

```bash
# Kiểm tra database đang chạy
sudo systemctl status postgresql  # Nếu PostgreSQL local
docker ps | grep postgres  # Nếu PostgreSQL trong Docker

# Test kết nối database
docker exec -it tracking-backend-prod sh
nc -zv host.docker.internal 5432
# Hoặc
telnet host.docker.internal 5432
```

### Permission denied

```bash
# Fix quyền cho Docker volumes
sudo chown -R 1000:1000 /opt/tracking/data/

# Fix quyền cho uploads
docker exec -it tracking-backend-prod sh -c "chown -R node:node /app/uploads"
```

### Out of memory

```bash
# Kiểm tra memory
free -h

# Tăng swap
sudo dd if=/dev/zero of=/swapfile bs=1G count=4
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Thêm vào /etc/fstab để auto mount
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 📞 Checklist triển khai

- [ ] Docker và Docker Compose đã cài
- [ ] Firewall đã mở ports cần thiết
- [ ] Code đã clone về server
- [ ] **Database đã export từ local** ⭐
- [ ] **Database đã import lên server** ⭐
- [ ] **Verify data trong database** ⭐
- [ ] File .env.production.local đã tạo và cấu hình
- [ ] DATABASE_URL đã trỏ đúng database
- [ ] JWT_SECRET và REDIS_PASSWORD đã đổi
- [ ] Containers đã start thành công
- [ ] Backend health check OK
- [ ] Frontend truy cập được
- [ ] **Dữ liệu từ local hiển thị chính xác** ⭐
- [ ] Nginx reverse proxy đã cấu hình (nếu dùng)
- [ ] SSL certificate đã cài (nếu có domain)
- [ ] Systemd service đã enable
- [ ] Backup script đã thiết lập
- [ ] Monitoring đã cấu hình

## 🎉 Hoàn thành!

Application đang chạy tại:

- **Frontend**: http://YOUR_SERVER_IP:4000 (hoặc https://your-domain.com)
- **Backend API**: http://YOUR_SERVER_IP:3001 (hoặc https://your-domain.com/api)

## 📚 Tài liệu tham khảo

- [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) - **Hướng dẫn Export/Import Database** ⭐
- [PRODUCTION_README.md](./PRODUCTION_README.md) - Tổng quan production
- [DEPLOY_QUICK_START.md](./DEPLOY_QUICK_START.md) - Hướng dẫn nhanh
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Chi tiết deployment
