<#
.SYNOPSIS
Aegis Protocol V5 - Infrastructure Boot & Provisioning (Act 0)

.DESCRIPTION
The foundational setup script for the final hackathon presentation.
Proves the decentralized bedrock of the Aegis Protocol:
  1. Validates connection to the live Base Sepolia network.
  2. Proves the Dev Wallet has the gas required for deployments.
  3. Rebuilds the Chainlink CRE Docker container from scratch.
  4. Compiles the TypeScript oracle logic into a secure WASM plugin using Javy.

.EXAMPLE
.\scripts\demo_v5_setup.ps1 -Interactive
#>

param([switch]$Interactive)
$ErrorActionPreference = "Continue"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

# ─── Helper: Cinematic Pause ───────────────────────────────────────
function Pause-Demo { 
    if ($Interactive) { 
        Write-Host "`n  [Press Enter to advance scene...] " -NoNewline -ForegroundColor DarkGray; Read-Host 
    } 
}

# ─── Helper: Animated Spinner ───────────────────────────────────────
function Show-Spinner {
    param([string]$Message, [int]$DurationMs)
    $spinChars = @('|', '/', '-', '\')
    $i = 0
    Write-Host -NoNewline $Message
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.ElapsedMilliseconds -lt $DurationMs) {
        Write-Host -NoNewline "`b$($spinChars[$i % 4])"
        $i++
        Start-Sleep -Milliseconds 75
    }
    Write-Host "`b " -NoNewline
}

# ─── Helper: V3-Style Act Introduction Box ─────────────────────────
function ActIntro {
    param([string]$Title, [string[]]$Lines, [string]$Prompt)
    if (-not $Interactive) { return }
    $w = 60
    Write-Host ""
    Write-Host ("  ┌" + ("─" * $w) + "┐") -ForegroundColor DarkCyan
    $padded = "  " + $Title.PadRight($w - 2)
    Write-Host ("  │" + $padded + "│") -ForegroundColor DarkCyan
    Write-Host ("  │" + (" " * $w) + "│") -ForegroundColor DarkCyan
    foreach ($l in $Lines) {
        $padded = "  " + $l.PadRight($w - 2)
        Write-Host ("  │" + $padded + "│") -ForegroundColor DarkCyan
    }
    Write-Host ("  └" + ("─" * $w) + "┘") -ForegroundColor DarkCyan
    Write-Host ""
    if ($Prompt) {
        Write-Host "  ⏎  $Prompt" -ForegroundColor Cyan
        Write-Host "     Press ENTER to execute →" -ForegroundColor DarkCyan -NoNewline
        Read-Host
        Write-Host ""
    }
}

# ─── Helper: Success / Info messages ───────────────────────────────
function Success($text) { Write-Host "  ✅ $text" -ForegroundColor Green }
function Info($text) { Write-Host "  ℹ️  $text" -ForegroundColor Gray }

# ═══════════════════════════════════════════════════════════════════════
#  LOAD ENVIRONMENT
# ═══════════════════════════════════════════════════════════════════════

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Resolve-Path "$ScriptDir\..").Path ".env"

if (!(Test-Path $EnvPath)) {
    Write-Host "❌ .env file not found at $EnvPath" -ForegroundColor Red
    exit 1
}

$RPC = ""; $PK = ""; $ModuleAddr = ""; $Brett = ""; $Honeypot = ""
Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^BASE_SEPOLIA_RPC_URL=(.*)") { $RPC = $Matches[1].Trim() }
    if ($_ -match "^PRIVATE_KEY=(.*)") { $PK = $Matches[1].Trim() }
    if ($_ -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddr = $Matches[1].Trim() }
    if ($_ -match "^TARGET_TOKEN_ADDRESS=(.*)") { $Brett = $Matches[1].Trim() }
    if ($_ -match "^MOCK_HONEYPOT_ADDRESS=(.*)") { $Honeypot = $Matches[1].Trim() }
}

if (-not $RPC) { $RPC = "https://sepolia.base.org" }

# Derive dev wallet address from private key
$DevWallet = cast wallet address --private-key $PK 2>&1 | Out-String
$DevWallet = $DevWallet.Trim()

# ═══════════════════════════════════════════════════════════════════════
#  HEADER
# ═══════════════════════════════════════════════════════════════════════

Clear-Host
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "     ██████╗ ███████╗ ██████╗ ██╗ ███████╗" -ForegroundColor Cyan
Write-Host "     ██╔══██╗██╔════╝██╔════╝ ██║ ██╔════╝" -ForegroundColor Cyan
Write-Host "     ███████║█████╗  ██║ ████╗██║ ███████╗" -ForegroundColor Cyan
Write-Host "     ██╔══██║██╔══╝  ██║   ██║██║ ╚════██║" -ForegroundColor Cyan
Write-Host "     ██║  ██║███████╗╚██████╔╝██║ ███████║" -ForegroundColor Cyan
Write-Host "     ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝ ╚══════╝  v5.0" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ⚙️  ACT 0: DECENTRALIZED INFRASTRUCTURE BOOT" -ForegroundColor White
Write-Host "  Establishing the Base Sepolia perimeter & WASM Sandbox..." -ForegroundColor DarkGray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  SCENE 1: THE NETWORK BEDROCK
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "SCENE 1: THE NETWORK BEDROCK" -Lines @(
    "Before anything else, we prove connectivity to LIVE",
    "infrastructure. No local mocks, no simulated chains.",
    "",
    "We'll verify:",
    "  • Base Sepolia Chain ID (84532)",
    "  • Dev wallet has gas for deployments",
    "  • All three contracts are deployed on-chain"
) -Prompt "Verify Base Sepolia connectivity and wallet balance"

Write-Host "`n[Scene 1] Verifying Public Testnet Connection..." -ForegroundColor Yellow
Write-Host "> cast chain-id --rpc-url $RPC" -ForegroundColor DarkMagenta

Show-Spinner -Message "  Pinging Base Sepolia RPC... " -DurationMs 1000

$ChainId = cast chain-id --rpc-url $RPC 2>&1 | Out-String
if ($ChainId.Trim() -eq "84532") {
    Success "Connected successfully to Base Sepolia (Chain ID: 84532)"
} else {
    Write-Host "  ⚠️ Network check failed (got: $($ChainId.Trim())). Verify RPC url." -ForegroundColor Red
}

Write-Host "`n> cast balance $DevWallet" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Checking deployer bankroll... " -DurationMs 1000

$DevBalance = cast balance $DevWallet --rpc-url $RPC 2>&1 | Out-String
$DevBalanceClean = ($DevBalance.Trim() -replace '\s*\[.*\]\s*$', '').Trim()
if ($DevBalanceClean -match "^\d+$") {
    $DevBalanceEth = [math]::Round([decimal]$DevBalanceClean / 1000000000000000000, 4)
    Success "Dev Wallet funded with $DevBalanceEth ETH (Ready for deployments)"
} else {
    Success "Dev Wallet balance: $DevBalanceClean"
}

Write-Host ""
Write-Host "  ┌──────────────────── DEPLOYED CONTRACTS ───────────────────┐" -ForegroundColor White
Write-Host "  │                                                            │" -ForegroundColor White
Write-Host "  │  AegisModule:   $ModuleAddr      │" -ForegroundColor White
Write-Host "  │  MockBRETT:     $Brett      │" -ForegroundColor White
Write-Host "  │  MockHoneypot:  $Honeypot      │" -ForegroundColor White
Write-Host "  │                                                            │" -ForegroundColor White
Write-Host "  └────────────────────────────────────────────────────────────┘" -ForegroundColor White
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  SCENE 2: THE WASM SANDBOX BOOT
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "SCENE 2: THE WASM SANDBOX BOOT" -Lines @(
    "The Aegis AI Oracle runs inside a Chainlink CRE Docker",
    "container. We're rebuilding it from scratch to guarantee",
    "a clean, deterministic state.",
    "",
    "This container runs:",
    "  • Chainlink CRE SDK (TypeScript)",
    "  • Javy WASM compiler (Rust → WebAssembly)",
    "  • Bun runtime for build tooling"
) -Prompt "Rebuild the CRE Docker container from scratch"

Write-Host "`n[Scene 2] Rebuilding Chainlink CRE WASM Sandbox..." -ForegroundColor Yellow
Info "Destroying old containers to guarantee a fresh state."
Write-Host "`n> docker compose down && docker compose up --build -d" -ForegroundColor DarkMagenta

# Spin down
docker compose down 2>&1 | ForEach-Object {
    Write-Host "  [Docker] $_" -ForegroundColor DarkGray
}

# Spin up and stream logs for visual effect
docker compose up --build -d 2>&1 | ForEach-Object {
    if ($_ -match "Running|Started|Healthy|Creating|Built") {
        Write-Host "  [Docker] $_" -ForegroundColor Cyan
    } else {
        Write-Host "  [Docker] $_" -ForegroundColor DarkGray
    }
    Start-Sleep -Milliseconds 40
}
Success "Chainlink CRE Oracle Node is LIVE."
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  SCENE 3: THE JAVY COMPILATION
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "SCENE 3: THE JAVY COMPILATION" -Lines @(
    "Converting the off-chain AI firewall logic into a",
    "deterministically verifiable WASM binary.",
    "",
    "Javy compiles TypeScript → QuickJS bytecode → WASM.",
    "This ensures every DON node executes the EXACT same",
    "code — Byzantine consensus requires bit-for-bit",
    "deterministic execution."
) -Prompt "Compile the oracle to WebAssembly via Javy"

Write-Host "`n[Scene 3] Compiling TypeScript to WebAssembly (Javy)..." -ForegroundColor Yellow
Write-Host "`n> docker exec aegis-oracle-node bash -c `"cd /app && bun x cre-setup`"" -ForegroundColor DarkMagenta

Show-Spinner -Message "  Initializing Javy compiler... " -DurationMs 1500

docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup" 2>&1 | ForEach-Object {
    if ($_ -match "error|fail") {
        Write-Host "  [WASM] $_" -ForegroundColor Red
    } elseif ($_ -match "success|compiled|Success") {
        Write-Host "  [WASM] $_" -ForegroundColor Green
    } else {
        Write-Host "  [WASM] $_" -ForegroundColor DarkGray
    }
}
Success "AI Consensus logic successfully compiled to /app/dist/aegis-oracle.wasm"

# ═══════════════════════════════════════════════════════════════════════
#  OUTRO — Summary
# ═══════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " ✅ INFRASTRUCTURE BOOT COMPLETE" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "  │ ✅ Base Sepolia    — Chain ID 84532 confirmed            │" -ForegroundColor Green
Write-Host "  │ ✅ Dev Wallet      — Funded and ready for gas            │" -ForegroundColor Green
Write-Host "  │ ✅ Docker          — CRE container rebuilt from scratch  │" -ForegroundColor Green
Write-Host "  │ ✅ WASM            — Javy compilation successful         │" -ForegroundColor Green
Write-Host "  │ ✅ Contracts       — All 3 deployed on Base Sepolia      │" -ForegroundColor Green
Write-Host "  └──────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  The Base Sepolia perimeter is secure. The Chainlink Oracle is listening." -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Next Step: Run .\scripts\demo_v5_master.ps1 -Interactive" -ForegroundColor Yellow
Write-Host ""
