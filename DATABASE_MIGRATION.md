# Hướng dẫn Export/Import Database từ Local lên Server

Hướng dẫn chi tiết backup database từ máy local và restore lên server production.

## 🎯 Trường hợp phổ biến: Local và Server đều dùng Docker

Đây là cách đơn giản nhất vì cả hai môi trường giống nhau.

### ⚡ Quick Export/Import (Khuyến nghị)

#### Bước 1: Export từ Local (Windows)

```powershell
# Tạo thư mục backup
New-Item -ItemType Directory -Force -Path C:\backups

# Export database từ Docker container
docker exec -t tracking-postgis pg_dump -U admin -d tracking -F c > C:\backups\tracking_backup.dump

# Hoặc dạng SQL (dễ đọc hơn)
docker exec -t tracking-postgis pg_dump -U admin -d tracking > C:\backups\tracking_backup.sql

# Kiểm tra file đã tạo
Get-Item C:\backups\tracking_backup.*
```

#### Bước 2: Upload lên Server

```powershell
# Upload qua SCP (thay YOUR_SERVER_IP và user)
scp C:\backups\tracking_backup.dump user@YOUR_SERVER_IP:/opt/tracking/backups/

# Hoặc dùng WinSCP (GUI) - Tải tại: https://winscp.net/
```

#### Bước 3: Import trên Server (CentOS)

```bash
# SSH vào server
ssh user@YOUR_SERVER_IP

# Verify file đã upload
ls -lh /opt/tracking/backups/tracking_backup.dump

# Start database container (nếu chưa chạy)
cd /opt/tracking
docker-compose -f docker-compose.prod.yml up -d db

# Đợi database sẵn sàng
sleep 15

# Import database
docker exec -i tracking-postgis-prod psql -U admin -d tracking < /opt/tracking/backups/tracking_backup.sql

# Hoặc với custom format (.dump)
docker cp /opt/tracking/backups/tracking_backup.dump tracking-postgis-prod:/tmp/
docker exec -it tracking-postgis-prod pg_restore -U admin -d tracking -v -c /tmp/tracking_backup.dump
```

#### Bước 4: Verify Import

```bash
# Kiểm tra data
docker exec -it tracking-postgis-prod psql -U admin -d tracking -c "SELECT COUNT(*) FROM \"Aircraft\";"
docker exec -it tracking-postgis-prod psql -U admin -d tracking -c "SELECT COUNT(*) FROM \"Vessel\";"
docker exec -it tracking-postgis-prod psql -U admin -d tracking -c "\dt"
```

✅ **Xong!** Database từ local đã được import lên server.

---

## 📊 Phương án 1: Export/Import PostgreSQL (Khuyến nghị)

### Bước 1: Export database từ Local (Windows)

#### ✅ Dùng Docker (Nếu database trong Docker - Khuyến nghị)

```powershell
# Kiểm tra container đang chạy
docker ps | Select-String "postgres"

# Export database (Custom format - nhanh và nhỏ hơn)
docker exec -t tracking-postgis pg_dump -U admin -d tracking -F c > C:\backups\tracking_backup.dump

# Hoặc SQL format (dễ đọc, dễ sửa)
docker exec -t tracking-postgis pg_dump -U admin -d tracking > C:\backups\tracking_backup.sql

# Hoặc export chỉ data (không bao gồm schema)
docker exec -t tracking-postgis pg_dump -U admin -d tracking --data-only > C:\backups\tracking_data_only.sql

# Kiểm tra kích thước file
Get-ChildItem C:\backups\tracking_backup.* | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

**Giải thích:**

- `tracking-postgis`: Tên container database (kiểm tra bằng `docker ps`)
- `-U admin`: Username database
- `-d tracking`: Database name
- `-F c`: Custom format (binary, nén tốt)
- `>`: Redirect output ra file

#### Cách 1: Dùng pg_dump (Command Line)

```powershell
# Vào thư mục PostgreSQL bin (thay đổi version nếu cần)
cd "C:\Program Files\PostgreSQL\16\bin"

# Export toàn bộ database
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking -F c -b -v -f "C:\backups\tracking_backup.dump"

# Hoặc export dạng SQL text
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking > "C:\backups\tracking_backup.sql"

# Với password: Phamnam99
```

**Giải thích parameters:**

- `-h localhost`: Host database
- `-p 5432`: Port
- `-U admin`: Username
- `-d tracking`: Database name
- `-F c`: Format custom (binary)
- `-b`: Include blobs
- `-v`: Verbose (hiện chi tiết)
- `-f`: Output file

**Giải thích:**

- `tracking-postgis`: Tên container database (kiểm tra bằng `docker ps`)
- `-U admin`: Username database
- `-d tracking`: Database name
- `-F c`: Custom format (binary, nén tốt)
- `>`: Redirect output ra file

#### Cách 2: Dùng pg_dump CLI (Nếu có PostgreSQL client)

1. Mở pgAdmin
2. Kết nối đến database `tracking`
3. Click phải vào database → **Backup...**
4. Chọn:
   - **Format**: Custom hoặc Plain
   - **Filename**: `C:\backups\tracking_backup.dump`
   - **Encoding**: UTF8
5. Tab **Dump Options**:
   - ✅ Pre-data
   - ✅ Data
   - ✅ Post-data
   - ✅ Owner
6. Click **Backup**

```powershell
# Vào thư mục PostgreSQL bin (thay đổi version nếu cần)
cd "C:\Program Files\PostgreSQL\16\bin"

# Export toàn bộ database
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking -F c -b -v -f "C:\backups\tracking_backup.dump"

# Hoặc export dạng SQL text
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking > "C:\backups\tracking_backup.sql"

# Với password: Phamnam99
```

**Giải thích parameters:**

- `-h localhost`: Host database
- `-p 5432`: Port
- `-U admin`: Username
- `-d tracking`: Database name
- `-F c`: Format custom (binary)
- `-b`: Include blobs
- `-v`: Verbose (hiện chi tiết)
- `-f`: Output file

#### Cách 3: Dùng pgAdmin (GUI)

1. Mở pgAdmin
2. Kết nối đến database `tracking`
3. Click phải vào database → **Backup...**
4. Chọn:
   - **Format**: Custom hoặc Plain
   - **Filename**: `C:\backups\tracking_backup.dump`
   - **Encoding**: UTF8
5. Tab **Dump Options**:
   - ✅ Pre-data
   - ✅ Data
   - ✅ Post-data
   - ✅ Owner
6. Click **Backup**

### Bước 2: Upload file backup lên Server

#### Cách 1: Dùng SCP (Secure Copy)

```powershell
# Từ Windows (cần OpenSSH hoặc Git Bash)
scp C:\backups\tracking_backup.dump user@YOUR_SERVER_IP:/opt/tracking/backups/

# Với password
# scp C:\backups\tracking_backup.dump root@192.168.1.100:/opt/tracking/backups/
```

#### Cách 2: Dùng WinSCP (GUI)

1. Tải WinSCP: https://winscp.net/
2. Kết nối đến server (SSH)
3. Upload file `tracking_backup.dump` lên `/opt/tracking/backups/`

#### Cách 3: Dùng SFTP

```powershell
# Kết nối SFTP
sftp user@YOUR_SERVER_IP

# Upload file
put C:\backups\tracking_backup.dump /opt/tracking/backups/

# Thoát
exit
```

### Bước 3: Import database trên Server (CentOS)

#### Chuẩn bị trên Server

```bash
# SSH vào server
ssh user@YOUR_SERVER_IP

# Tạo thư mục backup (nếu chưa có)
sudo mkdir -p /opt/tracking/backups
cd /opt/tracking/backups

# Kiểm tra file đã upload
ls -lh tracking_backup.dump
```

#### Cách 1: Import trực tiếp vào PostgreSQL

**Nếu PostgreSQL chạy trên server (không phải Docker):**

```bash
# Tạo database mới (nếu chưa có)
sudo -u postgres psql -c "CREATE DATABASE tracking;"
sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'Phamnam99';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tracking TO admin;"

# Enable PostGIS extension
sudo -u postgres psql -d tracking -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Restore từ custom format
sudo -u postgres pg_restore -d tracking -v /opt/tracking/backups/tracking_backup.dump

# Hoặc từ SQL file
sudo -u postgres psql -d tracking < /opt/tracking/backups/tracking_backup.sql
```

**Nếu PostgreSQL trong Docker:**

```bash
# Copy file vào container
docker cp /opt/tracking/backups/tracking_backup.dump tracking-postgis-prod:/tmp/

# Restore
docker exec -it tracking-postgis-prod pg_restore -U admin -d tracking -v /tmp/tracking_backup.dump

# Hoặc với SQL file
docker exec -i tracking-postgis-prod psql -U admin -d tracking < /opt/tracking/backups/tracking_backup.sql
```

#### Cách 2: Import khi khởi tạo Database lần đầu

**Sửa docker-compose.prod.yml:**

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    container_name: tracking-postgis-prod
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: Phamnam99
      POSTGRES_DB: tracking
    volumes:
      - pg_data_prod:/var/lib/postgresql/data
      - /opt/tracking/backups/tracking_backup.sql:/docker-entrypoint-initdb.d/01-restore.sql:ro
    # ...
```

Khi container start lần đầu, file SQL sẽ tự động chạy.

### Bước 4: Verify Import

```bash
# Kết nối vào database
docker exec -it tracking-postgis-prod psql -U admin -d tracking

# Hoặc nếu PostgreSQL local
psql -U admin -d tracking
```

Trong psql:

```sql
-- Kiểm tra tables
\dt

-- Đếm số records trong các bảng quan trọng
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Aircraft";
SELECT COUNT(*) FROM "Vessel";
SELECT COUNT(*) FROM "AircraftPosition";
SELECT COUNT(*) FROM "VesselPosition";
SELECT COUNT(*) FROM "Region";

-- Kiểm tra PostGIS
SELECT PostGIS_Version();

-- Thoát
\q
```

## 📊 Phương án 2: Export/Import qua Docker Volume

Nếu database đang chạy trong Docker và muốn copy trực tiếp data directory:

### Từ Local (Windows)

```powershell
# Stop database container
docker-compose down

# Tạo backup của volume
docker run --rm -v tracking_pg_data:/data -v C:\backups:/backup alpine tar czf /backup/pg_data_backup.tar.gz /data

# Start lại
docker-compose up -d
```

### Lên Server (CentOS)

```bash
# Upload file tar.gz lên server
# scp C:\backups\pg_data_backup.tar.gz user@server:/opt/tracking/backups/

# Trên server, restore volume
docker run --rm -v tracking_pg_data_prod:/data -v /opt/tracking/backups:/backup alpine tar xzf /backup/pg_data_backup.tar.gz -C /

# Start database
docker-compose -f docker-compose.production.yml up -d db
```

## 📊 Phương án 3: Chỉ Export Data (Insert Statements)

Nếu chỉ muốn export data (không bao gồm schema):

### Export từ Local

```powershell
# Export chỉ data
cd "C:\Program Files\PostgreSQL\16\bin"
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking --data-only --column-inserts > C:\backups\tracking_data_only.sql

# Hoặc với COPY commands (nhanh hơn)
.\pg_dump.exe -h localhost -p 5432 -U admin -d tracking --data-only > C:\backups\tracking_data_only.sql
```

### Import trên Server

```bash
# Schema đã được tạo bởi Prisma migration
# Chỉ import data

docker exec -i tracking-postgis-prod psql -U admin -d tracking < /opt/tracking/backups/tracking_data_only.sql
```

## 🔄 Script Tự Động (All-in-One)

### Script cho Local (Windows) - `export-db.ps1`

```powershell
#!/usr/bin/env pwsh
# Export database from local

param(
    [string]$BackupDir = "C:\backups",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbUser = "admin",
    [string]$DbName = "tracking",
    [string]$ServerUser = "",
    [string]$ServerHost = ""
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$BackupDir\tracking_backup_$timestamp.dump"
$sqlFile = "$BackupDir\tracking_backup_$timestamp.sql"

Write-Host "🔄 Exporting database..." -ForegroundColor Cyan

# Tạo backup directory
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# Method 1: Dùng pg_dump (nếu có PostgreSQL client)
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    Write-Host "📦 Using pg_dump..." -ForegroundColor Green

    $env:PGPASSWORD = "Phamnam99"
    pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -F c -b -v -f $backupFile
    pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName > $sqlFile
    Remove-Item Env:\PGPASSWORD

} elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    # Method 2: Dùng Docker
    Write-Host "🐳 Using Docker..." -ForegroundColor Green

    docker exec -t tracking-postgis pg_dump -U $DbUser -d $DbName -F c > $backupFile
    docker exec -t tracking-postgis pg_dump -U $DbUser -d $DbName > $sqlFile
} else {
    Write-Host "❌ Neither pg_dump nor Docker found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backup completed!" -ForegroundColor Green
Write-Host "📁 Custom format: $backupFile" -ForegroundColor Cyan
Write-Host "📁 SQL format: $sqlFile" -ForegroundColor Cyan

# Upload to server nếu có thông tin
if ($ServerUser -and $ServerHost) {
    Write-Host "📤 Uploading to server..." -ForegroundColor Cyan

    scp $backupFile "${ServerUser}@${ServerHost}:/opt/tracking/backups/"
    scp $sqlFile "${ServerUser}@${ServerHost}:/opt/tracking/backups/"

    Write-Host "✅ Upload completed!" -ForegroundColor Green
}

# Hiển thị thông tin
$size = (Get-Item $backupFile).Length / 1MB
Write-Host "📊 Backup size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
```

Sử dụng:

```powershell
# Export only
.\export-db.ps1

# Export và upload lên server
.\export-db.ps1 -ServerUser "root" -ServerHost "192.168.1.100"
```

### Script cho Server (Linux) - `import-db.sh`

```bash
#!/bin/bash
# Import database on server

BACKUP_DIR="/opt/tracking/backups"
DB_USER="admin"
DB_NAME="tracking"
DB_PASSWORD="Phamnam99"
CONTAINER_NAME="tracking-postgis-prod"

echo "🔍 Tìm file backup mới nhất..."
LATEST_DUMP=$(ls -t $BACKUP_DIR/*.dump 2>/dev/null | head -1)
LATEST_SQL=$(ls -t $BACKUP_DIR/*.sql 2>/dev/null | head -1)

if [ -z "$LATEST_DUMP" ] && [ -z "$LATEST_SQL" ]; then
    echo "❌ Không tìm thấy file backup trong $BACKUP_DIR"
    exit 1
fi

# Kiểm tra database container đang chạy
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "🚀 Starting database container..."
    docker-compose -f docker-compose.production.yml up -d db
    echo "⏳ Waiting for database to be ready..."
    sleep 10
fi

# Import
if [ -n "$LATEST_DUMP" ]; then
    echo "📥 Importing from: $LATEST_DUMP"

    # Copy vào container
    docker cp "$LATEST_DUMP" $CONTAINER_NAME:/tmp/backup.dump

    # Restore
    docker exec -e PGPASSWORD=$DB_PASSWORD $CONTAINER_NAME pg_restore -U $DB_USER -d $DB_NAME -v -c /tmp/backup.dump

elif [ -n "$LATEST_SQL" ]; then
    echo "📥 Importing from: $LATEST_SQL"

    docker exec -i -e PGPASSWORD=$DB_PASSWORD $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < "$LATEST_SQL"
fi

echo "✅ Import completed!"

# Verify
echo "🔍 Verifying data..."
docker exec -e PGPASSWORD=$DB_PASSWORD $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "\dt"
docker exec -e PGPASSWORD=$DB_PASSWORD $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as aircraft_count FROM \"Aircraft\";"
docker exec -e PGPASSWORD=$DB_PASSWORD $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as vessel_count FROM \"Vessel\";"
```

Sử dụng:

```bash
chmod +x import-db.sh
./import-db.sh
```

## ✅ Checklist Export/Import

- [ ] **Export database từ local**

  - [ ] Dùng pg_dump hoặc pgAdmin
  - [ ] Kiểm tra file backup đã tạo
  - [ ] Verify file size hợp lý

- [ ] **Upload lên server**

  - [ ] Dùng SCP/SFTP/WinSCP
  - [ ] File đã có trên server trong `/opt/tracking/backups/`

- [ ] **Chuẩn bị server**

  - [ ] Database container đã chạy
  - [ ] PostGIS extension đã enable
  - [ ] User và database đã tạo

- [ ] **Import database**

  - [ ] Chạy pg_restore hoặc psql
  - [ ] Không có lỗi trong quá trình import
  - [ ] Verify data sau import

- [ ] **Test application**
  - [ ] Backend connect được database
  - [ ] Dữ liệu hiển thị đúng
  - [ ] Tất cả chức năng hoạt động

## 🔧 Troubleshooting

### Lỗi: "role does not exist"

```bash
# Tạo role trước khi import
docker exec -it tracking-postgis-prod psql -U postgres -c "CREATE USER admin WITH PASSWORD 'Phamnam99';"
```

### Lỗi: "database does not exist"

```bash
# Tạo database
docker exec -it tracking-postgis-prod psql -U postgres -c "CREATE DATABASE tracking OWNER admin;"
```

### Lỗi: PostGIS extension

```bash
# Enable PostGIS
docker exec -it tracking-postgis-prod psql -U admin -d tracking -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### File backup quá lớn

```bash
# Nén file trước khi upload
gzip tracking_backup.sql
# Tạo file: tracking_backup.sql.gz

# Giải nén trên server
gunzip tracking_backup.sql.gz
```

## 📝 Lưu ý

1. **Password trong lệnh**: Set biến môi trường `PGPASSWORD` để tránh nhập password nhiều lần
2. **Timezone**: Đảm bảo timezone giống nhau giữa local và server
3. **PostGIS version**: Đảm bảo version PostGIS tương thích
4. **Schema migration**: Nếu có thay đổi schema, chạy Prisma migration trước khi import data
5. **Backup before import**: Luôn backup database hiện có trên server trước khi import

---

**Khuyến nghị**: Dùng **Phương án 1** (pg_dump/pg_restore) vì an toàn và linh hoạt nhất.
