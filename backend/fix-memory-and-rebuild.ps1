# Fix Memory Issues - Complete Reset Script
# This script clears all caches and rebuilds the project

$ErrorActionPreference = "Stop"

Write-Host "🔧 Fixing Memory Issues and Rebuilding Project..." -ForegroundColor Cyan
Write-Host ""

# Navigate to backend directory
Set-Location $PSScriptRoot

# 1. Stop any running Node processes
Write-Host "1. Stopping running Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "   ✓ Processes stopped" -ForegroundColor Green

# 2. Clear node_modules
Write-Host "2. Clearing node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "   ✓ node_modules deleted" -ForegroundColor Green
}
else {
    Write-Host "   - node_modules not found (already clean)" -ForegroundColor Gray
}

# 3. Clear dist folder
Write-Host "3. Clearing dist folder..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "   ✓ dist deleted" -ForegroundColor Green
}
else {
    Write-Host "   - dist not found (already clean)" -ForegroundColor Gray
}

# 4. Clear npm cache
Write-Host "4. Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "   ✓ npm cache cleared" -ForegroundColor Green

# 5. Clear TypeScript cache
Write-Host "5. Clearing TypeScript cache..." -ForegroundColor Yellow
if (Test-Path "tsconfig.tsbuildinfo") {
    Remove-Item "tsconfig.tsbuildinfo"
    Write-Host "   ✓ TypeScript cache cleared" -ForegroundColor Green
}
else {
    Write-Host "   - No TypeScript cache found" -ForegroundColor Gray
}

# 6. Reinstall dependencies
Write-Host "6. Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host "   ✓ Dependencies installed" -ForegroundColor Green

# 7. Generate Prisma Client
Write-Host "7. Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "   ✓ Prisma Client generated" -ForegroundColor Green

# 8. Build the project
Write-Host "8. Building project..." -ForegroundColor Yellow
npm run build
Write-Host "   ✓ Project built" -ForegroundColor Green

Write-Host ""
Write-Host "✅ All done! Project is clean and rebuilt." -ForegroundColor Green
Write-Host ""
Write-Host "📊 Memory Configuration:" -ForegroundColor Cyan
Write-Host "   - Development: 4GB heap (NODE_OPTIONS in .env)" -ForegroundColor Gray
Write-Host "   - Production: 8GB heap" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 To start the server:" -ForegroundColor Cyan
Write-Host "   npm run start:dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 To monitor memory:" -ForegroundColor Cyan
Write-Host "   curl http://localhost:3001/api/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "Warning: If you still get memory errors:" -ForegroundColor Yellow
Write-Host "   1. Increase NODE_OPTIONS in .env to --max-old-space-size=6144" -ForegroundColor Gray
Write-Host "   2. Check MEMORY-OPTIMIZATION.md for more solutions" -ForegroundColor Gray
Write-Host "   3. Restart your computer to free up system memory" -ForegroundColor Gray
