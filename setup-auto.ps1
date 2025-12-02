# PowerShell Script to Setup MongoDB Replica Set Automatically
# Run as Administrator

Write-Host "`n🚀 MongoDB Replica Set Auto Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "`nPlease right-click and select 'Run as Administrator'`n" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Running as Administrator`n" -ForegroundColor Green

# Step 1: Stop MongoDB
Write-Host "1️⃣  Stopping MongoDB..." -ForegroundColor Cyan
try {
    Stop-Service -Name MongoDB -ErrorAction Stop
    Write-Host "✅ MongoDB stopped`n" -ForegroundColor Green
} catch {
    Write-Host "⚠️  MongoDB might already be stopped`n" -ForegroundColor Yellow
}

# Step 2: Find and edit mongod.cfg
Write-Host "2️⃣  Configuring MongoDB..." -ForegroundColor Cyan

$possiblePaths = @(
    "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg"
)

$configPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $configPath = $path
        break
    }
}

if ($null -eq $configPath) {
    Write-Host "❌ Could not find mongod.cfg!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Found: $configPath" -ForegroundColor Green

# Backup
$backupPath = "$configPath.backup"
Copy-Item $configPath $backupPath -Force
Write-Host "✅ Backup created`n" -ForegroundColor Green

# Check if already configured
$content = Get-Content $configPath -Raw
if ($content -notmatch "replication:") {
    Add-Content -Path $configPath -Value "`nreplication:`n  replSetName: `"rs0`"`n"
    Write-Host "✅ Replication configured`n" -ForegroundColor Green
} else {
    Write-Host "✅ Already configured`n" -ForegroundColor Green
}

# Step 3: Start MongoDB
Write-Host "3️⃣  Starting MongoDB..." -ForegroundColor Cyan
try {
    Start-Service -Name MongoDB -ErrorAction Stop
    Write-Host "✅ MongoDB started`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start MongoDB" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Wait for MongoDB
Start-Sleep -Seconds 3

# Step 4: Initialize Replica Set
Write-Host "4️⃣  Initializing Replica Set..." -ForegroundColor Cyan
Write-Host "   Running npm run init:replica...`n" -ForegroundColor Yellow

try {
    $result = npm run init:replica 2>&1
    Write-Host $result
    Write-Host "`n✅ Replica Set initialized!`n" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Initialization may need manual step" -ForegroundColor Yellow
}

# Step 5: Verify
Write-Host "5️⃣  Verifying setup..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Verify: npm run check:replica" -ForegroundColor White
Write-Host "2. Start server: npm run server:dev`n" -ForegroundColor White

Read-Host "Press Enter to exit"
