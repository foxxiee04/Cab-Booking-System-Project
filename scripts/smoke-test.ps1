param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "smoketest_$(Get-Date -Format 'yyyyMMdd_HHmmss')@example.com",
  [string]$Password = "Password123!"
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [Parameter(Mandatory=$true)][ValidateSet('GET','POST','PUT','PATCH','DELETE')] [string]$Method,
    [Parameter(Mandatory=$true)] [string]$Url,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )

  $params = @{ Method = $Method; Uri = $Url; Headers = $Headers }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  return Invoke-RestMethod @params
}

Write-Host "== Smoke test backend ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"

# 1) Gateway health
Write-Host "\n[1/5] GET /health" -ForegroundColor Yellow
$gatewayHealth = Invoke-Json -Method GET -Url "$BaseUrl/health"
$gatewayHealth | ConvertTo-Json -Depth 10 | Write-Host

# 2) Services health aggregation
Write-Host "\n[2/5] GET /health/services" -ForegroundColor Yellow
$servicesHealth = Invoke-Json -Method GET -Url "$BaseUrl/health/services"
$servicesHealth | ConvertTo-Json -Depth 10 | Write-Host

# 3) Register
Write-Host "\n[3/5] POST /api/auth/register" -ForegroundColor Yellow
$registerBody = @{ email = $Email; password = $Password; role = "CUSTOMER"; firstName = "Smoke"; lastName = "Test" }
$register = Invoke-Json -Method POST -Url "$BaseUrl/api/auth/register" -Body $registerBody
$register.data.user | ConvertTo-Json -Depth 10 | Write-Host

# 4) Login
Write-Host "\n[4/5] POST /api/auth/login" -ForegroundColor Yellow
$loginBody = @{ email = $Email; password = $Password }
$login = Invoke-Json -Method POST -Url "$BaseUrl/api/auth/login" -Body $loginBody
$accessToken = $login.data.tokens.accessToken
if (-not $accessToken) { throw "Login did not return accessToken" }
Write-Host "Got access token (length=$($accessToken.Length))"

$authHeaders = @{ Authorization = "Bearer $accessToken" }

# 5) AI endpoints (1 public, 1 auth-required)
Write-Host "\n[5/5] POST /api/ai/ride/estimate (public)" -ForegroundColor Yellow
$estimateBody = @{ pickup = @{ lat = 10.762622; lng = 106.660172 }; destination = @{ lat = 10.776889; lng = 106.700806 } }
$estimate = Invoke-Json -Method POST -Url "$BaseUrl/api/ai/ride/estimate" -Body $estimateBody
$estimate | ConvertTo-Json -Depth 10 | Write-Host

Write-Host "\n[extra] POST /api/ai/match/drivers (auth)" -ForegroundColor Yellow
$matchBody = @{ ride_id = "ride-smoke-001"; pickup = @{ lat = 10.762622; lng = 106.660172 }; max_distance_km = 5 }
$match = Invoke-Json -Method POST -Url "$BaseUrl/api/ai/match/drivers" -Body $matchBody -Headers $authHeaders
$match | ConvertTo-Json -Depth 10 | Write-Host

Write-Host "\n✅ Smoke test completed." -ForegroundColor Green
