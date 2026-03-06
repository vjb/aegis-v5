<#
.SYNOPSIS
Aegis V5 — Raw CRE Oracle Pipeline (no presentation formatting)
.DESCRIPTION
Generates an AuditRequested event and runs the CRE WASM sandbox.
Shows raw GoPlus + BaseScan + GPT-4o + Llama-3 output.
#>
param([string]$TxHash = "")
$ErrorActionPreference = "Continue"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

# ── Load .env ──
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Resolve-Path "$ScriptDir\..").Path ".env"
if (!(Test-Path $EnvPath)) { Write-Host "ERROR: .env not found"; exit 1 }

$RPC = ""; $ModuleAddr = ""; $PK = ""; $TargetToken = ""
Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^BASE_SEPOLIA_RPC_URL=(.*)") { $RPC = $Matches[1].Trim() }
    if ($_ -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddr = $Matches[1].Trim() }
    if ($_ -match "^PRIVATE_KEY=(.*)") { $PK = $Matches[1].Trim() }
    if ($_ -match "^MOCK_HONEYPOT_ADDRESS=(.*)") { $TargetToken = $Matches[1].Trim() }
}
if (-not $RPC) { $RPC = "https://sepolia.base.org" }

Write-Host "=== AEGIS V5 RAW CRE PIPELINE ==="
Write-Host "  Module: $ModuleAddr"
Write-Host "  Target: $TargetToken (MockHoneypot)"
Write-Host ""

# ── Generate AuditRequested event if no TxHash provided ──
if ([string]::IsNullOrWhiteSpace($TxHash)) {
    Write-Host "[1/2] Generating AuditRequested event on Base Sepolia..."
    Write-Host "  > cast send $ModuleAddr requestAudit(address) $TargetToken"
    $TxOutput = cast send $ModuleAddr "requestAudit(address)" $TargetToken --rpc-url $RPC --private-key $PK 2>&1 | Out-String
    foreach ($line in $TxOutput -split "`n") {
        if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") {
            $TxHash = $Matches[1]; break
        }
    }
    if ([string]::IsNullOrWhiteSpace($TxHash)) {
        Write-Host "  ERROR: Failed to get tx hash"; exit 1
    }
    Write-Host "  TxHash: $TxHash"
    Write-Host "  Waiting 8s for receipt propagation..."
    Start-Sleep -Seconds 8
}

# ── Run CRE WASM sandbox ──
Write-Host "[2/2] Running CRE WASM sandbox..."
$cmd = "docker exec -e AEGIS_DEMO_MODE=true aegis-oracle-node cre workflow simulate /app --target base-sepolia --evm-tx-hash $TxHash --trigger-index 0 --evm-event-index 0 --non-interactive --verbose"
Write-Host "  > $cmd"
Write-Host ""

Invoke-Expression "$cmd 2>&1" | ForEach-Object {
    $line = $_.ToString()
    # Only show [USER LOG] lines and key simulation lines, skip JSON noise
    if ($line -match "\[USER LOG\]" -or $line -match "Workflow Simulation Result" -or $line -match "\[SIMULATION\].*finish") {
        Write-Host $line
    }
}

Write-Host ""
Write-Host "=== CRE PIPELINE COMPLETE ==="
Write-Host "  GoPlus: mock for demo tokens (live for real tokens)"
Write-Host "  BaseScan: mock for demo tokens (live for real tokens)"
Write-Host "  GPT-4o: live API call"
Write-Host "  Llama-3: live API call"
Write-Host "  Consensus: Union of Fears bitmask"
