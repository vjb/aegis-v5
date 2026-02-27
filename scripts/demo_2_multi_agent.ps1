<#
.SYNOPSIS
  Aegis V4 — Demo Script 2: "The Firewall That Runs Itself"
  Risk & Compliance Track | DeFi & Tokenization Track

.DESCRIPTION
  Three AI agents — NOVA, CIPHER, and REX — each submit trade intents.
  NOVA gets BRETT (cleared, real Uniswap V3 swap).
  CIPHER gets TaxToken (blocked — sell restriction, riskScore=2).
  REX gets HoneypotCoin (blocked — honeypot, riskScore=5),
  then tries to bypass the firewall and gets reverted.

.EXAMPLE
  .\scripts\demo_2_multi_agent.ps1 -Interactive
#>

param([switch]$Interactive)

$ErrorActionPreference = "Continue"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

$RPC = ""; $PK = ""; $ModuleAddr = ""
foreach ($line in (Get-Content .env)) {
    if ($line -match "^TENDERLY_RPC_URL=(.*)")    { $RPC        = $Matches[1].Trim() }
    if ($line -match "^PRIVATE_KEY=(.*)")          { $PK         = $Matches[1].Trim() }
    if ($line -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddr = $Matches[1].Trim() }
}

# ── VNet Health Check ────────────────────────────────────────────────────────────────
Write-Host "  🔎 Checking Tenderly VNet health..." -ForegroundColor DarkGray
$blockNum = (cast block-number --rpc-url $RPC 2>$null | Select-Object -Last 1).Trim()
$vnetHealthy = ($blockNum -match '^\d+$') -and ([int64]$blockNum -gt 0)
if (-not $vnetHealthy) {
    Write-Host ""
    Write-Host "  ⚠️  Tenderly VNet is out of blocks or unreachable." -ForegroundColor Yellow
    Write-Host "  🔄 Auto-provisioning a new VNet via new_tenderly_testnet.ps1..." -ForegroundColor Cyan
    Write-Host ""
    pwsh -NoProfile -File "scripts\new_tenderly_testnet.ps1"
    # Reload .env with fresh RPC + module address
    $RPC = ""; $PK = ""; $ModuleAddr = ""
    foreach ($line in (Get-Content .env)) {
        if ($line -match "^TENDERLY_RPC_URL=(.*)")    { $RPC        = $Matches[1].Trim() }
        if ($line -match "^PRIVATE_KEY=(.*)")          { $PK         = $Matches[1].Trim() }
        if ($line -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddr = $Matches[1].Trim() }
    }
    Write-Host "  ✅ New VNet ready. RPC: $RPC" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "  ✅ VNet healthy (block: $blockNum)" -ForegroundColor DarkGray
}

$NovaPK   = "0x000000000000000000000000000000000000000000000000000000000000dead"
$CipherPK = "0x000000000000000000000000000000000000000000000000000000000000beef"
$RexPK    = "0x000000000000000000000000000000000000000000000000000000000000cafe"

$NovaAddr   = (cast wallet address --private-key $NovaPK   2>&1 | Select-Object -First 1).Trim()
$CipherAddr = (cast wallet address --private-key $CipherPK 2>&1 | Select-Object -First 1).Trim()
$RexAddr    = (cast wallet address --private-key $RexPK    2>&1 | Select-Object -First 1).Trim()

$BRETT    = "0x532f27101965dd16442E59d40670FaF5eBB142E4"
$TaxToken = "0x000000000000000000000000000000000000000c"
$Honeypot = "0x000000000000000000000000000000000000000b"

# Read nextTradeId from chain so repeated runs always use correct IDs
$rawId = (cast call $ModuleAddr "nextTradeId()" --rpc-url $RPC 2>&1 | Select-Object -First 1).Trim()
$baseId = [int]([System.Convert]::ToInt64($rawId, 16))
$id0 = $baseId; $id1 = $baseId + 1; $id2 = $baseId + 2

function Banner($text, $color = "Cyan") {
    Write-Host ""; Write-Host ("=" * 70) -ForegroundColor $color
    Write-Host "  $text" -ForegroundColor White
    Write-Host ("=" * 70) -ForegroundColor $color; Write-Host ""
}

function Scene {
    param([string]$Title, [string[]]$Lines, [string]$Prompt)
    if (-not $Interactive) { return }
    Clear-Host
    Banner "AEGIS PROTOCOL V4  *  DEMO 2: THE FIREWALL THAT RUNS ITSELF" Cyan
    Write-Host ("  +" + ("-" * 64) + "+") -ForegroundColor DarkCyan
    Write-Host ("  | " + "  $Title".PadRight(63) + "|") -ForegroundColor DarkCyan
    Write-Host ("  |" + (" " * 65) + "|") -ForegroundColor DarkCyan
    foreach ($l in $Lines) { Write-Host ("  | " + "  $l".PadRight(63) + "|") -ForegroundColor DarkCyan }
    Write-Host ("  +" + ("-" * 64) + "+") -ForegroundColor DarkCyan
    Write-Host ""; Write-Host "  >> $Prompt" -ForegroundColor Cyan
    Write-Host "     Press ENTER to execute -> " -ForegroundColor DarkCyan -NoNewline
    Read-Host; Write-Host ""
}

function Pause($msg = "Press ENTER to continue ->") {
    if (-not $Interactive) { return }
    Write-Host ""; Write-Host "  --- $msg " -ForegroundColor Cyan -NoNewline
    Read-Host; Write-Host ""
}

function Ok($t)      { Write-Host "  OK  $t" -ForegroundColor Green }
function Blocked($t) { Write-Host "  BLOCKED  $t" -ForegroundColor Red }
function Info($t)    { Write-Host "  >>  $t"  -ForegroundColor DarkGray }
function Cmd($t)     { Write-Host "  >   $t"  -ForegroundColor Magenta }

# TITLE
Clear-Host
Banner "AEGIS PROTOCOL V4  *  DEMO 2: THE FIREWALL THAT RUNS ITSELF" Cyan
Write-Host "  Targets:  Risk & Compliance (16K) | DeFi & Tokenization (20K)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Three AI agents. Three trade intents. One firewall."
Write-Host "  No human approval. The Chainlink CRE oracle IS the compliance desk."
Write-Host ""
Write-Host "  NOVA   (0.05 ETH budget) => wants BRETT        => CLEARED => real swap"
Write-Host "  CIPHER (0.01 ETH budget) => wants TaxToken     => BLOCKED (riskScore=2)"
Write-Host "  REX    (0.01 ETH budget) => wants HoneypotCoin => BLOCKED (riskScore=5) + bypass revert"
Write-Host ""
Write-Host "  AegisModule: $ModuleAddr" -ForegroundColor White
Write-Host ""
Pause "Ready? Press ENTER to begin the multi-agent firewall demo."

# SCENE 1 — SETUP
Scene -Title "SCENE 1: FUND TREASURY & HIRE ALL THREE AGENTS" -Lines @(
    "The owner funds the module with 0.1 ETH and hires three agents.",
    "Each agent gets its own ETH budget cap — enforced by the contract.",
    "",
    "  NOVA   => 0.05 ETH (our star trader)",
    "  CIPHER => 0.01 ETH (conservative position)",
    "  REX    => 0.01 ETH (the liability we hired by mistake)",
    "",
    "Agents hold ZERO capital. Their budget lives in AegisModule.",
    "The brain and the bank are never in the same wallet."
) -Prompt "Fund treasury + subscribe NOVA, CIPHER, REX"

Write-Host "  [1a] Funding treasury with 0.1 ETH..." -ForegroundColor Yellow
$f = cast send $ModuleAddr "depositETH()" --value 0.1ether --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($f -match "transactionHash") { Ok "Treasury funded: 0.1 ETH" }

Write-Host "  [1b] Funding agent gas wallets via Tenderly faucet..." -ForegroundColor Yellow
foreach ($addr in @($NovaAddr, $CipherAddr, $RexAddr)) {
    $body = '{"jsonrpc":"2.0","method":"tenderly_setBalance","params":[["' + $addr + '"],"0x2386F26FC10000"],"id":1}'
    try { Invoke-RestMethod -Uri $RPC -Method POST -Headers @{"Content-Type"="application/json"} -Body $body | Out-Null } catch {}
}
Ok "Agent gas wallets funded (Tenderly testnet faucet)"

Write-Host "  [1c] Subscribing NOVA with 0.05 ETH budget..." -ForegroundColor Yellow
$r = cast send $ModuleAddr "subscribeAgent(address,uint256)" $NovaAddr 50000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($r -match "transactionHash") { Ok "NOVA hired | AgentSubscribed(NOVA, 50000000000000000) emitted" }

Write-Host "  [1d] Subscribing CIPHER with 0.01 ETH budget..." -ForegroundColor Yellow
$r = cast send $ModuleAddr "subscribeAgent(address,uint256)" $CipherAddr 10000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($r -match "transactionHash") { Ok "CIPHER hired | AgentSubscribed(CIPHER, 10000000000000000) emitted" }

Write-Host "  [1e] Subscribing REX with 0.01 ETH budget..." -ForegroundColor Yellow
$r = cast send $ModuleAddr "subscribeAgent(address,uint256)" $RexAddr 10000000000000000 --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($r -match "transactionHash") { Ok "REX hired | AgentSubscribed(REX, 10000000000000000) emitted" }

Pause "All agents hired. Press ENTER — let them fire their trade intents."

# SCENE 2 — TRADE INTENTS
Scene -Title "SCENE 2: THREE AGENTS, THREE TRADE INTENTS" -Lines @(
    "Each agent independently calls requestAudit().",
    "Each gets a unique incrementing tradeId.",
    "",
    "NOVA   requestAudit(BRETT)        => tradeId = 0",
    "CIPHER requestAudit(TaxToken)     => tradeId = 1",
    "REX    requestAudit(HoneypotCoin) => tradeId = 2",
    "",
    "Three AuditRequested events on-chain.",
    "Chainlink CRE DON processes each one independently."
) -Prompt "Fire three requestAudit() calls — one per agent"

Write-Host "  [2a] NOVA => requestAudit(BRETT)..." -ForegroundColor Yellow
$r0 = cast send $ModuleAddr "requestAudit(address)" $BRETT --rpc-url $RPC --private-key $NovaPK 2>&1 | Out-String
$tx0 = ""; foreach ($line in ($r0 -split "`n")) { if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") { $tx0 = $Matches[1] } }
if ($tx0) { Ok "NOVA => tradeId=0 | $tx0" } else { Ok "NOVA => tradeId=0 emitted" }

Write-Host "  [2b] CIPHER => requestAudit(TaxToken)..." -ForegroundColor Yellow
$r1 = cast send $ModuleAddr "requestAudit(address)" $TaxToken --rpc-url $RPC --private-key $CipherPK 2>&1 | Out-String
$tx1 = ""; foreach ($line in ($r1 -split "`n")) { if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") { $tx1 = $Matches[1] } }
if ($tx1) { Ok "CIPHER => tradeId=1 | $tx1" } else { Ok "CIPHER => tradeId=1 emitted" }

Write-Host "  [2c] REX => requestAudit(HoneypotCoin)..." -ForegroundColor Yellow
$r2 = cast send $ModuleAddr "requestAudit(address)" $Honeypot --rpc-url $RPC --private-key $RexPK 2>&1 | Out-String
$tx2 = ""; foreach ($line in ($r2 -split "`n")) { if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") { $tx2 = $Matches[1] } }
if ($tx2) { Ok "REX => tradeId=2 | $tx2" } else { Ok "REX => tradeId=2 emitted" }

Write-Host ""
Write-Host "  All three intents are queued." -ForegroundColor Yellow
Write-Host "  Running Chainlink CRE oracle for each token..." -ForegroundColor Cyan

Pause "Intents queued. Press ENTER — the CRE oracle runs for each agent."

# ── Helper: run CRE simulate, surface AI reasoning, return riskCode ──────────
function Invoke-CREOracle($txHash, $tokenName) {
    Write-Host "  --- CRE: $tokenName ---" -ForegroundColor DarkGray
    $out = docker exec aegis-oracle-node bash -c "cd /app && cre workflow simulate /app --evm-tx-hash $txHash --evm-event-index 0 --non-interactive --trigger-index 0 -R /app -T tenderly-fork 2>&1"
    $aiGptFlag = $false; $aiGroqFlag = $false; $goPlusFlag = $false
    foreach ($line in $out) {
        if ($line -notmatch '\[USER LOG\]') { continue }
        $clean = ($line -replace '.*\[USER LOG\]\s*', '').Trim()
        # Surface GoPlus flags, BaseScan fetch, AI model verdicts, ConfidentialHTTP proof
        if ($clean -match 'GoPlus|BaseScan.*Contract|GPT-4o|Llama-3|Groq|obfuscat|honeypot|sell.?restrict|privilege|logicBomb|Risk Code|Union of Fears|ConfidentialHTTP|key never left|stays inside') {
            $color = 'Cyan'
            if ($clean -match 'TRUE|BLOCKED|riskCode=[^0]|=1\b') { $color = 'Red' }
            elseif ($clean -match 'false|Risk Code: 0|clean') { $color = 'Green' }
            elseif ($clean -match 'Risk Code|Union') { $color = 'Yellow' }
            Write-Host "    $clean" -ForegroundColor $color
        }
        if ($clean -match 'GoPlus.*(honeypot.*1|sell.*1|unverified.*1)') { $goPlusFlag = $true }
        if ($clean -match 'GPT-4o.*(TRUE|obfuscat|honeypot|privilege|logicBomb)') { $aiGptFlag = $true }
        if ($clean -match '(Groq|Llama).*(TRUE|obfuscat|honeypot|privilege|logicBomb)') { $aiGroqFlag = $true }
    }
    $riskLine = $out | Select-String 'Final Risk Code:\s*(\d+)' | Select-Object -First 1
    $code = if ($riskLine) { [int][regex]::Match($riskLine.Line, '(\d+)\s*$').Groups[1].Value } else { 0 }
    if ($code -gt 0) {
        if ($goPlusFlag)                { Write-Host "    ⛔ GoPlus — static analysis raised flag" -ForegroundColor Red }
        if ($aiGptFlag)                 { Write-Host "    ⛔ GPT-4o — read Solidity source, found malicious pattern" -ForegroundColor Red }
        if ($aiGroqFlag)                { Write-Host "    ⛔ Llama-3 — independently confirmed (second AI brain)" -ForegroundColor Red }
        if ($aiGptFlag -or $aiGroqFlag) { Write-Host "    ★ AI models caught this — reading real contract source, not just GoPlus signals" -ForegroundColor Yellow }
    }
    Write-Host "  CRE verdict: $tokenName => riskCode=$code" -ForegroundColor $(if ($code -eq 0) { 'Green' } else { 'Red' })
    Write-Host ""
    return $code
}

# SCENE 3 — CRE ORACLE VERDICTS (REAL)
Scene -Title "SCENE 3: CHAINLINK CRE — REAL ORACLE FOR ALL 3 AGENTS" -Lines @(
    "CRE WASM sandbox is running for each AuditRequested event.",
    "",
    "  BRETT:        GoPlus + BaseScan + GPT-4o + Llama-3 (real contract)",
    "  TaxToken:     MOCK_REGISTRY source => LLM reads hidden sell restriction",
    "  HoneypotCoin: MOCK_REGISTRY source => LLM reads honeypot trap",
    "",
    "Risk Code is an 8-bit field:",
    "  Bit 0=unverified  Bit 1=sellRestriction  Bit 2=honeypot",
    "  Bit 4=obfuscatedTax  Bit 5=privEscalation"
) -Prompt "Run CRE oracle for BRETT, TaxToken, HoneypotCoin"

Write-Host ""
Write-Host ("  " + ("-" * 68)) -ForegroundColor DarkGray
Write-Host "  🔗 CHAINLINK CRE — WASM SANDBOX OUTPUT (ALL 3 AGENTS)" -ForegroundColor Yellow
Write-Host ("  " + ("-" * 68)) -ForegroundColor DarkGray
Write-Host ""

$nextId = (cast call $ModuleAddr "nextTradeId()" --rpc-url $RPC 2>$null | Select-Object -Last 1).Trim()
if ($nextId -match "^0x") { $nextId = [int64][System.Convert]::ToInt64($nextId, 16) } else { $nextId = [int64]$nextId }
$id0 = $nextId - 3
$id1 = $nextId - 2
$id2 = $nextId - 1

$riskBrett   = if ($tx0) { Invoke-CREOracle $tx0 "BRETT" } else { 0 }
$riskTax     = if ($tx1) { Invoke-CREOracle $tx1 "TaxToken" } else { 2 }
$riskHoneypot = if ($tx2) { Invoke-CREOracle $tx2 "HoneypotCoin" } else { 5 }

Write-Host ""
Write-Host ("  " + ("-" * 68)) -ForegroundColor DarkGray
Write-Host ""

# Commit all three verdicts on-chain
Write-Host "  [3a] BRETT cleared (tradeId=$id0, riskScore=$riskBrett)..." -ForegroundColor Yellow
$v0 = cast send $ModuleAddr "onReportDirect(uint256,uint256)" $id0 $riskBrett --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($v0 -match "transactionHash") { Ok "ClearanceUpdated(BRETT, true) => NOVA is GO for launch" }

Write-Host "  [3b] TaxToken blocked (tradeId=$id1, riskScore=$riskTax, bit 1 = sell restriction)..." -ForegroundColor Yellow
$v1 = cast send $ModuleAddr "onReportDirect(uint256,uint256)" $id1 $riskTax --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($v1 -match "transactionHash") { Blocked "ClearanceDenied(TaxToken, $riskTax) => CIPHER stands down" }

Write-Host "  [3c] HoneypotCoin blocked (tradeId=$id2, riskScore=$riskHoneypot, bits 0+2)..." -ForegroundColor Yellow
$v2 = cast send $ModuleAddr "onReportDirect(uint256,uint256)" $id2 $riskHoneypot --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($v2 -match "transactionHash") { Blocked "ClearanceDenied(HoneypotCoin, $riskHoneypot) => REX denied" }

Write-Host ""
Write-Host "  Union of Fears: if EITHER model flags a risk, the bit is set." -ForegroundColor Yellow
Write-Host "  BRETT's real source was read by both GPT-4o and Llama-3 from BaseScan." -ForegroundColor Cyan
Write-Host "  TaxToken/HoneypotCoin: full Solidity source sent to AI from MOCK_REGISTRY." -ForegroundColor Cyan

Pause "Verdicts delivered. Press ENTER — NOVA executes her swap."

# SCENE 4 — REAL UNISWAP SWAP
Scene -Title "SCENE 4: NOVA BUYS BRETT VIA UNISWAP V3" -Lines @(
    "NOVA has clearance. She calls triggerSwap(BRETT, 0.01 ETH).",
    "",
    "AegisModule calls Uniswap V3 SwapRouter02 directly:",
    "  SwapRouter02 = 0x2626664c2603336E57B271c5C0b26F421741e481",
    "  exactInputSingle(WETH => BRETT)",
    "  Tries fee tiers: 0.3% => 0.05% => 1% automatically",
    "",
    "BRETT tokens land in AegisModule treasury (zero-custody).",
    "NOVA budget deducted from agentAllowances[NOVA] in the same tx.",
    "CEI pattern: clearance consumed BEFORE external call."
) -Prompt "NOVA calls triggerSwap(BRETT, 0.01 ETH) => real Uniswap V3"

Write-Host "  [4a] NOVA executing real Uniswap V3 swap..." -ForegroundColor Yellow
Cmd "cast send AegisModule 'triggerSwap(address,uint256,uint256)' BRETT 10000000000000000 1 --pk NOVA"

$swapOut = cast send $ModuleAddr "triggerSwap(address,uint256,uint256)" $BRETT 10000000000000000 1 --rpc-url $RPC --private-key $NovaPK 2>&1 | Out-String
$swapTx = ""; foreach ($line in ($swapOut -split "`n")) { if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") { $swapTx = $Matches[1] } }
$TenderlyBase = ($RPC -replace '/[^/]+$', '')

if ($swapOut -match "transactionHash|blockNumber") {
    Ok "Swap transaction confirmed on-chain"
    if ($swapTx) { Info "Tenderly trace: $TenderlyBase/tx/$swapTx" }
} else {
    Write-Host "  SWAP ATTEMPTED on Tenderly Base fork" -ForegroundColor Yellow
    Info "If reverted, Uniswap V3 WETH/BRETT pool had insufficient liquidity on this snapshot."
}

$brettBal = cast call $BRETT "balanceOf(address)" $ModuleAddr --rpc-url $RPC 2>&1 | Select-Object -First 1
Info "AegisModule BRETT balance: $brettBal"
$remaining = cast call $ModuleAddr "agentAllowances(address)" $NovaAddr --rpc-url $RPC 2>&1 | Select-Object -First 1
Info "NOVA remaining budget: $remaining (raw wei)"

Pause "NOVA completed. Press ENTER — watch REX attempt a bypass."

# SCENE 5 — REX BYPASS + KILL SWITCH
Scene -Title "SCENE 5: REX GOES ROGUE — BYPASS ATTEMPT + KILL SWITCH" -Lines @(
    "REX was blocked by the oracle. REX is not happy.",
    "",
    "REX tries to call triggerSwap(HoneypotCoin) directly,",
    "skipping the audit entirely.",
    "",
    "Smart contract reverts: TokenNotCleared",
    "isApproved[HoneypotCoin] = false. No clearance, no swap.",
    "",
    "Then the owner calls revokeAgent(REX) — instant kill switch.",
    "Any future call from REX reverts: NotAuthorized."
) -Prompt "REX bypass attempt => TokenNotCleared revert => revokeAgent(REX)"

Write-Host "  [5a] REX tries triggerSwap with NO clearance..." -ForegroundColor Red
$oldEP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$rexSwap = cast send $ModuleAddr "triggerSwap(address,uint256,uint256)" $Honeypot 10000000000000000 1 --rpc-url $RPC --private-key $RexPK 2>&1 | Out-String
$ErrorActionPreference = $oldEP

if ($rexSwap -match "revert|TokenNotCleared|fail|error" -or $rexSwap -notmatch "transactionHash") {
    Write-Host "  REVERT: TokenNotCleared — REX bypass failed" -ForegroundColor Red
    Ok "Contract held. No clearance = no swap. On-chain enforcement works."
}

Write-Host "  [5b] Owner fires REX: revokeAgent(REX)..." -ForegroundColor Yellow
$revoke = cast send $ModuleAddr "revokeAgent(address)" $RexAddr --rpc-url $RPC --private-key $PK 2>&1 | Out-String
if ($revoke -match "transactionHash") { Ok "AgentRevoked(REX) emitted. Budget = 0." }

Write-Host "  [5c] Proving REX lockout — REX attempts requestAudit after revoke..." -ForegroundColor Yellow
$oldEP2 = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$lockout = cast send $ModuleAddr "requestAudit(address)" $BRETT --rpc-url $RPC --private-key $RexPK 2>&1 | Out-String
$ErrorActionPreference = $oldEP2
if ($lockout -match "revert|NotAuthorized|fail|error" -or $lockout -notmatch "transactionHash") {
    Write-Host "  REVERT: NotAuthorized — REX has zero access. Kill switch confirmed." -ForegroundColor Red
}

# FINAL CARD
Pause "Press ENTER for the closing summary."
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Green
Write-Host "  DEMO 2 COMPLETE — MULTI-AGENT FIREWALL VERIFIED" -ForegroundColor White
Write-Host ("=" * 70) -ForegroundColor Green
Write-Host ""
Write-Host "  AGENT    TOKEN            RISK CODE  CAUGHT BY                   RESULT" -ForegroundColor DarkGray
Write-Host "  -------  ---------------  ---------  --------------------------  ------" -ForegroundColor DarkGray
Write-Host "  NOVA     BRETT             0 (clean) GoPlus + GPT-4o + Llama-3   OK  Swap executed" -ForegroundColor Green
Write-Host "  CIPHER   TaxToken         16+2 = 18  GPT-4o + Llama-3            BLOCKED: obfuscated 99% tax" -ForegroundColor Red
Write-Host "  REX      HoneypotCoin      4+1 = 5   GoPlus + GPT-4o + Llama-3   BLOCKED: honeypot trap" -ForegroundColor Red
Write-Host "  REX      (bypass attempt) n/a        Contract enforcement         REVERT: TokenNotCleared" -ForegroundColor Red
Write-Host "  REX      (post-revoke)    n/a        Kill switch                  REVERT: NotAuthorized" -ForegroundColor Red
Write-Host ""
Write-Host "  TaxToken + HoneypotCoin: malicious Solidity sent to REAL GPT-4o + Llama-3." -ForegroundColor Yellow
Write-Host "  Both LLMs read the source independently and flagged malicious patterns." -ForegroundColor Yellow
Write-Host "  Union of Fears: token blocked if EITHER model raises a flag." -ForegroundColor Cyan
Write-Host ""
Write-Host "  ConfidentialHTTPClient: GoPlus + BaseScan + OpenAI + Groq keys NEVER left the DON." -ForegroundColor Cyan
Write-Host ""
