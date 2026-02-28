<#
.SYNOPSIS
    V5 Phase 5a — Start local AA dev environment and run E2E mock test.

.DESCRIPTION
    1. Starts Anvil forked from the Tenderly VNet (inherits deployed AegisModule)
    2. Deploys a Safe Smart Account (or reuses SAFE_ADDRESS from .env)
    3. Starts alto ERC-4337 bundler against Anvil
    4. Runs v5_e2e_mock.ts (requestAudit via UserOp → mock oracle → swap via UserOp)

.NOTES
    Requires:
      - Foundry/Anvil installed (anvil --version)
      - Docker Desktop running (for alto bundler)
      - .env with TENDERLY_RPC_URL, PRIVATE_KEY, AGENT_PRIVATE_KEY, AEGIS_MODULE_ADDRESS

    Phase 6: Run scripts/start_oracle.ps1 first, then replace onReportDirect
             with the real onReport() callback from the Chainlink CRE DON.
#>

# ─── Load .env ────────────────────────────────────────────────────────────────
Get-Content .env | Where-Object { $_ -match '^\s*[^#]' } | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}

$TENDERLY_RPC  = $env:TENDERLY_RPC_URL
$PRIVATE_KEY   = $env:PRIVATE_KEY
$MODULE_ADDR   = $env:AEGIS_MODULE_ADDRESS
$SAFE_ADDR     = $env:SAFE_ADDRESS
$ANVIL_PORT    = 8545
$BUNDLER_PORT  = 4337
$CHAIN_ID      = 73578453

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🤖 AEGIS V5 — Phase 5a Local E2E Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: Start Anvil forked from Tenderly ─────────────────────────────────
Write-Host "[1/4] Starting Anvil fork of Tenderly VNet..." -ForegroundColor Yellow
Write-Host "      Fork URL: $TENDERLY_RPC"
Write-Host "      This inherits deployed AegisModule at $MODULE_ADDR"
Write-Host ""

$anvilJob = Start-Job -ScriptBlock {
    param($rpc, $port, $chainId)
    & anvil `
        --fork-url $rpc `
        --port $port `
        --chain-id $chainId `
        --block-time 1 `
        --accounts 10 `
        --silent
} -ArgumentList $TENDERLY_RPC, $ANVIL_PORT, $CHAIN_ID

Write-Host "  Waiting for Anvil to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Quick health check
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ANVIL_PORT" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
    Write-Host "  ✅ Anvil running — block: $($health.result)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Anvil health check failed — check if port $ANVIL_PORT is in use" -ForegroundColor Red
    Stop-Job $anvilJob
    exit 1
}

# ─── Step 2: Deploy Safe (or use existing SAFE_ADDRESS) ───────────────────────
Write-Host ""
Write-Host "[2/4] Safe Smart Account..." -ForegroundColor Yellow

if ($SAFE_ADDR -and $SAFE_ADDR -ne "0x0000000000000000000000000000000000000000") {
    Write-Host "  ✅ Using existing SAFE_ADDRESS: $SAFE_ADDR" -ForegroundColor Green
    Write-Host "     (already deployed on Tenderly fork — inherited by Anvil)"
} else {
    Write-Host "  🚀 No SAFE_ADDRESS found — deploying new Safe to Anvil..."
    Write-Host ""
    $env:TENDERLY_RPC_URL = "http://127.0.0.1:$ANVIL_PORT"
    $env:BUNDLER_RPC_URL = "http://localhost:$BUNDLER_PORT"
    & pnpm ts-node scripts/v5_setup_safe.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Safe deployment failed" -ForegroundColor Red
        Stop-Job $anvilJob
        exit 1
    }
    Write-Host ""
    Write-Host "  ⚠️  Add the SAFE_ADDRESS printed above to your .env, then re-run." -ForegroundColor Yellow
    Stop-Job $anvilJob
    exit 0
}

# ─── Step 3: Start Alto Bundler against Anvil ─────────────────────────────────
Write-Host ""
Write-Host "[3/4] Starting Alto ERC-4337 bundler against Anvil..." -ForegroundColor Yellow

$altoJob = Start-Job -ScriptBlock {
    param($rpc, $port, $pk, $ep)
    & docker run --rm --network host `
        -e TENDERLY_RPC_URL=$rpc `
        -e PRIVATE_KEY=$pk `
        node:20-alpine `
        sh -c "npx --yes @pimlico/alto@latest -e $ep -r $rpc -x $pk --port $port --rpc-gas-estimate"
} -ArgumentList "http://127.0.0.1:$ANVIL_PORT", $BUNDLER_PORT, $PRIVATE_KEY, "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

Write-Host "  Waiting for bundler to start (installing alto deps ~15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 20

Write-Host "  ✅ Alto bundler should be ready on port $BUNDLER_PORT" -ForegroundColor Green

# ─── Step 4: Run E2E Mock ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Running V5 E2E mock..." -ForegroundColor Yellow
Write-Host "      (requestAudit UserOp → mock oracle → triggerSwap UserOp)"
Write-Host "      Phase 6: Replace mock oracle with real Chainlink CRE DON"
Write-Host ""

$env:ANVIL_RPC_URL    = "http://127.0.0.1:$ANVIL_PORT"
$env:BUNDLER_RPC_URL  = "http://localhost:$BUNDLER_PORT"
$env:TENDERLY_RPC_URL = "http://127.0.0.1:$ANVIL_PORT"

& pnpm ts-node scripts/v5_e2e_mock.ts
$exitCode = $LASTEXITCODE

# ─── Cleanup ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Cleaning up background processes..." -ForegroundColor Gray
Stop-Job $anvilJob -ErrorAction SilentlyContinue
Stop-Job $altoJob  -ErrorAction SilentlyContinue
Remove-Job $anvilJob, $altoJob -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ Phase 5a COMPLETE — V5 AA plumbing verified end-to-end!" -ForegroundColor Green
    Write-Host "  Next: Spin up new Tenderly VNet for Phase 5b (real swap test)" -ForegroundColor Green
    Write-Host "        then Phase 6: wire real Chainlink CRE DON via onReport()" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  ❌ E2E failed (exit code $exitCode)" -ForegroundColor Red
    Write-Host "  Check output above for the debug loop." -ForegroundColor Red
}
exit $exitCode
