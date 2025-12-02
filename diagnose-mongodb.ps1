# MongoDB Diagnostic Script
Write-Host "`n=== MongoDB Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Check service status
Write-Host "1. Checking MongoDB Service..." -ForegroundColor Yellow
$service = Get-Service MongoDB -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "   Status: $($service.Status)" -ForegroundColor Green
} else {
    Write-Host "   MongoDB service not found!" -ForegroundColor Red
}

# Check process
Write-Host "`n2. Checking MongoDB Process..." -ForegroundColor Yellow
$process = Get-Process mongod -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "   Process ID: $($process.Id)" -ForegroundColor Green
    Write-Host "   Memory: $([math]::Round($process.WorkingSet64/1MB, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "   MongoDB process not running!" -ForegroundColor Red
}

# Check port
Write-Host "`n3. Checking Port 27017..." -ForegroundColor Yellow
$portTest = Test-NetConnection -ComputerName localhost -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portTest) {
    Write-Host "   Port 27017 is OPEN" -ForegroundColor Green
} else {
    Write-Host "   Port 27017 is CLOSED" -ForegroundColor Red
}

# Find MongoDB installation
Write-Host "`n4. Finding MongoDB Installation..." -ForegroundColor Yellow
$possiblePaths = @(
    "C:\Program Files\MongoDB\Server\8.0",
    "C:\Program Files\MongoDB\Server\7.0",
    "C:\Program Files\MongoDB\Server\6.0",
    "C:\Program Files\MongoDB\Server\5.0"
)

$mongoPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $mongoPath = $path
        Write-Host "   Found: $path" -ForegroundColor Green
        break
    }
}

if (-not $mongoPath) {
    Write-Host "   MongoDB installation not found!" -ForegroundColor Red
    exit
}

# Check mongod.cfg
Write-Host "`n5. Checking mongod.cfg..." -ForegroundColor Yellow
$configPath = Join-Path $mongoPath "bin\mongod.cfg"
if (Test-Path $configPath) {
    Write-Host "   Config file: $configPath" -ForegroundColor Green
    Write-Host "`n   Content:" -ForegroundColor Cyan
    Get-Content $configPath | ForEach-Object { Write-Host "   $_" }
} else {
    Write-Host "   Config file not found at: $configPath" -ForegroundColor Red
}

# Check log file
Write-Host "`n6. Checking MongoDB Logs..." -ForegroundColor Yellow
$logPath = Join-Path $mongoPath "log\mongod.log"
if (Test-Path $logPath) {
    Write-Host "   Log file: $logPath" -ForegroundColor Green
    Write-Host "`n   Last 20 lines:" -ForegroundColor Cyan
    Get-Content $logPath -Tail 20 | ForEach-Object { Write-Host "   $_" }
} else {
    Write-Host "   Log file not found at: $logPath" -ForegroundColor Red
}

Write-Host "`n=== Diagnostic Complete ===" -ForegroundColor Cyan
Write-Host ""
