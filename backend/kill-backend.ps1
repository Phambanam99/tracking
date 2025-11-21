# Kill all Node processes using port 3001
Write-Host "🔍 Finding processes on port 3001..." -ForegroundColor Yellow

$processes = netstat -ano | findstr :3001 | findstr LISTENING
if ($processes) {
    # Handle multiple processes
    $pids = ($processes | ForEach-Object {
        ($_ -split '\s+')[-1]
    }) | Select-Object -Unique
    
    foreach ($pid in $pids) {
        Write-Host "❌ Killing process $pid..." -ForegroundColor Red
        taskkill /F /PID $pid 2>$null
    }
    Write-Host "✅ Process(es) terminated" -ForegroundColor Green
} else {
    Write-Host "✅ Port 3001 is free" -ForegroundColor Green
}

# Also kill all node.exe processes to be safe
Write-Host ""
Write-Host "🔍 Checking for other Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⚠️  Found $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Yellow
    $response = Read-Host "Kill all Node.js processes? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        $nodeProcesses | ForEach-Object {
            Write-Host "  🔥 Killing: $($_.ProcessName) (PID: $($_.Id))"
            Stop-Process -Id $_.Id -Force
        }
        Write-Host "✅ All Node.js processes killed" -ForegroundColor Green
    }
} else {
    Write-Host "✅ No other Node.js processes found" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Done! You can now start the backend." -ForegroundColor Green
