<#
.SYNOPSIS
Starts the Chainlink CRE Oracle Docker environment and connects it to the local Tenderly/Anvil fork.

.DESCRIPTION
This script:
  1. Reads the current TENDERLY_RPC_URL and AEGIS_MODULE_ADDRESS from .env
  2. Updates the CRE node's config.json with the current module address and RPC URL
  3. Starts (or rebuilds) the Docker Compose environment
  4. Tails the docker logs so you can watch the CRE node pick up AuditRequested events

.PARAMETER Rebuild
  Force a full --no-cache Docker image rebuild before starting.
  Use this for demos to show the container being built from scratch.
  Without this flag, docker compose uses the cached image (fast startup).

.EXAMPLE
  .\scripts\start_oracle.ps1             # Fast start (cached image)
  .\scripts\start_oracle.ps1 -Rebuild    # Full rebuild + start (for demos)
#>

param([switch]$Rebuild)

$ErrorActionPreference = "Stop"

# Navigate to project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($ScriptDir -match "scripts$") { Set-Location -Path "$ScriptDir\.." }

# ── Read .env ────────────────────────────────────────────────────────────────
if (!(Test-Path ".env")) { Write-Error ".env file not found!" }

$EnvContent = Get-Content .env
$RpcUrl = ""
$ModuleAddress = ""

foreach ($line in $EnvContent) {
    if ($line -match "^TENDERLY_RPC_URL=(.*)") { $RpcUrl        = $Matches[1].Trim() }
    if ($line -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddress = $Matches[1].Trim() }
}

if (!$RpcUrl) { Write-Error "TENDERLY_RPC_URL not found in .env!" }
if (!$ModuleAddress) {
    Write-Warning "AEGIS_MODULE_ADDRESS not found in .env. Using zero address placeholder."
    $ModuleAddress = "0x0000000000000000000000000000000000000000"
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  🔗 AEGIS V4 — CHAINLINK CRE ORACLE LAUNCHER" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  RPC URL:        $RpcUrl" -ForegroundColor White
Write-Host "  AegisModule:    $ModuleAddress" -ForegroundColor White
Write-Host ""

# ── Update cre-node/config.json with module address and RPC ──────────────────
$ConfigPath = "cre-node/config.json"
if (Test-Path $ConfigPath) {
    Write-Host "1. Updating cre-node/config.json..." -ForegroundColor Yellow
    $ConfigContent = Get-Content $ConfigPath -Raw
    $ConfigContent = $ConfigContent -replace '"vaultAddress"\s*:\s*"0x[a-fA-F0-9]+"', "`"vaultAddress`": `"$ModuleAddress`""
    $ConfigContent | Set-Content $ConfigPath
    Write-Host "  > config.json updated (AegisModule V4 address)" -ForegroundColor Green
} else {
    Write-Warning "cre-node/config.json not found. Creating default config..."
    $DefaultConfig = @{
        vaultAddress     = $ModuleAddress
        chainSelectorName = "tenderly"
        rpcUrl           = $RpcUrl
    } | ConvertTo-Json -Depth 3

    New-Item -ItemType Directory -Force -Path "cre-node" | Out-Null
    $DefaultConfig | Set-Content $ConfigPath
    Write-Host "  > Default config.json created" -ForegroundColor Green
}

# ── Update YAML configs with new RPC URL ─────────────────────────────────────
Write-Host "`n2. Updating CRE YAML files..." -ForegroundColor Yellow
foreach ($yamlPath in @("cre-node/workflow.yaml", "cre-node/project.yaml")) {
    if (Test-Path $yamlPath) {
        # Replace any existing http(s):// RPC URL with new one
        (Get-Content $yamlPath) -replace 'https?://[^\s"]+tenderly[^\s"]*', $RpcUrl | Set-Content $yamlPath
        Write-Host "  > Updated $yamlPath" -ForegroundColor Green
    } else {
        Write-Host "  > $yamlPath not found (skipping)" -ForegroundColor DarkGray
    }
}

# ── Check Docker is running ───────────────────────────────────────────────────
Write-Host "`n3. Checking Docker daemon..." -ForegroundColor Yellow
$dockerCheck = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not running! Please start Docker Desktop and try again.`n$dockerCheck"
}
Write-Host "  > Docker is running ✅" -ForegroundColor Green

# ── Build and start Docker Compose ────────────────────────────────────────────
Write-Host "`n4. Starting Chainlink CRE Oracle node (Docker Compose)..." -ForegroundColor Yellow

$ComposeFile = "docker-compose.yaml"
if (!(Test-Path $ComposeFile)) {
    # Check in v3-reference
    if (Test-Path "v3-reference/docker-compose.yaml") {
        Write-Host "  > Using v3-reference/docker-compose.yaml" -ForegroundColor DarkGray
        $ComposeFile = "v3-reference/docker-compose.yaml"
    } else {
        Write-Error "docker-compose.yaml not found! Please create it or copy from v3-reference."
    }
}

# Set environment variables for docker-compose
$env:AEGIS_MODULE_ADDRESS = $ModuleAddress
$env:TENDERLY_RPC_URL     = $RpcUrl

if ($Rebuild) {
    Write-Host "  > Rebuilding Docker image (--no-cache)..." -ForegroundColor Yellow
    docker compose -f $ComposeFile build --no-cache 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    Write-Host "  > Build complete. Starting container..." -ForegroundColor Green
    docker compose -f $ComposeFile up -d 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
} else {
    docker compose -f $ComposeFile up --build -d 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
}

Write-Host "  > Docker container started ✅" -ForegroundColor Green

# ── Tail logs ─────────────────────────────────────────────────────────────────
Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "  🟢 CRE NODE RUNNING — MONITORING LOGS" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host "  Watch for: 'AuditRequested intercepted' and 'onReport delivered'" -ForegroundColor DarkGray
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

docker compose -f $ComposeFile logs -f --tail=50 2>&1
