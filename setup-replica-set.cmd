@echo off
REM Batch Script to Setup MongoDB Replica Set
REM Run this script as Administrator

echo.
echo ========================================
echo MongoDB Replica Set Setup Script
echo ========================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo.
    echo Please:
    echo 1. Right-click on this file
    echo 2. Select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

echo [OK] Running as Administrator
echo.

REM Step 1: Stop MongoDB
echo Step 1: Stopping MongoDB...
net stop MongoDB >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] MongoDB stopped successfully
) else (
    echo [WARNING] MongoDB might already be stopped
)
echo.

REM Step 2: Instructions for manual config edit
echo Step 2: Edit MongoDB Configuration
echo ========================================
echo.
echo Please follow these steps:
echo.
echo 1. Open File Explorer
echo 2. Navigate to: C:\Program Files\MongoDB\Server\{version}\bin\
echo    (Replace {version} with your MongoDB version, e.g., 7.0 or 8.0)
echo.
echo 3. Right-click on "mongod.cfg"
echo 4. Select "Edit with Notepad" (as Administrator)
echo.
echo 5. Add these lines at the end of the file:
echo.
echo    replication:
echo      replSetName: "rs0"
echo.
echo 6. Save and close the file
echo.
pause

REM Step 3: Start MongoDB
echo.
echo Step 3: Starting MongoDB...
net start MongoDB >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] MongoDB started successfully
) else (
    echo [ERROR] Failed to start MongoDB
    echo Please start it manually: net start MongoDB
    pause
    exit /b 1
)
echo.

REM Wait for MongoDB to be ready
echo Waiting for MongoDB to be ready...
timeout /t 3 /nobreak >nul
echo [OK] MongoDB should be ready
echo.

REM Step 4: Initialize Replica Set
echo Step 4: Initialize Replica Set
echo ========================================
echo.
echo Please follow these steps:
echo.
echo 1. Open a NEW Command Prompt or PowerShell
echo 2. Run: mongosh
echo 3. Copy and paste this command:
echo.
echo    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })
echo.
echo 4. You should see: { "ok": 1 }
echo 5. Type: exit
echo.
pause

REM Step 5: Verify
echo.
echo Step 5: Verify Setup
echo ========================================
echo.
echo Run this command to verify:
echo    npm run check:replica
echo.
echo If successful, you should see:
echo    [OK] SUCCESS! Your MongoDB is ready for bidirectional sync!
echo.
echo Then start your server:
echo    npm run server:dev
echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
pause
