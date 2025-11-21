# Script to kill processes using port 3001 and restart backend
$ErrorActionPreference = "Stop"
$port = 3001

Write-Host "Checking for processes using port $port..." -ForegroundColor Cyan

try {
    # Find process using port 3001
    $processInfo = netstat -ano | Select-String ":$port " | Select-String "LISTENING"
    
    if ($processInfo) {
        Write-Host "Found process(es) using port ${port}:" -ForegroundColor Yellow
        Write-Host $processInfo
        
        # Extract PIDs
        $pids = $processInfo | ForEach-Object {
            if ($_ -match '\s+(\d+)\s*$') {
                $matches[1]
            }
        } | Select-Object -Unique
        
        foreach ($pid in $pids) {
            try {
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "Killing process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Red
                    Stop-Process -Id $pid -Force
                    Start-Sleep -Seconds 1
                    Write-Host "Process $pid killed successfully" -ForegroundColor Green
                }
            } catch {
                Write-Host "Could not kill process $pid - might need admin rights" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "No process found using port $port" -ForegroundColor Green
    }
    
    # Double check - kill all node processes (optional)
    Write-Host ""
    $response = Read-Host "Do you want to kill ALL Node.js processes? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-Host "Killing all Node.js processes..." -ForegroundColor Red
            $nodeProcesses | ForEach-Object {
                Write-Host "  - Killing: $($_.ProcessName) (PID: $($_.Id))"
                Stop-Process -Id $_.Id -Force
            }
            Write-Host "All Node.js processes killed" -ForegroundColor Green
        } else {
            Write-Host "No Node.js processes found" -ForegroundColor Green
        }
    }
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Port $port is now free. Starting backend..." -ForegroundColor Cyan
Write-Host ""

# Start backend
try {
    npm start
} catch {
    Write-Host "Failed to start backend: $_" -ForegroundColor Red
    exit 1
}
