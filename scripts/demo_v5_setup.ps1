<#
.SYNOPSIS
    Aegis Protocol V5 — Act 0: Infrastructure Boot & Provisioning
.DESCRIPTION
    Cinematic demo script for hackathon Loom video recording.
    Boots Docker CRE node, compiles WASM oracle, verifies Base Sepolia connectivity.
.PARAMETER Interactive
    If set, pauses between scenes for narration.
#>
param([switch]$Interactive)

$ErrorActionPreference = "Continue"

function Pause-Demo {
    if ($Interactive) {
        Write-Host ""
        Write-Host "  Press ENTER to continue..." -ForegroundColor DarkGray
        Read-Host | Out-Null
    }
}

function Write-Banner($text) {
    $border = "═" * 65
    Write-Host ""
    Write-Host "  $border" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "  $border" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Scene($number, $title) {
    Write-Host ""
    Write-Host "  ┌─── SCENE $number ───────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "  │  $title" -ForegroundColor Yellow
    Write-Host "  └────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
    Write-Host ""
}

function Write-Narrative($text) {
    Write-Host "  $text" -ForegroundColor DarkGray
}

function Write-Success($text) {
    Write-Host "  ✅ $text" -ForegroundColor Green
}

function Write-Command($cmd) {
    Write-Host "  ▶ $cmd" -ForegroundColor White
}

# ═══════════════════════════════════════════════════════════════════════
#  ACT 0: INFRASTRUCTURE BOOT
# ═══════════════════════════════════════════════════════════════════════

Write-Banner "⚙️  AEGIS PROTOCOL V5 · ACT 0: INFRASTRUCTURE BOOT"

Write-Narrative "The Aegis Protocol is a zero-custody AI firewall for autonomous trading agents."
Write-Narrative "Before the AI can guard your capital, the decentralized oracle must be compiled"
Write-Narrative "and the blockchain connection verified."
Write-Host ""

# ── Scene 1: The Sandbox ──────────────────────────────────────────────

Write-Scene "1" "THE SANDBOX — Rebuilding Chainlink CRE WASM Sandbox"

Write-Narrative "Spinning up the Chainlink CRE Docker node..."
Write-Narrative "This container holds the oracle runtime: GoPlus API, BaseScan, GPT-4o, Llama-3."
Write-Host ""
Write-Command "docker compose up --build -d"

docker compose up --build -d 2>&1 | ForEach-Object {
    if ($_ -match "Creating|Started|Running|Built|Building|Step|Pulling") {
        Write-Host "  │ $_" -ForegroundColor DarkCyan
    }
}

Start-Sleep -Seconds 2

# Verify container is running
$containerName = docker ps --filter "name=aegis-oracle" --format "{{.Names}}" 2>&1
if ($containerName -match "aegis") {
    Write-Success "CRE Docker container is LIVE: $containerName"
} else {
    Write-Host "  ⚠️  Container not detected — checking..." -ForegroundColor Yellow
    docker ps 2>&1 | ForEach-Object { Write-Host "  │ $_" -ForegroundColor DarkGray }
}

Pause-Demo

# ── Scene 2: The Compilation ──────────────────────────────────────────

Write-Scene "2" "THE COMPILATION — Compiling Javy WASM Plugin for AI Consensus"

Write-Narrative "The CRE oracle TypeScript is compiled into a Javy WASM plugin."
Write-Narrative "This runs inside a sandboxed WebAssembly environment in the DON."
Write-Host ""
Write-Command "docker exec aegis-oracle-node bash -c 'cd /app && bun x cre-setup'"

$creOutput = docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup" 2>&1
$creOutput | ForEach-Object {
    $line = $_
    if ($line -match "Compil|Success|Built|WASM|wasm") {
        Write-Host "  │ $line" -ForegroundColor Magenta
    } elseif ($line -match "Error|error|FAIL") {
        Write-Host "  │ $line" -ForegroundColor Red
    } else {
        Write-Host "  │ $line" -ForegroundColor DarkGray
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Success "WASM oracle plugin compiled successfully"
} else {
    Write-Host "  ❌ Compilation failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
}

Pause-Demo

# ── Scene 3: The Network ─────────────────────────────────────────────

Write-Scene "3" "THE NETWORK — Verifying Base Sepolia Connectivity"

Write-Narrative "Proving we are connected to the live Base Sepolia testnet."
Write-Narrative "This is a real public blockchain — not a local fork."
Write-Host ""
Write-Command "cast chain-id --rpc-url https://sepolia.base.org"

$chainId = cast chain-id --rpc-url https://sepolia.base.org 2>&1
Write-Host "  Chain ID: " -NoNewline -ForegroundColor White
Write-Host "$chainId" -ForegroundColor Green

if ($chainId -eq "84532") {
    Write-Success "Connected to Base Sepolia (chain ID: 84532)"
} else {
    Write-Host "  ⚠️  Unexpected chain ID: $chainId" -ForegroundColor Yellow
}

Write-Host ""
Write-Narrative "Deployed contracts on Base Sepolia:"
Write-Host "  AegisModule:   0x23EfaEF29EcC0e6CE313F0eEd3d5dA7E0f5Bcd89" -ForegroundColor White
Write-Host "  MockBRETT:     0x46d40e0aBdA0814bb0CB323B2Bb85a129d00B0AC" -ForegroundColor White
Write-Host "  MockHoneypot:  0xf672c8fc888b98db5c9662d26e657417a3c453b5" -ForegroundColor White

Pause-Demo

# ── Outro ─────────────────────────────────────────────────────────────

$border = "═" * 65
Write-Host ""
Write-Host "  $border" -ForegroundColor Green
Write-Host "  ✅ INFRASTRUCTURE LIVE ON BASE SEPOLIA" -ForegroundColor Green
Write-Host "  $border" -ForegroundColor Green
Write-Host ""
Write-Narrative "The CRE oracle is compiled, the Docker node is running,"
Write-Narrative "and the blockchain is live. Ready for Act 1."
Write-Host ""
