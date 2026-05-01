param(
    [switch]$Yes,
    [switch]$RemoveImages,
    [switch]$PruneBuildCache
)

function Confirm-OrExit {
    param([string]$Message)

    if ($Yes) { return }

    $answer = Read-Host "$Message Type YES to continue"
    if ($answer -ne "YES") {
        Write-Host "Cancelled."
        exit 1
    }
}

function Get-ComposeProjectName {
    $name = Split-Path -Leaf (Get-Location)

    # Docker Compose normalizuje nazwę projektu: małe litery, tylko a-z, 0-9, _ i -
    $name = $name.ToLower()
    $name = $name -replace '[^a-z0-9_-]', ''

    return $name
}

$ProjectName = Get-ComposeProjectName

Write-Host "=== SAFE RESET CURRENT DOCKER COMPOSE PROJECT ==="
Write-Host "Current folder: $(Get-Location)"
Write-Host "Detected Compose project name: $ProjectName"
Write-Host ""

if (-not (Test-Path ".\docker-compose.yml") -and -not (Test-Path ".\compose.yml")) {
    Write-Host "ERROR: No docker-compose.yml or compose.yml found in current folder."
    Write-Host "Run this script from the project root."
    exit 1
}

Confirm-OrExit "This will delete containers, networks and volumes only for project '$ProjectName'. Database volume will be deleted."

Write-Host "`n=== 1. docker compose down -v ==="
docker compose down -v --remove-orphans

Write-Host "`n=== 2. Remove leftover containers by Compose label ==="
docker ps -aq --filter "label=com.docker.compose.project=$ProjectName" | ForEach-Object {
    if ($_){
        Write-Host "Removing container: $_"
        docker rm -f $_ 2>$null
    }
}

Write-Host "`n=== 3. Remove leftover volumes by Compose label ==="
docker volume ls -q --filter "label=com.docker.compose.project=$ProjectName" | ForEach-Object {
    if ($_){
        Write-Host "Removing volume: $_"
        docker volume rm -f $_ 2>$null
    }
}

Write-Host "`n=== 4. Remove leftover networks by Compose label ==="
docker network ls -q --filter "label=com.docker.compose.project=$ProjectName" | ForEach-Object {
    if ($_){
        Write-Host "Removing network: $_"
        docker network rm $_ 2>$null
    }
}

if ($RemoveImages) {
    Write-Host "`n=== 5. Remove project images by Compose label ==="
    docker image ls -q --filter "label=com.docker.compose.project=$ProjectName" | Sort-Object -Unique | ForEach-Object {
        if ($_){
            Write-Host "Removing image: $_"
            docker rmi -f $_ 2>$null
        }
    }

    Write-Host "`n=== 5b. Remove project images by repository prefix fallback ==="
    docker image ls --format "{{.Repository}} {{.ID}}" | Where-Object {
        $_ -match "^$ProjectName"
    } | ForEach-Object {
        $parts = $_ -split "\s+"
        $id = $parts[1]
        if ($id) {
            Write-Host "Removing image: $id"
            docker rmi -f $id 2>$null
        }
    }
}

if ($PruneBuildCache) {
    Write-Host "`n=== 6. Prune Docker build cache ==="
    docker builder prune -f
}

Write-Host "`n=== 7. Verification ==="

Write-Host "`nContainers for project:"
docker ps -a --filter "label=com.docker.compose.project=$ProjectName"

Write-Host "`nVolumes for project:"
docker volume ls --filter "label=com.docker.compose.project=$ProjectName"

Write-Host "`nNetworks for project:"
docker network ls --filter "label=com.docker.compose.project=$ProjectName"

Write-Host "`n=== DONE ==="
Write-Host "Project '$ProjectName' was reset safely."
Write-Host "To start again:"
Write-Host "  py .\run.py --detach"