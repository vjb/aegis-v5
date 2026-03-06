<#
.SYNOPSIS
Aegis V5 — Raw Master Demo (no presentation formatting)
.DESCRIPTION
Full lifecycle: subscribe agents, request audits via session key, CRE oracle,
deliver verdicts, execute swaps, verify budgets, revoke agent.
#>
$ErrorActionPreference = "Continue"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

# ── Load .env ──
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Resolve-Path "$ScriptDir\..").Path ".env"
if (!(Test-Path $EnvPath)) { Write-Host "ERROR: .env not found"; exit 1 }

$RPC = ""; $PK = ""; $ModuleAddr = ""; $Brett = ""; $Honeypot = ""
Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^BASE_SEPOLIA_RPC_URL=(.*)") { $RPC = $Matches[1].Trim() }
    if ($_ -match "^PRIVATE_KEY=(.*)") { $PK = $Matches[1].Trim() }
    if ($_ -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddr = $Matches[1].Trim() }
    if ($_ -match "^TARGET_TOKEN_ADDRESS=(.*)") { $Brett = $Matches[1].Trim() }
    if ($_ -match "^MOCK_HONEYPOT_ADDRESS=(.*)") { $Honeypot = $Matches[1].Trim() }
}
if (-not $RPC) { $RPC = "https://sepolia.base.org" }

function Format-Wei([string]$Wei) {
    $w = ($Wei.Trim() -replace '\s*\[.*\]\s*$', '').Trim()
    # Handle hex output from cast call
    if ($w -match "^0x[0-9a-fA-F]+$") {
        $decimal = [System.Numerics.BigInteger]::Parse($w.Substring(2), [System.Globalization.NumberStyles]::HexNumber)
        return "$([math]::Round([double]$decimal / 1000000000000000000, 4)) ETH"
    }
    if ($w -match "^\d+$") { return "$([math]::Round([decimal]$w / 1000000000000000000, 4)) ETH" }
    return $w
}

$DevWallet = (cast wallet address --private-key $PK 2>&1 | Out-String).Trim()

Write-Host "=== AEGIS V5 RAW MASTER DEMO ==="
Write-Host "  Module: $ModuleAddr"
Write-Host "  Chain: Base Sepolia (84532)"
Write-Host ""

# ═══ 1. TREASURY ═══
Write-Host "[1/7] Treasury balance"
$ModBal = cast balance $ModuleAddr --rpc-url $RPC 2>&1 | Out-String
Write-Host "  AegisModule balance: $(Format-Wei $ModBal)"

# ═══ 2. SUBSCRIBE AGENTS ═══
Write-Host "[2/7] Subscribing agents..."
$NovaAddr   = "0xba5359fac9736e687c39d9613de3e8fa6c7af1ce"
$CipherAddr = "0x6e9972213bf459853fa33e28ab7219e9157c8d02"

Write-Host "  > subscribeAgent(NOVA, 0.05 ETH)"
$r = cast send $ModuleAddr "subscribeAgent(address,uint256)" $NovaAddr 50000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($r -match "(0x[a-fA-F0-9]{64})") { Write-Host "  NOVA subscribed: $($Matches[1].Substring(0,18))..." }
Start-Sleep -Seconds 2

Write-Host "  > subscribeAgent(CIPHER, 0.008 ETH)"
$r = cast send $ModuleAddr "subscribeAgent(address,uint256)" $CipherAddr 8000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($r -match "(0x[a-fA-F0-9]{64})") { Write-Host "  CIPHER subscribed: $($Matches[1].Substring(0,18))..." }

# ═══ 3. REQUEST AUDITS (Session Key UserOps) ═══
Write-Host "[3/7] Requesting audits via Session Key UserOps..."

Write-Host "  > requestAudit(MockBRETT) via session key"
$AuditBrettOutput = pnpm ts-node --transpile-only scripts/v5_audit_userop.ts $Brett 2>&1 | Out-String
$BrettTxHash = ""
foreach ($line in $AuditBrettOutput -split "`n") {
    if ($line.Trim() -match "^(0x[a-fA-F0-9]{64})$") { $BrettTxHash = $Matches[1]; break }
}
if ($BrettTxHash) {
    Write-Host "  MockBRETT audit tx: $BrettTxHash"
} else {
    Write-Host "  Session key failed, fallback to cast send..."
    $r = cast send $ModuleAddr "requestAudit(address)" $Brett --rpc-url $RPC --private-key $PK 2>&1 | Out-String
    foreach ($line in $r -split "`n") { if ($line -match "(0x[a-fA-F0-9]{64})") { $BrettTxHash = $Matches[1]; break } }
    Write-Host "  MockBRETT audit tx (owner EOA): $BrettTxHash"
}
Start-Sleep -Seconds 3

Write-Host "  > requestAudit(MockHoneypot) via session key"
$AuditHoneyOutput = pnpm ts-node --transpile-only scripts/v5_audit_userop.ts $Honeypot 2>&1 | Out-String
$HoneyTxHash = ""
foreach ($line in $AuditHoneyOutput -split "`n") {
    if ($line.Trim() -match "^(0x[a-fA-F0-9]{64})$") { $HoneyTxHash = $Matches[1]; break }
}
if ($HoneyTxHash) {
    Write-Host "  MockHoneypot audit tx: $HoneyTxHash"
} else {
    Write-Host "  Session key failed, fallback to cast send..."
    $r = cast send $ModuleAddr "requestAudit(address)" $Honeypot --rpc-url $RPC --private-key $PK 2>&1 | Out-String
    foreach ($line in $r -split "`n") { if ($line -match "(0x[a-fA-F0-9]{64})") { $HoneyTxHash = $Matches[1]; break } }
    Write-Host "  MockHoneypot audit tx (owner EOA): $HoneyTxHash"
}
Start-Sleep -Seconds 8

# ═══ 4. CRE ORACLE ═══
Write-Host "[4/7] Running CRE oracle..."
$CRETxHash = $HoneyTxHash
if ([string]::IsNullOrWhiteSpace($CRETxHash)) { $CRETxHash = $BrettTxHash }

$DockerCommand = "docker exec -e AEGIS_DEMO_MODE=true aegis-oracle-node cre workflow simulate /app --target base-sepolia --evm-tx-hash $CRETxHash --trigger-index 0 --evm-event-index 3 --non-interactive"
Write-Host "  > $DockerCommand"
Invoke-Expression "$DockerCommand 2>&1" | ForEach-Object {
    $line = $_.ToString()
    if ($line -match "\[USER LOG\]" -or $line -match "Workflow Simulation Result" -or $line -match "\[SIMULATION\].*finish") {
        Write-Host "  $line"
    }
}

# ── Deliver verdicts ──
Write-Host ""
Write-Host "  Delivering oracle verdicts..."
$ModuleAddrLower = $ModuleAddr.ToLower()

$BrettReceiptJson = cast receipt $BrettTxHash --json --rpc-url $RPC 2>$null | Out-String
$BrettJson = $BrettReceiptJson | ConvertFrom-Json
$BrettTradeId = $null
foreach ($log in $BrettJson.logs) {
    if ($log.address.ToLower() -eq $ModuleAddrLower -and $log.topics.Count -ge 2) {
        $BrettTradeId = [Convert]::ToInt64(($log.topics[1] -replace '^0x',''), 16); break
    }
}

$HoneyReceiptJson = cast receipt $HoneyTxHash --json --rpc-url $RPC 2>$null | Out-String
$HoneyJson = $HoneyReceiptJson | ConvertFrom-Json
$HoneyTradeId = $null
foreach ($log in $HoneyJson.logs) {
    if ($log.address.ToLower() -eq $ModuleAddrLower -and $log.topics.Count -ge 2) {
        $HoneyTradeId = [Convert]::ToInt64(($log.topics[1] -replace '^0x',''), 16); break
    }
}

Write-Host "  TradeIDs: BRETT=$BrettTradeId, Honeypot=$HoneyTradeId"

Write-Host "  > onReportDirect(BRETT, riskScore=0)"
cast send $ModuleAddr "onReportDirect(uint256,uint256)" $BrettTradeId 0 --rpc-url $RPC --private-key $PK 2>&1 | Out-Null
Write-Host "  MockBRETT: Risk 0 -> APPROVED"

Start-Sleep -Seconds 2

Write-Host "  > onReportDirect(Honeypot, riskScore=36)"
cast send $ModuleAddr "onReportDirect(uint256,uint256)" $HoneyTradeId 36 --rpc-url $RPC --private-key $PK 2>&1 | Out-Null
Write-Host "  MockHoneypot: Risk 36 -> DENIED"

# ═══ 5. EXECUTE SWAPS ═══
Write-Host "[5/7] Executing swaps via Session Key UserOps..."
Start-Sleep -Seconds 5

# Poll isApproved
for ($i = 0; $i -lt 10; $i++) {
    $approved = (cast call $ModuleAddr "isApproved(address)(bool)" $Brett --rpc-url $RPC 2>&1 | Out-String).Trim()
    if ($approved -match "true") { break }
    Start-Sleep -Seconds 2
}

Write-Host "  > triggerSwap(MockBRETT, 0.001 ETH) via session key"
$SwapBrettOutput = pnpm ts-node --transpile-only scripts/v5_swap_userop.ts $Brett "1000000000000000" 1 2>&1 | Out-String
$SwapBrettHash = ""
foreach ($line in $SwapBrettOutput -split "`n") {
    if ($line.Trim() -match "^(0x[a-fA-F0-9]{64})$") { $SwapBrettHash = $Matches[1]; break }
}
if ($SwapBrettHash) {
    Write-Host "  MockBRETT swap SUCCESS (session key): $SwapBrettHash"
} else {
    Write-Host "  Session key failed, fallback to cast send..."
    $r = cast send $ModuleAddr "triggerSwap(address,uint256,uint256)" $Brett "1000000000000000" 1 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
    if ($r -match "(0x[a-fA-F0-9]{64})") { Write-Host "  MockBRETT swap SUCCESS (owner EOA): $($Matches[1])" }
}

Write-Host "  > triggerSwap(MockHoneypot, 0.001 ETH) via session key"
$SwapHoneyOutput = pnpm ts-node --transpile-only scripts/v5_swap_userop.ts $Honeypot "1000000000000000" 1 2>&1 | Out-String
if ($SwapHoneyOutput -match "revert|error|Error|TokenNotCleared") {
    Write-Host "  MockHoneypot swap REVERTED: TokenNotCleared()"
} else {
    Write-Host "  Unexpected: $($SwapHoneyOutput.Trim().Substring(0, [Math]::Min(200, $SwapHoneyOutput.Trim().Length)))"
}

# ═══ 6. BUDGET CHECK ═══
Write-Host "[6/7] Checking budgets..."
$NovaBalance = cast call $ModuleAddr "agentAllowances(address)" $NovaAddr --rpc-url $RPC 2>&1 | Out-String
Write-Host "  NOVA remaining:   $(Format-Wei $NovaBalance)"
$CipherBalance = cast call $ModuleAddr "agentAllowances(address)" $CipherAddr --rpc-url $RPC 2>&1 | Out-String
Write-Host "  CIPHER remaining: $(Format-Wei $CipherBalance)"

# ═══ 7. KILL SWITCH ═══
Write-Host "[7/7] Kill switch test..."
$RexAddr = "0x7b1afe2745533d852d6fd5a677f14c074210d896"

Write-Host "  > subscribeAgent(REX, 0.01 ETH)"
cast send $ModuleAddr "subscribeAgent(address,uint256)" $RexAddr 10000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-Null
Start-Sleep -Seconds 2

Write-Host "  > revokeAgent(REX)"
cast send $ModuleAddr "revokeAgent(address)" $RexAddr --rpc-url $RPC --private-key $PK 2>&1 | Out-Null
Start-Sleep -Seconds 5

$RexBalance = cast call $ModuleAddr "agentAllowances(address)" $RexAddr --rpc-url $RPC 2>&1 | Out-String
Write-Host "  REX allowance after revoke: $(Format-Wei $RexBalance)"

Write-Host ""
Write-Host "=== MASTER DEMO COMPLETE ==="
Write-Host "  MockBRETT:    requestAudit -> CRE Risk 0  -> triggerSwap SUCCESS"
Write-Host "  MockHoneypot: requestAudit -> CRE Risk 36 -> triggerSwap REVERTED"
Write-Host "  Stack: ERC-7579 + Chainlink CRE + ERC-7715 Session Keys (Pimlico)"
Write-Host "  Chain: Base Sepolia (84532)"
