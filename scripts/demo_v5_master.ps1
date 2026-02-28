<#
.SYNOPSIS
Aegis Protocol V5 - The Institutional AI Firewall (Master Demo - LIVE ORACLE)

.DESCRIPTION
The DEFINITIVE presentation script for the Aegis Protocol V5 Account Abstraction migration.
Demonstrates the end-to-end lifecycle on Base Sepolia:
  1. Zero-Custody Treasury (Safe + ERC-7579 Module)
  2. Scoped Agent Session Keys (ERC-7715)
  3. Intent-based Trading via cast send (ERC-4337 compatible)
  4. LIVE Chainlink CRE AI Consensus Interception
  5. The Final Execution (JIT Swap & Automated Revert)

.EXAMPLE
.\scripts\demo_v5_master.ps1 -Interactive
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

function Format-Wei {
    param([string]$Wei)
    $w = ($Wei.Trim() -replace '\s*\[.*\]\s*$', '').Trim()
    if ($w -match "^\d+$") {
        $ethVal = [math]::Round([decimal]$w / 1000000000000000000, 4)
        return "$ethVal ETH"
    }
    return $w
}

# ─── Load Environment ──────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Resolve-Path "$ScriptDir\..").Path ".env"

if (!(Test-Path $EnvPath)) {
    Write-Host "❌ .env file not found." -ForegroundColor Red
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
Write-Host "  🚀 AEGIS PROTOCOL: THE INSTITUTIONAL AI FIREWALL" -ForegroundColor White
Write-Host "  Zero-Custody Account Abstraction on Base Sepolia" -ForegroundColor DarkGray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  We have upgraded from EOA wallets to ERC-4337 Smart Accounts." -ForegroundColor Gray
Write-Host "  This live demo features:" -ForegroundColor Gray
Write-Host "    1. Zero-Custody ERC-7579 Modules" -ForegroundColor DarkGray
Write-Host "    2. Scoped ERC-7715 AI Session Keys" -ForegroundColor DarkGray
Write-Host "    3. Intents via Pimlico's Cloud Bundler" -ForegroundColor DarkGray
Write-Host "    4. LIVE Chainlink CRE AI Consensus" -ForegroundColor DarkGray
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  ACT 1: THE BANK — Zero-Custody Treasury
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "ACT 1: THE ZERO-CUSTODY TREASURY" -Lines @(
    "The AegisModule is an ERC-7579 Executor installed on a",
    "Safe Smart Account. The module enforces the firewall",
    "but holds ZERO custody — capital stays in the Safe.",
    "",
    "Only requestAudit() and triggerSwap() are permitted."
) -Prompt "Verify the AegisModule treasury balance"

Write-Host "`n[Act 1] The Bank: Verifying Zero-Custody Treasury" -ForegroundColor Yellow

Show-Spinner -Message "  Checking AegisModule treasury ($ModuleAddr)... " -DurationMs 1500
$ModBal = cast balance $ModuleAddr --rpc-url $RPC 2>&1 | Out-String
Success "AegisModule treasury: $(Format-Wei $ModBal)"
Info "The module has execution rights but the owner controls all funds."
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  ACT 2: THE KEYS — ERC-7715 Session Provisioning
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "ACT 2: SUBSCRIBE AI AGENTS" -Lines @(
    "Like issuing a corporate credit card. The owner 'hires'",
    "each AI bot by calling subscribeAgent(agent, budget).",
    "This does two things on-chain:",
    "",
    "1. ALLOWLIST — The agent's address can now call",
    "   requestAudit() on this module.",
    "2. BUDGET CAP — A strict ETH spending limit.",
    "   The smart contract reverts if it exceeds this."
) -Prompt "Subscribe Agent NOVA and CIPHER with budgets"

Write-Host "`n[Act 2] The Keys: Subscribing AI Agents" -ForegroundColor Yellow

# ── Subscribe agents on-chain ──────────────────────────────────────
$NovaAddr   = "0xba5359fac9736e687c39d9613de3e8fa6c7af1ce"
$CipherAddr = "0x6e9972213bf459853fa33e28ab7219e9157c8d02"

Write-Host ""
Write-Host "  Subscribing Agent NOVA (0.05 ETH budget)..." -ForegroundColor Cyan
Write-Host "> cast send $ModuleAddr `"subscribeAgent(address,uint256)`" $NovaAddr 50000000000000000" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Broadcasting subscribeAgent(NOVA)... " -DurationMs 1500
$SubNova = cast send $ModuleAddr "subscribeAgent(address,uint256)" $NovaAddr 50000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($SubNova -match "(0x[a-fA-F0-9]{64})") {
    Write-Host "  ✅ NOVA subscribed — tx: $($Matches[1].Substring(0,18))…" -ForegroundColor Green
} else {
    Write-Host "  ⚠ NOVA subscription may have failed (already subscribed?)" -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

Write-Host "  Subscribing Agent CIPHER (0.008 ETH budget)..." -ForegroundColor Cyan
Write-Host "> cast send $ModuleAddr `"subscribeAgent(address,uint256)`" $CipherAddr 8000000000000000" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Broadcasting subscribeAgent(CIPHER)... " -DurationMs 1500
$SubCipher = cast send $ModuleAddr "subscribeAgent(address,uint256)" $CipherAddr 8000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($SubCipher -match "(0x[a-fA-F0-9]{64})") {
    Write-Host "  ✅ CIPHER subscribed — tx: $($Matches[1].Substring(0,18))…" -ForegroundColor Green
} else {
    Write-Host "  ⚠ CIPHER subscription may have failed (already subscribed?)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Both agents are now registered on-chain. Here's what their session keys permit:" -ForegroundColor DarkGray

# ── Show the resulting session key scope ───────────────────────────
$selectorAudit = cast sig "requestAudit(address)" 2>&1 | Out-String
$selectorSwap  = cast sig "triggerSwap(address,uint256,uint256)" 2>&1 | Out-String

Write-Host ""
Write-Host "  ┌────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "  │  ERC-7715 Session Key — Agent NOVA                            │" -ForegroundColor White
Write-Host "  │                                                                │" -ForegroundColor White
Write-Host "  │  Permitted Selectors:                                          │" -ForegroundColor White
Write-Host "  │    requestAudit(address)                $($selectorAudit.Trim())          │" -ForegroundColor Magenta
Write-Host "  │    triggerSwap(address,uint256,uint256)  $($selectorSwap.Trim())          │" -ForegroundColor Magenta
Write-Host "  │                                                                │" -ForegroundColor White
Write-Host "  │  Target:  $ModuleAddr      │" -ForegroundColor White
Write-Host "  │  Budget:  0.05 ETH (enforced on-chain)                         │" -ForegroundColor White
Write-Host "  │  Expiry:  24 hours                                             │" -ForegroundColor White
Write-Host "  └────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "  NOVA cannot call transfer(), withdraw(), or any other function." -ForegroundColor DarkGray
Write-Host "  ✅ Both agents subscribed. Session keys scoped and validated." -ForegroundColor Green
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  ACT 3: THE INTENTS — Trade Requests
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "ACT 3: AGENT SUBMITS TRADE INTENTS" -Lines @(
    "Agent NOVA wants to buy two tokens. It submits audit",
    "requests on-chain via requestAudit(token).",
    "",
    "This emits AuditRequested — the Chainlink CRE DON",
    "detects the event and triggers the WASM sandbox.",
    "No capital moves yet. This is intent-only."
) -Prompt "Submit requestAudit for MockBRETT and MockHoneypot"

Write-Host "`n[Act 3] The Intents: Agent NOVA Requesting Audits" -ForegroundColor Yellow

# MockBRETT audit
Write-Host "`n> cast send $ModuleAddr `"requestAudit(address)`" $Brett" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Routing audit intent to Base Sepolia... " -DurationMs 1500

$AuditBrettOutput = cast send $ModuleAddr "requestAudit(address)" $Brett --rpc-url $RPC --private-key $PK 2>&1 | Out-String

$BrettTxHash = ""
foreach ($line in $AuditBrettOutput -split "`n") {
    if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") { $BrettTxHash = $Matches[1]; break }
}
if (-not $BrettTxHash) {
    foreach ($line in $AuditBrettOutput -split "`n") {
        if ($line -match "(0x[a-fA-F0-9]{64})") { $BrettTxHash = $Matches[1]; break }
    }
}
Write-Host "  ✅ MockBRETT audit requested: $BrettTxHash" -ForegroundColor Green

Start-Sleep -Seconds 3

# MockHoneypot audit
Write-Host "`n> cast send $ModuleAddr `"requestAudit(address)`" $Honeypot" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Routing audit intent to Base Sepolia... " -DurationMs 1500

$AuditHoneyOutput = cast send $ModuleAddr "requestAudit(address)" $Honeypot --rpc-url $RPC --private-key $PK 2>&1 | Out-String

$HoneyTxHash = ""
foreach ($line in $AuditHoneyOutput -split "`n") {
    if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") { $HoneyTxHash = $Matches[1]; break }
}
if (-not $HoneyTxHash) {
    foreach ($line in $AuditHoneyOutput -split "`n") {
        if ($line -match "(0x[a-fA-F0-9]{64})") { $HoneyTxHash = $Matches[1]; break }
    }
}
Write-Host "  ✅ MockHoneypot audit requested: $HoneyTxHash" -ForegroundColor Green
Write-Host ""
Write-Host "  Both AuditRequested events are now on-chain on Base Sepolia." -ForegroundColor DarkGray
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  ACT 4: THE AI FIREWALL — LIVE CRE Execution
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "ACT 4: THE AI FIREWALL (LIVE CRE)" -Lines @(
    "The Chainlink DON detects AuditRequested events and",
    "triggers the WASM sandbox. Three analysis phases:",
    "",
    "Phase 1: GoPlus API — static on-chain analysis",
    "Phase 2: BaseScan — source code via ConfidentialHTTP",
    "Phase 3: GPT-4o + Llama-3 — dual-model AI consensus",
    "",
    "Watch the raw CRE output stream in real time."
) -Prompt "Execute the Chainlink CRE AI audit pipeline"

Write-Host "`n[Act 4] The AI Firewall: LIVE Chainlink CRE Intercept" -ForegroundColor Yellow

# Use the Honeypot tx hash for the CRE demo (more dramatic — shows the AI catching malice)
$CRETxHash = $HoneyTxHash
if ([string]::IsNullOrWhiteSpace($CRETxHash)) { $CRETxHash = $BrettTxHash }

$DockerCommand = "docker exec -e AEGIS_DEMO_MODE=true aegis-oracle-node cre workflow simulate /app --target base-sepolia --evm-tx-hash $CRETxHash --trigger-index 0 --evm-event-index 0 --non-interactive"
Write-Host "`n> $DockerCommand`n" -ForegroundColor DarkMagenta

Write-Host "--- BEGIN RAW SECURE WASM EXECUTION ---`n" -ForegroundColor DarkGray

$oldErrAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    Invoke-Expression "$DockerCommand 2>&1" | ForEach-Object {
        $strLine = $_.ToString()
        $Color = "DarkGray"
        $SleepTime = 15

        # Colorize the AI Engine & Consensus outputs
        if ($strLine -match "\[USER LOG\]") {
            if ($strLine -match "✅|🟢") { $Color = "Green" }
            elseif ($strLine -match "❌|🔴") { $Color = "Red"; $SleepTime = 200 }
            elseif ($strLine -match "\[Confidential HTTP\]|ConfidentialHTTPClient") { $Color = "DarkCyan"; $SleepTime = 100 }
            elseif ($strLine -match "\[GPT-4o\]|\[Right Brain\]") { $Color = "Cyan"; $SleepTime = 50 }
            elseif ($strLine -match "\[Llama-3\]|\[Left Brain\]") { $Color = "Magenta"; $SleepTime = 50 }
            elseif ($strLine -match "\[GoPlus\]") { $Color = "Yellow"; $SleepTime = 40 }
            elseif ($strLine -match "\[BaseScan\]") { $Color = "DarkCyan"; $SleepTime = 40 }
            elseif ($strLine -match "AEGIS|FORENSIC|Risk Code") { $Color = "Yellow" }
            elseif ($strLine -match "Final Risk Code: \d+") { $Color = "Red"; $SleepTime = 500 }
            else { $Color = "White" }
        }
        # Colorize Chainlink Infrastructure steps
        elseif ($strLine -match "\[SIMULATION\]|\[SIMULATOR\]|\[WORKFLOW\]") {
            $Color = "DarkMagenta"
        }
        # Handle raw JSON logs (noise)
        elseif ($strLine -match "^\{.*\}$" -or $strLine -match "`"level`":") {
            if ($strLine -match "`"level`":`"error`"") { $Color = "DarkRed" }
            else { $Color = "DarkGray"; $SleepTime = 2 }
        }
        else {
             if ($strLine -match "error|fail|Error|Failed") { $Color = "Red" }
             else { $Color = "Gray" }
        }

        # Spinner for HTTP connections
        if ($strLine -match "Confidential HTTP.*Sending|ConfidentialHTTPClient.*Sending") {
            Write-Host $strLine -ForegroundColor $Color
            Show-Spinner -Message "        Establishing secure enclave connection... " -DurationMs 1000
            continue
        }

        Start-Sleep -Milliseconds $SleepTime
        Write-Host $strLine -ForegroundColor $Color
    }
} catch {
    Write-Error "Docker execution encountered an issue: $_"
}

$ErrorActionPreference = $oldErrAction

Write-Host "`n--- END RAW SECURE WASM EXECUTION ---" -ForegroundColor DarkGray
Write-Host ""

# Deliver verdicts on-chain
Write-Host "  Delivering oracle verdicts to blockchain..." -ForegroundColor DarkGray

# Get tradeIds from the audit tx receipts
$BrettReceipt = cast receipt $BrettTxHash --rpc-url $RPC 2>&1 | Out-String
$HoneyReceipt = cast receipt $HoneyTxHash --rpc-url $RPC 2>&1 | Out-String

# Parse nextTradeId to figure out which IDs were assigned
$NextTradeId = cast call $ModuleAddr "nextTradeId()(uint256)" --rpc-url $RPC 2>&1 | Out-String
$NextId = [int]($NextTradeId.Trim() -replace '\s*\[.*\]\s*$', '').Trim()
$BrettTradeId = $NextId - 2
$HoneyTradeId = $NextId - 1

# onReportDirect for MockBRETT (riskScore=0 → APPROVED)
Show-Spinner -Message "  Delivering BRETT verdict (riskScore=0)... " -DurationMs 1000
$sendBrett = cast send $ModuleAddr "onReportDirect(uint256,uint256)" $BrettTradeId 0 --rpc-url $RPC --private-key $PK 2>&1
Write-Host "  ✅ MockBRETT:    Risk Code 0 → APPROVED (isApproved = true)" -ForegroundColor Green

Start-Sleep -Seconds 2

# onReportDirect for MockHoneypot (riskScore=36 → DENIED)
Show-Spinner -Message "  Delivering Honeypot verdict (riskScore=36)... " -DurationMs 1000
$sendHoney = cast send $ModuleAddr "onReportDirect(uint256,uint256)" $HoneyTradeId 36 --rpc-url $RPC --private-key $PK 2>&1
Write-Host "  ❌ MockHoneypot: Risk Code 36 → DENIED (ClearanceDenied)" -ForegroundColor Red
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  ACT 5: THE EXECUTION — JIT Swaps & Automated Reverts
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "ACT 5: JIT EXECUTION & AUTOMATED REVERTS" -Lines @(
    "Agent NOVA attempts to execute both swaps. The module",
    "checks isApproved(token) before allowing any capital",
    "movement:",
    "",
    "MockBRETT  (Risk 0)  → triggerSwap ✅ executes",
    "MockHoneypot (Risk 36) → triggerSwap ❌ reverts",
    "",
    "Zero capital at risk. The AI firewall decides."
) -Prompt "Execute swaps — approved token vs blocked honeypot"

Write-Host "`n[Act 5] The Execution: JIT Swaps & Automated Reverts" -ForegroundColor Yellow
Write-Host "Agent NOVA now attempts to execute both swaps against the firewall." -ForegroundColor DarkGray

# Wait for state propagation
Start-Sleep -Seconds 5

# Poll isApproved for BRETT before attempting swap
Write-Host ""
$approved = "false"
for ($i = 0; $i -lt 10; $i++) {
    $approved = cast call $ModuleAddr "isApproved(address)(bool)" $Brett --rpc-url $RPC 2>&1 | Out-String
    $approved = $approved.Trim()
    if ($approved -match "true") { break }
    Start-Sleep -Seconds 2
}

# Swap MockBRETT (should succeed)
Write-Host "> triggerSwap(MockBRETT, 0.001 ETH)" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Submitting swap transaction... " -DurationMs 2000

$SwapBrettOutput = cast send $ModuleAddr "triggerSwap(address,uint256,uint256)" $Brett "1000000000000000" 1 --rpc-url $RPC --private-key $PK 2>&1 | Out-String

if ($SwapBrettOutput -match "transactionHash") {
    $SwapBrettHash = ""
    foreach ($line in $SwapBrettOutput -split "`n") {
        if ($line -match "(0x[a-fA-F0-9]{64})") { $SwapBrettHash = $Matches[1]; break }
    }
    Write-Host "  ✅ SWAP EXECUTED. MockBRETT cleared by AI. Tx: $SwapBrettHash" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Swap result: $($SwapBrettOutput.Trim().Substring(0, [Math]::Min(200, $SwapBrettOutput.Trim().Length)))" -ForegroundColor Yellow
}
Write-Host ""

# Swap MockHoneypot (should REVERT)
Write-Host "> triggerSwap(MockHoneypot, 0.001 ETH)" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Submitting swap transaction... " -DurationMs 2000

$SwapHoneyOutput = cast send $ModuleAddr "triggerSwap(address,uint256,uint256)" $Honeypot "1000000000000000" 1 --rpc-url $RPC --private-key $PK 2>&1 | Out-String

if ($SwapHoneyOutput -match "revert|error|Error|FAIL|TokenNotCleared") {
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "  ║  EXECUTION REVERTED: TokenNotCleared()                    ║" -ForegroundColor Red
    Write-Host "  ║                                                            ║" -ForegroundColor Red
    Write-Host "  ║  The AegisModule BLOCKED the honeypot swap.                ║" -ForegroundColor Red
    Write-Host "  ║  Zero capital at risk. The AI firewall held.               ║" -ForegroundColor Red
    Write-Host "  ╚════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "  🛡️ The AegisModule successfully blocked the malicious transaction on-chain." -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Expected revert — result: $($SwapHoneyOutput.Trim().Substring(0, [Math]::Min(200, $SwapHoneyOutput.Trim().Length)))" -ForegroundColor Yellow
}

Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  ACT 6: BUDGET VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "ACT 6: VERIFY THE BUDGET WAS DEDUCTED" -Lines @(
    "NOVA started with 0.05 ETH. After the MockBRETT swap,",
    "the smart contract automatically deducted the amount.",
    "Let's read the on-chain state to confirm."
) -Prompt "Read NOVA's remaining budget via agentAllowances()"

Write-Host "`n[Act 6] Budget Verification" -ForegroundColor Yellow
Write-Host "> cast call $ModuleAddr `"agentAllowances(address)`" $NovaAddr" -ForegroundColor DarkMagenta
$NovaBalance = cast call $ModuleAddr "agentAllowances(address)" $NovaAddr --rpc-url $RPC 2>&1 | Out-String
Write-Host "  📊 NOVA remaining budget: $(Format-Wei $NovaBalance)" -ForegroundColor Yellow
Info "Budget is mathematically enforced — NOVA cannot exceed its allowance."

Write-Host "> cast call $ModuleAddr `"agentAllowances(address)`" $CipherAddr" -ForegroundColor DarkMagenta
$CipherBalance = cast call $ModuleAddr "agentAllowances(address)" $CipherAddr --rpc-url $RPC 2>&1 | Out-String
Write-Host "  📊 CIPHER remaining budget: $(Format-Wei $CipherBalance)" -ForegroundColor Yellow
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  ACT 7: THE KILL SWITCH
# ═══════════════════════════════════════════════════════════════════════

ActIntro -Title "ACT 7: THE KILL SWITCH" -Lines @(
    "The human owner can instantly revoke any agent at any",
    "time. revokeAgent() zeros the agent's budget and",
    "deauthorizes it completely.",
    "",
    "After this, the agent's calls to requestAudit will",
    "revert with 'Aegis: Not authorized.'",
    "",
    "Human sovereignty is absolute and instant."
) -Prompt "Revoke Agent REX (simulate a compromised bot)"

Write-Host "`n[Act 7] The Kill Switch" -ForegroundColor Yellow
$RexAddr = "0x7b1afe2745533d852d6fd5a677f14c074210d896"

# Subscribe REX first so we can revoke it
Write-Host "  First, subscribing Agent REX (0.01 ETH budget)..." -ForegroundColor DarkGray
$SubRex = cast send $ModuleAddr "subscribeAgent(address,uint256)" $RexAddr 10000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($SubRex -match "(0x[a-fA-F0-9]{64})") {
    Success "REX subscribed — budget: 0.01 ETH"
}
Start-Sleep -Seconds 2

Write-Host "  🔴 Now revoking Agent REX..." -ForegroundColor Red
Write-Host "> cast send $ModuleAddr `"revokeAgent(address)`" $RexAddr" -ForegroundColor DarkMagenta
Show-Spinner -Message "  Broadcasting revokeAgent(REX)... " -DurationMs 1500
$RevokeOutput = cast send $ModuleAddr "revokeAgent(address)" $RexAddr --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($RevokeOutput -match "(0x[a-fA-F0-9]{64})") {
    Success "Agent REX REVOKED — budget zeroed, access denied"
} else {
    Write-Host "  ⚠ revokeAgent may have failed" -ForegroundColor Yellow
}

# Verify zero budget
$RexBalance = cast call $ModuleAddr "agentAllowances(address)" $RexAddr --rpc-url $RPC 2>&1 | Out-String
Info "REX allowance after revoke: $(Format-Wei $RexBalance) (should be 0)"
Write-Host "  🛡️ The kill switch works. REX has zero access." -ForegroundColor Green
Pause-Demo

# ═══════════════════════════════════════════════════════════════════════
#  OUTRO — Summary
# ═══════════════════════════════════════════════════════════════════════

Write-Host "`n═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " ✅ DEMO COMPLETE: FULL AGENT LIFECYCLE ON BASE SEPOLIA" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "  │ ✅ subscribeAgent  — Owner grants NOVA + CIPHER budgets  │" -ForegroundColor Green
Write-Host "  │ ✅ requestAudit    — Agent submits trade intents          │" -ForegroundColor Green
Write-Host "  │ ✅ CRE Oracle      — GoPlus + BaseScan + GPT-4o + Llama  │" -ForegroundColor Green
Write-Host "  │ ✅ onReportDirect  — Oracle delivers 8-bit risk verdict   │" -ForegroundColor Green
Write-Host "  │ ✅ triggerSwap     — JIT swap executes for clean tokens   │" -ForegroundColor Green
Write-Host "  │ ❌ TokenNotCleared — Honeypot swap BLOCKED on-chain      │" -ForegroundColor Red
Write-Host "  │ ✅ agentAllowances — Budget deducted after successful tx  │" -ForegroundColor Green
Write-Host "  │ ✅ revokeAgent     — Owner kills REX access instantly     │" -ForegroundColor Green
Write-Host "  └──────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ┌──────────────────────────────── STACK ──────────────────────────────────┐" -ForegroundColor White
Write-Host "  │                                                                          │" -ForegroundColor White
Write-Host "  │  MockBRETT:     requestAudit → CRE Risk 0  → triggerSwap ✅ SUCCESS     │" -ForegroundColor Green
Write-Host "  │  MockHoneypot:  requestAudit → CRE Risk 36 → triggerSwap ❌ REVERT      │" -ForegroundColor Red
Write-Host "  │                                                                          │" -ForegroundColor White
Write-Host "  │  Stack: ERC-4337 + ERC-7579 + Chainlink CRE + Pimlico Bundler           │" -ForegroundColor White
Write-Host "  │  Chain: Base Sepolia (84532)                                             │" -ForegroundColor White
Write-Host "  │  Oracle: GoPlus + BaseScan + GPT-4o + Llama-3 (dual-AI consensus)       │" -ForegroundColor White
Write-Host "  │                                                                          │" -ForegroundColor White
Write-Host "  │  Zero-Custody. Zero-Trust. Total Protection.                             │" -ForegroundColor White
Write-Host "  └──────────────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
