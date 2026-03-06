<#
.SYNOPSIS
Aegis V5 — Raw Heimdall Pipeline (no presentation formatting)
.DESCRIPTION
Bytecode decompilation pipeline: BaseScan probe, eth_getCode, Heimdall Docker, GPT-4o analysis.
#>
param([string]$TargetAddress = "")
$ErrorActionPreference = "Continue"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

# ── Load .env ──
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Resolve-Path "$ScriptDir\..").Path ".env"
if (!(Test-Path $EnvPath)) { Write-Host "ERROR: .env not found"; exit 1 }

$RPC = ""; $OpenAIKey = ""; $BaseScanKey = ""
Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^BASE_SEPOLIA_RPC_URL=(.*)") { $RPC = $Matches[1].Trim() }
    if ($_ -match "^OPENAI_API_KEY=(.*)") { $OpenAIKey = $Matches[1].Trim() }
    if ($_ -match "^BASESCAN_API_KEY=(.*)") { $BaseScanKey = $Matches[1].Trim() }
}
if (-not $RPC) { $RPC = "https://sepolia.base.org" }
if (-not $TargetAddress) { $TargetAddress = "0x99900d61f42bA57A8C3DA5b4d763f0F2Dc51E2B3" }

Write-Host "=== AEGIS V5 RAW HEIMDALL PIPELINE ==="
Write-Host "  Target: $TargetAddress"
Write-Host ""

# ── 1. Heimdall health ──
Write-Host "[1/5] Checking Heimdall container..."
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method GET -TimeoutSec 5
    Write-Host "  Status: $($health.status), Engine: $($health.heimdall)"
} catch {
    Write-Host "  ERROR: Heimdall not running. Start with: docker run -d -p 8080:8080 --name aegis-heimdall aegis-heimdall"
    exit 1
}

# ── 2. BaseScan probe ──
Write-Host "[2/5] Probing BaseScan for verified source..."
try {
    $BSUrl = "https://api.etherscan.io/v2/api?chainid=84532&module=contract&action=getsourcecode&address=$TargetAddress&apikey=$BaseScanKey"
    $BSResult = Invoke-RestMethod -Uri $BSUrl -Method GET -TimeoutSec 10
    if ($BSResult.result[0].SourceCode -and $BSResult.result[0].SourceCode -ne "") {
        Write-Host "  BaseScan: VERIFIED source found ($($BSResult.result[0].ContractName))"
    } else {
        Write-Host "  BaseScan: NO verified source — Heimdall will decompile"
    }
} catch {
    Write-Host "  BaseScan query failed — proceeding anyway"
}

# ── 3. Bytecode extraction ──
Write-Host "[3/5] Fetching bytecode via eth_getCode..."
$Bytecode = (cast code $TargetAddress --rpc-url $RPC 2>&1 | Out-String).Trim()
$BCLen = $Bytecode.Length
if ($BCLen -le 2) { Write-Host "  ERROR: No bytecode at address"; exit 1 }
Write-Host "  Bytecode: $BCLen hex chars"
Write-Host "  Prefix: $($Bytecode.Substring(0,42))..."

# ── 4. Heimdall decompilation ──
Write-Host "[4/5] Decompiling with Heimdall..."
$DecompileBody = @{ bytecode = $Bytecode } | ConvertTo-Json
$StartTime = Get-Date
try {
    $DecompileRes = Invoke-RestMethod -Uri "http://localhost:8080/decompile" -Method POST `
        -ContentType "application/json" -Body $DecompileBody -TimeoutSec 120
} catch {
    Write-Host "  ERROR: Decompilation failed: $($_.Exception.Message)"; exit 1
}
$ElapsedMs = [math]::Round(((Get-Date) - $StartTime).TotalMilliseconds)

if (-not $DecompileRes.success) { Write-Host "  ERROR: Empty decompilation"; exit 1 }
$DecompiledLen = $DecompileRes.decompiled.Length
Write-Host "  Decompiled: $DecompiledLen chars in ${ElapsedMs}ms"
Write-Host "  Preview (first 300 chars):"
$DecompileRes.decompiled.Substring(0, [Math]::Min(300, $DecompiledLen)) -split "`n" | ForEach-Object {
    Write-Host "    $_"
}

# ── 5. GPT-4o analysis ──
Write-Host "[5/5] GPT-4o risk analysis..."
if (-not $OpenAIKey) {
    Write-Host "  SKIP: OPENAI_API_KEY not set"
} else {
    $SourceForAI = $DecompileRes.decompiled.Substring(0, [Math]::Min(8000, $DecompiledLen))
    $AIPrompt = @"
You are a Web3 Smart Contract Auditor analyzing decompiled bytecode. Return ONLY valid JSON:
{"obfuscatedTax": boolean, "privilegeEscalation": boolean, "externalCallRisk": boolean, "logicBomb": boolean, "is_malicious": boolean, "reasoning": "one sentence"}

Decompiled contract:
$SourceForAI
"@
    $AIBody = @{
        model = "gpt-4o"
        messages = @(@{ role = "user"; content = $AIPrompt })
        temperature = 0
        max_tokens = 300
    } | ConvertTo-Json -Depth 5

    try {
        $AIHeaders = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $OpenAIKey" }
        $AIRes = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" `
            -Method POST -Body $AIBody -Headers $AIHeaders -TimeoutSec 60
        $AIContent = $AIRes.choices[0].message.content
        Write-Host "  GPT-4o response:"
        $AIContent -split "`n" | ForEach-Object { Write-Host "    $_" }

        $JsonStr = ($AIContent -replace '```json\n?', '' -replace '```\n?', '').Trim()
        $RiskResult = $JsonStr | ConvertFrom-Json

        $RiskMask = 0
        if ($RiskResult.obfuscatedTax) { $RiskMask = $RiskMask -bor 1 }
        if ($RiskResult.privilegeEscalation) { $RiskMask = $RiskMask -bor 2 }
        if ($RiskResult.externalCallRisk) { $RiskMask = $RiskMask -bor 4 }
        if ($RiskResult.logicBomb) { $RiskMask = $RiskMask -bor 8 }
        if ($RiskResult.is_malicious -and $RiskMask -eq 0) { $RiskMask = $RiskMask -bor 2 }

        Write-Host ""
        Write-Host "  Verdict: $(if ($RiskResult.is_malicious) { 'MALICIOUS' } else { 'CLEAN' })"
        Write-Host "  Risk code: $RiskMask (0b$([Convert]::ToString($RiskMask, 2).PadLeft(8, '0')))"
        Write-Host "  Reasoning: $($RiskResult.reasoning)"
    } catch {
        Write-Host "  ERROR: GPT-4o call failed: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "=== HEIMDALL PIPELINE COMPLETE ==="
Write-Host "  Pipeline: eth_getCode -> Heimdall (local Docker) -> GPT-4o -> 8-bit risk code"
