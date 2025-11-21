#!/usr/bin/env pwsh
# Production Deployment Script for Windows
# This script helps deploy the tracking application to production

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('build', 'start', 'stop', 'restart', 'logs', 'status', 'update')]
    [string]$Action = 'start',
    
    [Parameter(Mandatory=$false)]
    [string]$EnvFile = '.env.production.local',
    
    [Parameter(Mandatory=$false)]
    [switch]$Detached = $false
)

$ComposeFile = "docker-compose.production.yml"
$ProjectName = "tracking-prod"

# Color output functions
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

# Check if Docker is running
function Test-Docker {
    try {
        docker version | Out-Null
        return $true
    } catch {
        Write-Error "Docker is not running. Please start Docker Desktop."
        return $false
    }
}

# Check if env file exists
function Test-EnvFile {
    if (-not (Test-Path $EnvFile)) {
        Write-Error "Environment file '$EnvFile' not found!"
        Write-Info "Creating from template..."
        
        if (Test-Path ".env.production") {
            Copy-Item ".env.production" $EnvFile
            Write-Success "Created $EnvFile from template"
            Write-Warning "Please edit $EnvFile with your production values before deploying!"
            return $false
        } else {
            Write-Error "Template .env.production not found!"
            return $false
        }
    }
    return $true
}

# Validate environment variables
function Test-EnvConfig {
    Write-Info "Validating environment configuration..."
    
    $content = Get-Content $EnvFile -Raw
    
    $warnings = @()
    
    # Check for default/insecure values
    if ($content -match 'JWT_SECRET=your-super-secret') {
        $warnings += "JWT_SECRET is using default value - MUST be changed!"
    }
    
    if ($content -match 'REDIS_PASSWORD=changeme') {
        $warnings += "REDIS_PASSWORD is using default value - should be changed!"
    }
    
    if ($content -match 'POSTGRES_PASSWORD=Phamnam99') {
        $warnings += "Using development database password - verify this is correct!"
    }
    
    if ($warnings.Count -gt 0) {
        Write-Warning "Configuration warnings found:"
        foreach ($warning in $warnings) {
            Write-Warning "  - $warning"
        }
        
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne 'y' -and $continue -ne 'Y') {
            Write-Info "Deployment cancelled. Please update $EnvFile"
            return $false
        }
    }
    
    return $true
}

# Build Docker images
function Build-Images {
    Write-Info "Building Docker images..."
    
    docker-compose -f $ComposeFile --env-file $EnvFile -p $ProjectName build --no-cache
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker images built successfully"
        return $true
    } else {
        Write-Error "Failed to build Docker images"
        return $false
    }
}

# Start services
function Start-Services {
    Write-Info "Starting production services..."
    
    $detachFlag = if ($Detached) { '-d' } else { '' }
    
    docker-compose -f $ComposeFile --env-file $EnvFile -p $ProjectName up $detachFlag
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Services started successfully"
        
        if ($Detached) {
            Write-Info "Waiting for services to be healthy..."
            Start-Sleep -Seconds 10
            Show-Status
            
            Write-Info ""
            Write-Success "🎉 Deployment complete!"
            Write-Info "Backend API: http://localhost:3001"
            Write-Info "Frontend: http://localhost:4000"
            Write-Info ""
            Write-Info "View logs: .\deploy-production.ps1 -Action logs"
        }
        
        return $true
    } else {
        Write-Error "Failed to start services"
        return $false
    }
}

# Stop services
function Stop-Services {
    Write-Info "Stopping production services..."
    
    docker-compose -f $ComposeFile -p $ProjectName down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Services stopped successfully"
        return $true
    } else {
        Write-Error "Failed to stop services"
        return $false
    }
}

# Restart services
function Restart-Services {
    Write-Info "Restarting production services..."
    
    docker-compose -f $ComposeFile -p $ProjectName restart
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Services restarted successfully"
        return $true
    } else {
        Write-Error "Failed to restart services"
        return $false
    }
}

# Show logs
function Show-Logs {
    Write-Info "Showing service logs (Ctrl+C to exit)..."
    
    docker-compose -f $ComposeFile -p $ProjectName logs -f --tail=100
}

# Show status
function Show-Status {
    Write-Info "Service status:"
    Write-Host ""
    
    docker-compose -f $ComposeFile -p $ProjectName ps
    
    Write-Host ""
    Write-Info "Health checks:"
    
    # Check backend
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "Backend: Healthy"
        }
    } catch {
        Write-Error "Backend: Unhealthy or not responding"
    }
    
    # Check frontend
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4000" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "Frontend: Healthy"
        }
    } catch {
        Write-Error "Frontend: Unhealthy or not responding"
    }
}

# Update and redeploy
function Update-Deployment {
    Write-Info "Updating deployment..."
    
    # Pull latest code
    Write-Info "Pulling latest code from git..."
    git pull
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Git pull failed or no changes"
    }
    
    # Rebuild and restart
    if (Build-Images) {
        Stop-Services
        Start-Services
    }
}

# Main execution
function Main {
    Write-Host "🚀 Tracking Application - Production Deployment" -ForegroundColor Magenta
    Write-Host "================================================" -ForegroundColor Magenta
    Write-Host ""
    
    # Pre-flight checks
    if (-not (Test-Docker)) {
        exit 1
    }
    
    if (-not (Test-EnvFile)) {
        exit 1
    }
    
    # Execute action
    switch ($Action) {
        'build' {
            if (-not (Test-EnvConfig)) { exit 1 }
            Build-Images
        }
        'start' {
            if (-not (Test-EnvConfig)) { exit 1 }
            $Detached = $true
            if (Build-Images) {
                Start-Services
            }
        }
        'stop' {
            Stop-Services
        }
        'restart' {
            Restart-Services
        }
        'logs' {
            Show-Logs
        }
        'status' {
            Show-Status
        }
        'update' {
            if (-not (Test-EnvConfig)) { exit 1 }
            Update-Deployment
        }
    }
}

# Run main
Main
