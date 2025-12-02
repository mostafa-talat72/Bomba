# PowerShell Script to Setup MongoDB Replica Set
# Run this script as Administrator

Write-Host "`n🚀 MongoDB Replica Set Setup Script" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "`nPlease:" -ForegroundColor Yellow
    Write-Host "1. Right-click on PowerShell" -ForegroundColor Yellow
    Write-Host "2. Select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "3. Run this script again`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running as Administrator`n" -ForegroundColor Green

# Step 1: Stop MongoDB
Write-Host "1️⃣  Stopping MongoDB..." -ForegroundColor Cyan
try {
    $stopResult = net stop MongoDB 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MongoDB stopped successfully`n" -ForegroundColor Green
    } else {
        Write-Host "⚠️  MongoDB might already be stopped or service name is different" -ForegroundColor Yellow
        Write-Host "   Trying alternative service name...`n" -ForegroundColor Yellow
        net stop "MongoDB Server" 2>&1 | Out-Null
    }
} catch {
    Write-Host "⚠️  Could not stop MongoDB service" -ForegroundColor Yellow
    Write-Host "   This is OK if MongoDB is not running`n" -ForegroundColor Yellow
}

# Step 2: Find MongoDB config file
Write-Host "2️⃣  Locating MongoDB configuration file..." -ForegroundColor Cyan

$possiblePaths = @(
    "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\5.0\bin\mongod.cfg"
)

$configPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $configPath = $path
        break
    }
}

if ($null -eq $configPath) {
    Write-Host "❌ Could not find mongod.cfg file!" -ForegroundColor Red
    Write-Host "`nPlease manually edit the file at:" -ForegroundColor Yellow
    Write-Host "C:\Program Files\MongoDB\Server\{version}\bin\mongod.cfg" -ForegroundColor Yellow
    Write-Host "`nAdd these lines:" -ForegroundColor Yellow
    Write-Host "replication:" -ForegroundColor White
    Write-Host "  replSetName: `"rs0`"`n" -ForegroundColor White
    exit 1
}

Write-Host "✅ Found config file: $configPath`n" -ForegroundColor Green

# Step 3: Backup config file
Write-Host "3️⃣  Creating backup of config file..." -ForegroundColor Cyan
$backupPath = "$configPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
try {
    Copy-Item $configPath $backupPath -Force
    Write-Host "✅ Backup created: $backupPath`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create backup: $_`n" -ForegroundColor Red
    exit 1
}

# Step 4: Check if replication is already configured
Write-Host "4️⃣  Checking current configuration..." -ForegroundColor Cyan
$configContent = Get-Content $configPath -Raw

if ($configContent -match "replication:") {
    Write-Host "✅ Replication section already exists in config`n" -ForegroundColor Green
} else {
    Write-Host "📝 Adding replication configuration..." -ForegroundColor Cyan
    
    # Add replication section
    $replicationConfig = "`n# Replication configuration for bidirectional sync`nreplication:`n  replSetName: `"rs0`"`n"
    
    try {
        Add-Content -Path $configPath -Value $replicationConfig
        Write-Host "✅ Replication configuration added`n" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to update config file: $_" -ForegroundColor Red
        Write-Host "`nPlease manually add these lines to $configPath :" -ForegroundColor Yellow
        Write-Host "replication:" -ForegroundColor White
        Write-Host "  replSetName: `"rs0`"`n" -ForegroundColor White
        exit 1
    }
}

# Step 5: Start MongoDB
Write-Host "5️⃣  Starting MongoDB..." -ForegroundColor Cyan
try {
    $startResult = net start MongoDB 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MongoDB started successfully`n" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Trying alternative service name..." -ForegroundColor Yellow
        net start "MongoDB Server" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ MongoDB started successfully`n" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to start MongoDB" -ForegroundColor Red
            Write-Host "   Please start it manually: net start MongoDB`n" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Failed to start MongoDB: $_`n" -ForegroundColor Red
    exit 1
}

# Wait for MongoDB to be ready
Write-Host "⏳ Waiting for MongoDB to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Write-Host "✅ MongoDB should be ready`n" -ForegroundColor Green

# Step 6: Initialize Replica Set
Write-Host "6️⃣  Initializing Replica Set..." -ForegroundColor Cyan
Write-Host "   Running: rs.initiate() command...`n" -ForegroundColor Yellow

$initCommand = @"
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
})
"@

try {
    # Create temporary JS file
    $tempFile = [System.IO.Path]::GetTempFileName() + ".js"
    Set-Content -Path $tempFile -Value $initCommand
    
    # Run mongosh with the init command
    $result = & mongosh --quiet --file $tempFile 2>&1
    
    # Clean up temp file
    Remove-Item $tempFile -Force
    
    if ($result -match '"ok"\s*:\s*1' -or $result -match 'already initialized') {
        Write-Host "✅ Replica Set initialized successfully!`n" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Replica Set initialization result:" -ForegroundColor Yellow
        Write-Host $result -ForegroundColor White
        Write-Host ""
    }
} catch {
    Write-Host "⚠️  Could not run mongosh automatically" -ForegroundColor Yellow
    Write-Host "`nPlease run these commands manually:" -ForegroundColor Yellow
    Write-Host "1. Open a new terminal and run: mongosh" -ForegroundColor White
    Write-Host "2. Then run:" -ForegroundColor White
    Write-Host "   rs.initiate({ _id: `"rs0`", members: [{ _id: 0, host: `"localhost:27017`" }] })`n" -ForegroundColor White
}

# Step 7: Verify setup
Write-Host "7️⃣  Verifying setup..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Verify the setup by running:" -ForegroundColor White
Write-Host "   npm run check:replica`n" -ForegroundColor Yellow

Write-Host "2. If verification passes, start your server:" -ForegroundColor White
Write-Host "   npm run server:dev`n" -ForegroundColor Yellow

Write-Host "3. Check the logs for:" -ForegroundColor White
Write-Host "   ✅ Bidirectional sync is ENABLED" -ForegroundColor Green
Write-Host "   ✅ Status: ACTIVE" -ForegroundColor Green
Write-Host "   🔄 Direction: Local ⇄ Atlas (bidirectional)`n" -ForegroundColor Green

Write-Host "📖 For troubleshooting, see: QUICK_START_BIDIRECTIONAL_SYNC.md`n" -ForegroundColor Cyan

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
