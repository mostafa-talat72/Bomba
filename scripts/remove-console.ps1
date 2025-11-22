# PowerShell script to remove console statements

Write-Host "Removing console statements from codebase..." -ForegroundColor Yellow

$removed = 0

# Function to remove console statements from a file
function Remove-ConsoleStatements {
    param([string]$filePath)
    
    try {
        $content = Get-Content $filePath -Raw -ErrorAction Stop
        $originalLength = $content.Length
        
        # Remove console.log, console.error, console.warn, console.info, console.debug
        $content = $content -replace "console\.(log|error|warn|info|debug)\([^)]*\);?\s*", ""
        
        if ($content.Length -ne $originalLength) {
            Set-Content -Path $filePath -Value $content -NoNewline -ErrorAction Stop
            return 1
        }
    } catch {
        Write-Host "Error processing $filePath : $_" -ForegroundColor Red
    }
    return 0
}

# Process frontend files
Write-Host "Processing frontend files..." -ForegroundColor Cyan
$frontendFiles = Get-ChildItem -Path "src" -Include "*.ts","*.tsx","*.js","*.jsx" -Recurse -ErrorAction SilentlyContinue | Where-Object {
    $_.FullName -notlike "*\node_modules\*"
}
foreach ($file in $frontendFiles) {
    $result = Remove-ConsoleStatements -filePath $file.FullName
    if ($result -eq 1) {
        Write-Host "  Modified: $($file.Name)" -ForegroundColor Green
        $removed++
    }
}

# Process backend files (excluding logger.js, scripts folder, and node_modules)
Write-Host "Processing backend files..." -ForegroundColor Cyan
$backendFiles = Get-ChildItem -Path "server" -Include "*.js" -Recurse -ErrorAction SilentlyContinue | Where-Object {
    $_.FullName -notlike "*\scripts\*" -and 
    $_.FullName -notlike "*\node_modules\*" -and 
    $_.Name -ne "logger.js"
}
foreach ($file in $backendFiles) {
    $result = Remove-ConsoleStatements -filePath $file.FullName
    if ($result -eq 1) {
        Write-Host "  Modified: $($file.Name)" -ForegroundColor Green
        $removed++
    }
}

Write-Host "Done! Modified $removed files." -ForegroundColor Green
Write-Host "Please review the changes and test the application." -ForegroundColor Yellow
