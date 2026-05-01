param(
    [switch]$Yes,
    [switch]$RemoveImages,
    [switch]$PruneBuildCache
)
function Confirm-OrExit { param([string]$Message) if ($Yes) { return } $answer = Read-Host "$Message Type YES to continue"; if ($answer -ne "YES") { Write-Host "Cancelled."; exit 1 } }
function Get-ComposeProjectName { $name = Split-Path -Leaf (Get-Location); $name = $name.ToLower(); $name = $name -replace '[^a-z0-9_-]', ''; return $name }
$ProjectName = Get-ComposeProjectName
Write-Host "=== SAFE RESET CURRENT DOCKER COMPOSE PROJECT ==="
Write-Host "Current folder: $(Get-Location)"
Write-Host "Detected Compose project name: $ProjectName"
if (-not (Test-Path ".\docker-compose.yml") -and -not (Test-Path ".\compose.yml")) { Write-Host "ERROR: No docker-compose.yml or compose.yml found in current folder."; exit 1 }
Confirm-OrExit "This will delete containers, networks and volumes only for project '$ProjectName'. Database volume will be deleted."
docker compose down -v --remove-orphans
docker ps -aq --filter "label=com.docker.compose.project=$ProjectName" | ForEach-Object { if ($_) { docker rm -f $_ 2>$null } }
docker volume ls -q --filter "label=com.docker.compose.project=$ProjectName" | ForEach-Object { if ($_) { docker volume rm -f $_ 2>$null } }
docker network ls -q --filter "label=com.docker.compose.project=$ProjectName" | ForEach-Object { if ($_) { docker network rm $_ 2>$null } }
if ($RemoveImages) { docker image ls -q --filter "label=com.docker.compose.project=$ProjectName" | Sort-Object -Unique | ForEach-Object { if ($_) { docker rmi -f $_ 2>$null } } }
if ($PruneBuildCache) { docker builder prune -f }
Write-Host "=== Verification ==="
docker ps -a --filter "label=com.docker.compose.project=$ProjectName"
docker volume ls --filter "label=com.docker.compose.project=$ProjectName"
docker network ls --filter "label=com.docker.compose.project=$ProjectName"
Write-Host "=== DONE ==="
