param(
  [switch]$NoCache,
  [string]$ComposeFile = "$PSScriptRoot/../docker-compose.yml"
)

. "$PSScriptRoot/common/utils.ps1"

Ensure-Command docker

$args = @('compose', '-f', $ComposeFile, 'build')
if ($NoCache) { $args += '--no-cache' }

Write-Log "Building Docker images using $ComposeFile" 'Info'
& docker @args
Write-Log "Build complete" 'Success'
