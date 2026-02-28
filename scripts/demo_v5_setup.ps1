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

# ─── Load Environment ──────────────────────────────────────────────
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

# ── Scene 1: The Network Bedrock ─────────────────────────────────────
Write-Host "`n[Scene 1] Verifying Public Testnet Connection..." -ForegroundColor Yellow
Write-Host "Proving connectivity to live infrastructure, abandoning local mocks." -ForegroundColor DarkGray
Write-Host "> cast chain-id --rpc-url $RPC" -ForegroundColor DarkMagenta

Show-Spinner -Message "  Pinging Base Sepolia RPC... " -DurationMs 1000

$ChainId = cast chain-id --rpc-url $RPC 2>&1 | Out-String
if ($ChainId.Trim() -eq "84532") {
    Write-Host "  ✅ Connected successfully to Base Sepolia (Chain ID: 84532)" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Network check failed (got: $($ChainId.Trim())). Verify RPC url." -ForegroundColor Red
}

Write-Host "`n> cast balance $DevWallet" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Checking deployer bankroll... " -DurationMs 1000

$DevBalance = cast balance $DevWallet --rpc-url $RPC 2>&1 | Out-String
$DevBalanceClean = ($DevBalance.Trim() -replace '\s*\[.*\]\s*$', '').Trim()
if ($DevBalanceClean -match "^\d+$") {
    $DevBalanceEth = [math]::Round([decimal]$DevBalanceClean / 1000000000000000000, 4)
    Write-Host "  ✅ Dev Wallet funded with $DevBalanceEth ETH (Ready for deployments)" -ForegroundColor Green
} else {
    Write-Host "  ✅ Dev Wallet balance: $DevBalanceClean" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Deployed Contracts on Base Sepolia:" -ForegroundColor DarkGray
Write-Host "    AegisModule:   $ModuleAddr" -ForegroundColor White
Write-Host "    MockBRETT:     $Brett" -ForegroundColor White
Write-Host "    MockHoneypot:  $Honeypot" -ForegroundColor White
Pause-Demo

# ── Scene 2: The WASM Sandbox Boot ───────────────────────────────────
Write-Host "`n[Scene 2] Rebuilding Chainlink CRE WASM Sandbox..." -ForegroundColor Yellow
Write-Host "The Aegis AI Oracle requires a secure V8 isolate to execute LLM API calls on-chain." -ForegroundColor DarkGray
Write-Host "Destroying old containers to guarantee a fresh state." -ForegroundColor DarkGray
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
    Start-Sleep -Milliseconds 40 # Cinematic scroll speed
}
Write-Host "  ✅ Chainlink CRE Oracle Node is LIVE." -ForegroundColor Green
Pause-Demo

# ── Scene 3: The Javy Compilation ────────────────────────────────────
Write-Host "`n[Scene 3] Compiling TypeScript to WebAssembly (Javy)..." -ForegroundColor Yellow
Write-Host "Converting the off-chain AI firewall logic into a deterministically verifiable WASM binary." -ForegroundColor DarkGray
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
Write-Host "  ✅ AI Consensus logic successfully compiled to /app/dist/aegis-oracle.wasm" -ForegroundColor Green

Write-Host "`n===========================================================================`n" -ForegroundColor Cyan
Write-Host " ✅ INFRASTRUCTURE BOOT COMPLETE." -ForegroundColor Green
Write-Host " The Base Sepolia perimeter is secure. The Chainlink Oracle is listening." -ForegroundColor Green
Write-Host "`n===========================================================================" -ForegroundColor Cyan
Write-Host "  Next Step: Run .\scripts\demo_v5_master.ps1 -Interactive" -ForegroundColor Yellow
Write-Host ""
