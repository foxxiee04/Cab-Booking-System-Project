# Start all frontend apps in parallel

Write-Host "Starting all frontend apps..." -ForegroundColor Green

# Kill any existing processes on frontend ports
Write-Host "Checking for existing processes on ports 4000, 4001, 4002..." -ForegroundColor Yellow
$ports = @(4000, 4001, 4002)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($conn) {
        $processId = $conn.OwningProcess
        Write-Host "Stopping process $processId on port $port" -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

# Start customer app (port 4000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\frontend\customer-app'; npm run dev"

Start-Sleep -Seconds 2

# Start driver app (port 4001)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\frontend\driver-app'; npm run dev"

Start-Sleep -Seconds 2

# Start admin dashboard (port 4002)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\frontend\admin-dashboard'; npm run dev"

Write-Host "`nAll frontend apps starting..." -ForegroundColor Green
Write-Host "Customer App:  http://localhost:4000" -ForegroundColor Cyan
Write-Host "Driver App:    http://localhost:4001" -ForegroundColor Cyan
Write-Host "Admin Dashboard: http://localhost:4002" -ForegroundColor Cyan
Write-Host "`nClose the new PowerShell windows to stop the apps.`n" -ForegroundColor Yellow
