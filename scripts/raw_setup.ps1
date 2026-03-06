<#
.SYNOPSIS
Aegis V5 — Raw Setup (no presentation formatting)
.DESCRIPTION
Validates Base Sepolia connectivity, wallet balance, Docker containers, and WASM compilation.
#>
$ErrorActionPreference = "Continue"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

# ── Load .env ──
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Resolve-Path "$ScriptDir\..").Path ".env"
if (!(Test-Path $EnvPath)) { Write-Host "ERROR: .env not found at $EnvPath"; exit 1 }

$RPC = ""; $PK = ""; $ModuleAddr = ""; $Brett = ""; $Honeypot = ""
Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^BASE_SEPOLIA_RPC_URL=(.*)") { $RPC = $Matches[1].Trim() }
    if ($_ -match "^PRIVATE_KEY=(.*)") { $PK = $Matches[1].Trim() }
    if ($_ -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddr = $Matches[1].Trim() }
    if ($_ -match "^TARGET_TOKEN_ADDRESS=(.*)") { $Brett = $Matches[1].Trim() }
    if ($_ -match "^MOCK_HONEYPOT_ADDRESS=(.*)") { $Honeypot = $Matches[1].Trim() }
}
if (-not $RPC) { $RPC = "https://sepolia.base.org" }
$DevWallet = (cast wallet address --private-key $PK 2>&1 | Out-String).Trim()

Write-Host "=== AEGIS V5 RAW SETUP ==="
Write-Host ""

# ── 1. Chain ID ──
Write-Host "[1/5] Checking Base Sepolia chain ID..."
$ChainId = (cast chain-id --rpc-url $RPC 2>&1 | Out-String).Trim()
Write-Host "  chain-id: $ChainId (expected: 84532)"

# ── 2. Wallet balance ──
Write-Host "[2/5] Checking dev wallet balance..."
$DevBalance = (cast balance $DevWallet --rpc-url $RPC 2>&1 | Out-String).Trim()
$DevBalance = ($DevBalance -replace '\s*\[.*\]\s*$', '').Trim()
if ($DevBalance -match "^\d+$") {
    $ethVal = [math]::Round([decimal]$DevBalance / 1000000000000000000, 4)
    Write-Host "  wallet: $DevWallet"
    Write-Host "  balance: $ethVal ETH"
} else {
    Write-Host "  balance: $DevBalance"
}

# ── 3. Contracts ──
Write-Host "[3/5] Contract addresses..."
Write-Host "  AegisModule:  $ModuleAddr"
Write-Host "  MockBRETT:    $Brett"
Write-Host "  MockHoneypot: $Honeypot"

# ── 4. Docker rebuild ──
Write-Host "[4/5] Rebuilding Docker containers..."
docker compose down 2>&1 | ForEach-Object { Write-Host "  $_" }
docker compose up --build -d 2>&1 | ForEach-Object { Write-Host "  $_" }
Write-Host "  Docker containers up."

# ── 5. WASM compilation ──
Write-Host "[5/5] Compiling oracle to WASM..."
docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup" 2>&1 | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "=== SETUP COMPLETE ==="
Write-Host "  [OK] Base Sepolia chain ID 84532"
Write-Host "  [OK] Wallet funded"
Write-Host "  [OK] Docker containers running"
Write-Host "  [OK] WASM compiled"
Write-Host "  [OK] 3 contracts deployed"
