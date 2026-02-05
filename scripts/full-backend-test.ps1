param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AiUrl = "http://localhost:8000",
  [string]$ReportPath = "tests\\backend-test-report.txt"
)

$script:Results = @()

function Add-Result {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [string]$Status,
    [int]$HttpStatus = 0,
    [string]$Notes = ""
  )
  $script:Results += [pscustomobject]@{
    Name = $Name
    Method = $Method
    Url = $Url
    Status = $Status
    HttpStatus = $HttpStatus
    Notes = $Notes
  }
}

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory=$true)][ValidateSet('GET','POST','PUT','PATCH','DELETE')] [string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )

  $params = @{ Method = $Method; Uri = $Url; Headers = $Headers; ErrorAction = 'Stop' }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  $response = Invoke-WebRequest @params -UseBasicParsing
  $json = $null
  if ($response.Content) {
    try { $json = $response.Content | ConvertFrom-Json } catch { }
  }
  return @{ Response = $response; Json = $json }
}

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [object]$Body = $null,
    [hashtable]$Headers = @{},
    [int[]]$ExpectedStatus = @(200,201)
  )

  try {
    $result = Invoke-JsonRequest -Method $Method -Url $Url -Body $Body -Headers $Headers
    $status = [int]$result.Response.StatusCode
    if ($ExpectedStatus -contains $status) {
      Add-Result -Name $Name -Method $Method -Url $Url -Status "PASS" -HttpStatus $status
    } else {
      Add-Result -Name $Name -Method $Method -Url $Url -Status "FAIL" -HttpStatus $status -Notes "Unexpected status"
    }
    return $result
  } catch {
    $status = 0
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { }
    }
    $msg = $_.Exception.Message
    if ($ExpectedStatus -contains $status) {
      Add-Result -Name $Name -Method $Method -Url $Url -Status "PASS" -HttpStatus $status -Notes "Expected error status"
      return $null
    }
    Add-Result -Name $Name -Method $Method -Url $Url -Status "FAIL" -HttpStatus $status -Notes $msg
    return $null
  }
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$customerEmail = "customer_$timestamp@example.com"
$rideCustomerEmail = "ride_customer_$timestamp@example.com"
$driverEmail = "driver_$timestamp@example.com"
$password = "Password123!"

Write-Host "== Full backend test ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"
Write-Host "AI Url: $AiUrl"

# Health checks
Test-Endpoint -Name "Gateway health" -Method GET -Url "$BaseUrl/health"
Test-Endpoint -Name "Services health" -Method GET -Url "$BaseUrl/health/services"
Test-Endpoint -Name "Notification health" -Method GET -Url "http://localhost:3005/health"
Test-Endpoint -Name "Review health" -Method GET -Url "http://localhost:3010/health"
Test-Endpoint -Name "AI health" -Method GET -Url "$AiUrl/api/health"

# Auth - Customer
$registerCustomer = Test-Endpoint -Name "Auth register (customer)" -Method POST -Url "$BaseUrl/api/auth/register" -Body @{
  email = $customerEmail; password = $password; role = "CUSTOMER"; firstName = "Test"; lastName = "Customer"
} -ExpectedStatus @(201)
$customerId = $null
$customerTokens = $null
if ($registerCustomer -and $registerCustomer.Json -and $registerCustomer.Json.data) {
  $customerTokens = $registerCustomer.Json.data.tokens
  if ($registerCustomer.Json.data.user) { $customerId = $registerCustomer.Json.data.user.id }
}
$customerAccess = $null
$customerRefresh = $null
if ($customerTokens) {
  if ($customerTokens.accessToken) { $customerAccess = $customerTokens.accessToken }
  if ($customerTokens.refreshToken) { $customerRefresh = $customerTokens.refreshToken }
}

$loginCustomer = Test-Endpoint -Name "Auth login (customer)" -Method POST -Url "$BaseUrl/api/auth/login" -Body @{
  email = $customerEmail; password = $password
}
if ($loginCustomer -and $loginCustomer.Json -and $loginCustomer.Json.data -and $loginCustomer.Json.data.tokens) {
  if ($loginCustomer.Json.data.tokens.accessToken) { $customerAccess = $loginCustomer.Json.data.tokens.accessToken }
  if ($loginCustomer.Json.data.tokens.refreshToken) { $customerRefresh = $loginCustomer.Json.data.tokens.refreshToken }
}
$customerHeaders = @{ Authorization = "Bearer $customerAccess" }

if ($customerRefresh) {
  Test-Endpoint -Name "Auth refresh" -Method POST -Url "$BaseUrl/api/auth/refresh" -Body @{ refreshToken = $customerRefresh }
}
Test-Endpoint -Name "Auth me" -Method GET -Url "$BaseUrl/api/auth/me" -Headers $customerHeaders
Test-Endpoint -Name "Auth logout" -Method POST -Url "$BaseUrl/api/auth/logout" -Headers $customerHeaders

# Auth - Driver
$registerDriver = Test-Endpoint -Name "Auth register (driver)" -Method POST -Url "$BaseUrl/api/auth/register" -Body @{
  email = $driverEmail; password = $password; role = "DRIVER"; firstName = "Test"; lastName = "Driver"
} -ExpectedStatus @(201)
$driverId = $null
$driverTokens = $null
if ($registerDriver -and $registerDriver.Json -and $registerDriver.Json.data) {
  $driverTokens = $registerDriver.Json.data.tokens
  if ($registerDriver.Json.data.user) { $driverId = $registerDriver.Json.data.user.id }
}
$driverAccess = $null
if ($driverTokens -and $driverTokens.accessToken) { $driverAccess = $driverTokens.accessToken }

$loginDriver = Test-Endpoint -Name "Auth login (driver)" -Method POST -Url "$BaseUrl/api/auth/login" -Body @{
  email = $driverEmail; password = $password
}
if ($loginDriver -and $loginDriver.Json -and $loginDriver.Json.data -and $loginDriver.Json.data.tokens) {
  if ($loginDriver.Json.data.tokens.accessToken) { $driverAccess = $loginDriver.Json.data.tokens.accessToken }
}
$driverHeaders = @{ Authorization = "Bearer $driverAccess" }

# Auth - Ride Customer (separate user for ride flow)
$registerRideCustomer = Test-Endpoint -Name "Auth register (ride customer)" -Method POST -Url "$BaseUrl/api/auth/register" -Body @{
  email = $rideCustomerEmail; password = $password; role = "CUSTOMER"; firstName = "Ride"; lastName = "Customer"
} -ExpectedStatus @(201)
$rideCustomerId = $null
if ($registerRideCustomer -and $registerRideCustomer.Json -and $registerRideCustomer.Json.data -and $registerRideCustomer.Json.data.user) {
  $rideCustomerId = $registerRideCustomer.Json.data.user.id
}
$loginRideCustomer = Test-Endpoint -Name "Auth login (ride customer)" -Method POST -Url "$BaseUrl/api/auth/login" -Body @{
  email = $rideCustomerEmail; password = $password
}
$rideCustomerAccess = $null
if ($loginRideCustomer -and $loginRideCustomer.Json -and $loginRideCustomer.Json.data -and $loginRideCustomer.Json.data.tokens) {
  if ($loginRideCustomer.Json.data.tokens.accessToken) { $rideCustomerAccess = $loginRideCustomer.Json.data.tokens.accessToken }
}
$rideCustomerHeaders = @{ Authorization = "Bearer $rideCustomerAccess" }

# User service
if ($customerId) {
  Test-Endpoint -Name "User create profile" -Method POST -Url "$BaseUrl/api/users" -Headers $customerHeaders -Body @{
    userId = $customerId; firstName = "Test"; lastName = "Customer"; phone = "+84999999999"
  } -ExpectedStatus @(201)
  Test-Endpoint -Name "User get profile" -Method GET -Url "$BaseUrl/api/users/$customerId" -Headers $customerHeaders
}

# Driver service
Test-Endpoint -Name "Driver register" -Method POST -Url "$BaseUrl/api/drivers/register" -Headers $driverHeaders -Body @{
  vehicle = @{ type = "CAR"; brand = "Toyota"; model = "Vios"; plate = "TEST-123"; color = "White"; year = 2020 };
  license = @{ number = "D-123456"; expiryDate = "2030-12-31" }
} -ExpectedStatus @(201,200)
Test-Endpoint -Name "Driver me" -Method GET -Url "$BaseUrl/api/drivers/me" -Headers $driverHeaders
Test-Endpoint -Name "Driver online" -Method POST -Url "$BaseUrl/api/drivers/me/online" -Headers $driverHeaders
Test-Endpoint -Name "Driver update location" -Method POST -Url "$BaseUrl/api/drivers/me/location" -Headers $driverHeaders -Body @{ lat = 10.762622; lng = 106.660172 }
Test-Endpoint -Name "Driver available rides" -Method GET -Url "$BaseUrl/api/drivers/me/available-rides?lat=10.762622&lng=106.660172" -Headers $driverHeaders
Test-Endpoint -Name "Driver nearby" -Method GET -Url "$BaseUrl/api/drivers/nearby?lat=10.762622&lng=106.660172" -Headers $driverHeaders
Test-Endpoint -Name "Driver list" -Method GET -Url "$BaseUrl/api/drivers" -Headers $driverHeaders
if ($driverId) {
  Test-Endpoint -Name "Driver by userId" -Method GET -Url "$BaseUrl/api/drivers/user/$driverId" -Headers $driverHeaders
}
Test-Endpoint -Name "Driver offline" -Method POST -Url "$BaseUrl/api/drivers/me/offline" -Headers $driverHeaders

# Pricing service (requires auth)
Test-Endpoint -Name "Pricing estimate" -Method POST -Url "$BaseUrl/api/pricing/estimate" -Headers $customerHeaders -Body @{
  pickupLat = 10.762622; pickupLng = 106.660172; dropoffLat = 10.776889; dropoffLng = 106.700806; vehicleType = "ECONOMY"
}
Test-Endpoint -Name "Pricing get surge" -Method GET -Url "$BaseUrl/api/pricing/surge" -Headers $customerHeaders
Test-Endpoint -Name "Pricing set surge" -Method POST -Url "$BaseUrl/api/pricing/surge" -Headers $customerHeaders -Body @{ multiplier = 1.2 }
Test-Endpoint -Name "Pricing calculate surge" -Method POST -Url "$BaseUrl/api/pricing/surge/calculate" -Headers $customerHeaders -Body @{ activeRides = 5; availableDrivers = 20 }

# Booking service (requires auth)
$booking1 = Test-Endpoint -Name "Booking create (confirm)" -Method POST -Url "$BaseUrl/api/bookings" -Headers $customerHeaders -Body @{
  customerId = $customerId; pickupAddress = "A"; pickupLat = 10.762622; pickupLng = 106.660172;
  dropoffAddress = "B"; dropoffLat = 10.776889; dropoffLng = 106.700806;
  vehicleType = "ECONOMY"; paymentMethod = "CASH"; customerPhone = "+84999999999"
} -ExpectedStatus @(201)
$bookingId1 = $null
if ($booking1 -and $booking1.Json -and $booking1.Json.data -and $booking1.Json.data.booking) {
  $bookingId1 = $booking1.Json.data.booking.id
}
if ($bookingId1) {
  Test-Endpoint -Name "Booking get" -Method GET -Url "$BaseUrl/api/bookings/$bookingId1" -Headers $customerHeaders
  Test-Endpoint -Name "Booking confirm" -Method POST -Url "$BaseUrl/api/bookings/$bookingId1/confirm" -Headers $customerHeaders
}

$booking2 = Test-Endpoint -Name "Booking create (cancel)" -Method POST -Url "$BaseUrl/api/bookings" -Headers $customerHeaders -Body @{
  customerId = $customerId; pickupAddress = "C"; pickupLat = 10.762622; pickupLng = 106.660172;
  dropoffAddress = "D"; dropoffLat = 10.776889; dropoffLng = 106.700806;
  vehicleType = "ECONOMY"; paymentMethod = "CASH"; customerPhone = "+84999999999"
} -ExpectedStatus @(201)
$bookingId2 = $null
if ($booking2 -and $booking2.Json -and $booking2.Json.data -and $booking2.Json.data.booking) {
  $bookingId2 = $booking2.Json.data.booking.id
}
if ($bookingId2) {
  Test-Endpoint -Name "Booking cancel" -Method POST -Url "$BaseUrl/api/bookings/$bookingId2/cancel" -Headers $customerHeaders -Body @{ reason = "Test cancel" }
}
if ($customerId) {
  Test-Endpoint -Name "Booking list by customer" -Method GET -Url "$BaseUrl/api/bookings/customer/$customerId" -Headers $customerHeaders
}

# Ride service
Test-Endpoint -Name "Ride active (customer)" -Method GET -Url "$BaseUrl/api/rides/customer/active" -Headers $rideCustomerHeaders
$rideCreate = Test-Endpoint -Name "Ride create (complete flow)" -Method POST -Url "$BaseUrl/api/rides" -Headers $rideCustomerHeaders -Body @{
  pickup = @{ lat = 10.762622; lng = 106.660172; address = "A" };
  dropoff = @{ lat = 10.776889; lng = 106.700806; address = "B" };
  vehicleType = "ECONOMY"; paymentMethod = "CASH"
} -ExpectedStatus @(201)
$rideIdComplete = $null
if ($rideCreate -and $rideCreate.Json -and $rideCreate.Json.data -and $rideCreate.Json.data.ride) {
  $rideIdComplete = $rideCreate.Json.data.ride.id
}
if ($rideIdComplete) {
  Test-Endpoint -Name "Ride get" -Method GET -Url "$BaseUrl/api/rides/$rideIdComplete" -Headers $rideCustomerHeaders
  Start-Sleep -Seconds 1
  Test-Endpoint -Name "Ride driver-accept (assign)" -Method POST -Url "$BaseUrl/api/rides/$rideIdComplete/driver-accept" -Headers $driverHeaders -Body @{ driverId = $driverId }
  Test-Endpoint -Name "Ride accept (driver)" -Method POST -Url "$BaseUrl/api/rides/$rideIdComplete/accept" -Headers $driverHeaders
  Test-Endpoint -Name "Ride pickup (driver)" -Method POST -Url "$BaseUrl/api/rides/$rideIdComplete/pickup" -Headers $driverHeaders
  Test-Endpoint -Name "Ride start (driver)" -Method POST -Url "$BaseUrl/api/rides/$rideIdComplete/start" -Headers $driverHeaders
  Test-Endpoint -Name "Ride complete (driver)" -Method POST -Url "$BaseUrl/api/rides/$rideIdComplete/complete" -Headers $driverHeaders
  Test-Endpoint -Name "Ride history (customer)" -Method GET -Url "$BaseUrl/api/rides/customer/history" -Headers $rideCustomerHeaders
}

$rideCancel = Test-Endpoint -Name "Ride create (cancel flow)" -Method POST -Url "$BaseUrl/api/rides" -Headers $rideCustomerHeaders -Body @{
  pickup = @{ lat = 10.762622; lng = 106.660172; address = "C" };
  dropoff = @{ lat = 10.776889; lng = 106.700806; address = "D" };
  vehicleType = "ECONOMY"; paymentMethod = "CASH"
} -ExpectedStatus @(201)
$rideIdCancel = $null
if ($rideCancel -and $rideCancel.Json -and $rideCancel.Json.data -and $rideCancel.Json.data.ride) {
  $rideIdCancel = $rideCancel.Json.data.ride.id
}
if ($rideIdCancel) {
  Test-Endpoint -Name "Ride cancel" -Method POST -Url "$BaseUrl/api/rides/$rideIdCancel/cancel" -Headers $rideCustomerHeaders -Body @{ reason = "Test cancel" }
}

# Payment service
if ($rideIdComplete) {
  Start-Sleep -Seconds 5
  Test-Endpoint -Name "Payment get by ride" -Method GET -Url "$BaseUrl/api/payments/ride/$rideIdComplete" -Headers $customerHeaders
}
Test-Endpoint -Name "Payment customer history" -Method GET -Url "$BaseUrl/api/payments/customer/history" -Headers $customerHeaders
if ($rideIdComplete) {
  Test-Endpoint -Name "Payment refund (expect 403)" -Method POST -Url "$BaseUrl/api/payments/ride/$rideIdComplete/refund" -Headers $customerHeaders -Body @{ reason = "Test" } -ExpectedStatus @(403)
}

# AI service (direct)
Test-Endpoint -Name "AI predict" -Method POST -Url "$AiUrl/api/predict" -Body @{
  distance_km = 5; time_of_day = "OFF_PEAK"; day_type = "WEEKDAY"
}
Test-Endpoint -Name "AI stats" -Method GET -Url "$AiUrl/api/stats"

# Write report
$passCount = ($Results | Where-Object { $_.Status -eq 'PASS' }).Count
$failCount = ($Results | Where-Object { $_.Status -eq 'FAIL' }).Count

$reportLines = @()
$reportLines += "Backend Integration Test Report"
$reportLines += "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$reportLines += "BaseUrl: $BaseUrl"
$reportLines += "AI Url: $AiUrl"
$reportLines += "Customer Email: $customerEmail"
$reportLines += "Driver Email: $driverEmail"
$reportLines += "Ride Customer Email: $rideCustomerEmail"
$reportLines += "Customer ID: $customerId"
$reportLines += "Ride Customer ID: $rideCustomerId"
$reportLines += "Driver ID: $driverId"
$reportLines += "Booking ID (confirm): $bookingId1"
$reportLines += "Booking ID (cancel): $bookingId2"
$reportLines += "Ride ID (complete): $rideIdComplete"
$reportLines += "Ride ID (cancel): $rideIdCancel"
$reportLines += ""
$reportLines += "Summary: PASS=$passCount, FAIL=$failCount"
$reportLines += ""
$reportLines += "Results:"
foreach ($r in $Results) {
  $reportLines += "- [$($r.Status)] $($r.Method) $($r.Url) :: $($r.Name) (HTTP $($r.HttpStatus)) $($r.Notes)"
}

$reportDir = Split-Path -Path $ReportPath -Parent
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir | Out-Null }
$reportLines | Set-Content -Path $ReportPath -Encoding UTF8

Write-Host "\n✅ Test completed. Report: $ReportPath" -ForegroundColor Green
