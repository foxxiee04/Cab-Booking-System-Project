# PowerShell script to automatically sync all Prisma schemas to PostgreSQL databases

$ErrorActionPreference = "Stop"

Write-Host "🔄 Starting schema synchronization for all services..." -ForegroundColor Cyan

# Array of services that use Prisma (PostgreSQL)
$PRISMA_SERVICES = @(
    "auth-service",
    "user-service",
    "driver-service",
    "booking-service",
    "ride-service",
    "payment-service"
)

# Function to sync a single service
function Sync-Service {
    param (
        [string]$service
    )
    
    Write-Host ""
    Write-Host "📦 Syncing schema for: $service" -ForegroundColor Yellow
    
    # Run command and capture output (redirect stderr to stdout)
    $output = & docker compose exec -T $service npx prisma db push --skip-generate 2>&1
    $exitCode = $LASTEXITCODE
    
    # Check if successful (ignore Docker warnings, check for actual Prisma errors)
    if ($exitCode -eq 0 -or ($output -match "already in sync|Done in")) {
        Write-Host "✅ $service schema synchronized successfully" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "❌ Failed to sync $service schema" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        return $false
    }
}

# Counter for success/failure
$successCount = 0
$failedCount = 0
$failedServices = @()

# Sync each service
foreach ($service in $PRISMA_SERVICES) {
    if (Sync-Service -service $service) {
        $successCount++
    }
    else {
        $failedCount++
        $failedServices += $service
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "📊 Schema Synchronization Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Successful: $successCount" -ForegroundColor Green
Write-Host "❌ Failed: $failedCount" -ForegroundColor Red

if ($failedCount -gt 0) {
    Write-Host ""
    Write-Host "Failed services:" -ForegroundColor Yellow
    foreach ($service in $failedServices) {
        Write-Host "  - $service" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "🎉 All schemas synchronized successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Verifying databases..." -ForegroundColor Cyan

# Verify PostgreSQL databases
Write-Host ""
Write-Host "📊 PostgreSQL Database Tables:" -ForegroundColor Cyan
$databases = @("auth_db", "user_db", "driver_db", "booking_db", "ride_db", "payment_db")

foreach ($db in $databases) {
    try {
        $count = docker compose exec -T postgres psql -U postgres -d $db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>$null
        $count = $count.Trim()
        if ([int]$count -gt 0) {
            Write-Host "  $db : " -NoNewline
            Write-Host "$count tables" -ForegroundColor Green
        }
        else {
            Write-Host "  $db : " -NoNewline
            Write-Host "0 tables" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  $db : " -NoNewline
        Write-Host "Error checking" -ForegroundColor Red
    }
}

# Verify MongoDB databases
Write-Host ""
Write-Host "📊 MongoDB Database Collections:" -ForegroundColor Cyan
$mongoDatabases = @("notification_db", "review_db")

foreach ($db in $mongoDatabases) {
    try {
        $collections = docker compose exec -T mongodb mongosh --quiet --eval "use $db; db.getCollectionNames()" 2>$null
        if ($collections -match '\[') {
            Write-Host "  $db : " -NoNewline
            Write-Host "Collections exist" -ForegroundColor Green
        }
        else {
            Write-Host "  $db : " -NoNewline
            Write-Host "No collections" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  $db : " -NoNewline
        Write-Host "Error checking" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✨ Schema synchronization complete!" -ForegroundColor Green
