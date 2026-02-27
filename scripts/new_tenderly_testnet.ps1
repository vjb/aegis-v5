<#
.SYNOPSIS
Creates a fresh Tenderly Virtual Testnet and fully sets up the Aegis V4 environment.

.DESCRIPTION
One-command reset: Creates a new VNet, funds wallets, deploys & verifies AegisModule (ERC-7579),
and updates all config files (.env, workflow.yaml, config.json).
V4 change: Deploys AegisModule instead of AegisVault.

.EXAMPLE
.\scripts\new_tenderly_testnet.ps1
#>

$ErrorActionPreference = "Stop"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

# Navigate to project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($ScriptDir -match "scripts$") { Set-Location -Path "$ScriptDir\.." }

# ── 0. Read .env ──────────────────────────────────────────────────────
if (!(Test-Path ".env")) { Write-Error ".env file not found!" }

$EnvContent = Get-Content .env
$OldRpcUrl   = ""
$DevWallet   = ""
$TenderlyKey = ""
$PrivateKey  = ""

foreach ($line in $EnvContent) {
    if ($line -match "^TENDERLY_RPC_URL=(.*)") { $OldRpcUrl   = $Matches[1].Trim() }
    if ($line -match "^DEV_WALLET_ADDRESS=(.*)") { $DevWallet   = $Matches[1].Trim() }
    if ($line -match "^TENDERLY_KEY=(.*)") { $TenderlyKey = $Matches[1].Trim() }
    if ($line -match "^PRIVATE_KEY=(.*)") { $PrivateKey  = $Matches[1].Trim() }
}

if (!$TenderlyKey) { Write-Error "TENDERLY_KEY not found in .env!" }
if (!$DevWallet)   { Write-Error "DEV_WALLET_ADDRESS not found in .env!" }

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  🛡️  AEGIS V4 — NEW TENDERLY TESTNET PROVISIONER" -ForegroundColor Cyan
Write-Host "  (ERC-7579 Module Edition)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# ── 1. Create VNet via API ─────────────────────────────────────────────
$Timestamp = Get-Date -Format "MMdd-HHmm"
$Slug = "aegis-v4-$Timestamp"

Write-Host "`n1. Creating new Tenderly Virtual Testnet ($Slug)..." -ForegroundColor Yellow

$Headers = @{
    "X-Access-Key" = $TenderlyKey
    "Content-Type" = "application/json"
}

$CreateBody = @{
    slug = $Slug
    display_name = "Aegis V4 Firewall $Timestamp"
    fork_config = @{ network_id = 8453 }
    virtual_network_config = @{ chain_config = @{ chain_id = 73578453 } }
    sync_state_config = @{ enabled = $false }
    explorer_page_config = @{
        enabled = $true
        verification_visibility = "src"
    }
} | ConvertTo-Json -Depth 5

try {
    $VNetResponse = Invoke-RestMethod -Uri "https://api.tenderly.co/api/v1/account/aegis/project/project/vnets" `
        -Method POST -Headers $Headers -Body $CreateBody
} catch {
    Write-Error "Failed to create VNet: $_"
}

$NewRpcUrl = ($VNetResponse.rpcs | Where-Object { $_.url -like "https://*" -and $_.name -eq "Admin RPC" }).url
$VNetId = $VNetResponse.id

if (!$NewRpcUrl) {
    Write-Host ($VNetResponse | ConvertTo-Json -Depth 5)
    Write-Error "Could not extract Admin RPC URL from response!"
}

Write-Host "  > VNet ID: $VNetId" -ForegroundColor Green
Write-Host "  > Admin RPC: $NewRpcUrl" -ForegroundColor Green

# ── 2. Update .env ──────────────────────────────────────────────────────
Write-Host "`n2. Updating .env with new RPC URL..." -ForegroundColor Yellow

$NewUuid = ($NewRpcUrl -split "/")[-1]
$UpdatedEnv = @()
foreach ($line in $EnvContent) {
    if ($line -match "^TENDERLY_RPC_URL=") {
        $UpdatedEnv += "TENDERLY_RPC_URL=$NewRpcUrl"
    } elseif ($line -match "^TENDERLY_TESTNET_UUID=") {
        $UpdatedEnv += "TENDERLY_TESTNET_UUID=$NewUuid"
    } else {
        $UpdatedEnv += $line
    }
}
$UpdatedEnv | Set-Content .env
Write-Host "  > .env updated" -ForegroundColor Green

# ── 3. Update CRE YAML configs ─────────────────────────────────────────
Write-Host "`n3. Updating CRE-Node YAML configs..." -ForegroundColor Yellow

foreach ($yamlPath in @("cre-node/workflow.yaml", "cre-node/project.yaml")) {
    if ((Test-Path $yamlPath) -and $OldRpcUrl) {
        (Get-Content $yamlPath) -replace [regex]::Escape($OldRpcUrl), $NewRpcUrl | Set-Content $yamlPath
        Write-Host "  > Updated $yamlPath" -ForegroundColor Green
    }
}

# ── 4. Fund Deployer Wallet ───────────────────────────────────────────────
Write-Host "`n4. Funding deployer wallet via Tenderly cheatcode..." -ForegroundColor Yellow

# 0xDE0B6B3A7640000 = 1 ETH in wei (hex)
# Deployer needs: ~0.01 ETH gas (deploy) + 0.15 ETH treasury (demos) = 0.2 ETH max
# Fund with 2 ETH to be comfortable across all three demo scripts
$FundDeployer = '{"jsonrpc":"2.0","method":"tenderly_setBalance","params":[["' + $DevWallet + '"],"0x1BC16D674EC80000"],"id":1}'

try {
    Invoke-RestMethod -Uri $NewRpcUrl -Method POST -Headers @{ "Content-Type" = "application/json" } -Body $FundDeployer | Out-Null
    Write-Host "  > Deployer funded with 2 ETH (enough for all demo operations)" -ForegroundColor Green
} catch {
    Write-Warning "Failed to fund deployer wallet: $_"
}

# ── 5. Deploy AegisModule (V4) ─────────────────────────────────────────
Write-Host "`n5. Deploying AegisModule (ERC-7579 Executor)..." -ForegroundColor Yellow

# The KeystoneForwarder address on Base mainnet (via Tenderly fork)
# Replace with the actual deployed KeystoneForwarder address from Chainlink CRE
$KeystoneForwarder = "0x109D8072B1762263ed094BC05c5110895Adc65Cf"

$env:TENDERLY_ACCESS_KEY    = $TenderlyKey
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

$oldErrAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"

# V4: Deploy AegisModule with keystoneForwarder constructor arg
$DeployCommand = "forge create src/AegisModule.sol:AegisModule --rpc-url '$NewRpcUrl' --private-key '$PrivateKey' --broadcast --constructor-args '$KeystoneForwarder'"
$DeployOutput = Invoke-Expression $DeployCommand 2>&1

$ErrorActionPreference = $oldErrAction

$NewModuleAddress = ""
foreach ($line in $DeployOutput) {
    $lineStr = $line.ToString()
    if ($lineStr -match "Deployed to:\s+(0x[a-fA-F0-9]{40})") {
        $NewModuleAddress = $Matches[1]
        break
    }
}

if ([string]::IsNullOrEmpty($NewModuleAddress)) {
    Write-Host ($DeployOutput -join "`n")
    Write-Warning "Could not parse AegisModule address. Update AEGIS_MODULE_ADDRESS manually."
} else {
    Write-Host "  > AegisModule deployed at: $NewModuleAddress" -ForegroundColor Green

    # ── 6. Update .env with module address ────────────────────────────
    Write-Host "`n6. Updating AEGIS_MODULE_ADDRESS in .env..." -ForegroundColor Yellow
    $FinalEnv = @()
    foreach ($line in (Get-Content .env)) {
        if ($line -match "^AEGIS_MODULE_ADDRESS=") {
            $FinalEnv += "AEGIS_MODULE_ADDRESS=$NewModuleAddress"
        } elseif ($line -match "^AEGIS_VAULT_ADDRESS=") {
            # Keep for reference but add new module address entry
            $FinalEnv += $line
        } else {
            $FinalEnv += $line
        }
    }
    # Add AEGIS_MODULE_ADDRESS if it didn't exist yet
    if (-not ($FinalEnv | Select-String "^AEGIS_MODULE_ADDRESS=")) {
        $FinalEnv += "AEGIS_MODULE_ADDRESS=$NewModuleAddress"
    }
    $FinalEnv | Set-Content .env
    Write-Host "  > AEGIS_MODULE_ADDRESS updated in .env" -ForegroundColor Green

    # ── 7. Update CRE config.json with new module address ─────────────
    Write-Host "`n7. Updating cre-node/config.json with AegisModule address..." -ForegroundColor Yellow
    $ConfigPath = "cre-node/config.json"
    if (Test-Path $ConfigPath) {
        $ConfigContent = Get-Content $ConfigPath -Raw
        $ConfigContent = $ConfigContent -replace '"vaultAddress"\s*:\s*"0x[a-fA-F0-9]+"', "`"vaultAddress`": `"$NewModuleAddress`""
        $ConfigContent | Set-Content $ConfigPath
        Write-Host "  > config.json updated (vaultAddress → AegisModule)" -ForegroundColor Green
    }

    # ── 8. Verify AegisModule on Tenderly ─────────────────────────────────
    Write-Host "`n8. Verifying AegisModule on Tenderly explorer..." -ForegroundColor Yellow
    $VerifierUrl = "$NewRpcUrl/verify"
    $CtorArgs = (cast abi-encode "constructor(address)" "$KeystoneForwarder" 2>$null | Select-Object -Last 1).Trim()
    $env:TENDERLY_ACCESS_KEY = $TenderlyKey
    $env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"
    $verifyOut = forge verify-contract $NewModuleAddress src/AegisModule.sol:AegisModule `
        --verifier custom `
        --verifier-url $VerifierUrl `
        --etherscan-api-key $TenderlyKey `
        --constructor-args $CtorArgs 2>&1
    if ($verifyOut -match "Response:.*OK") {
        Write-Host "  > AegisModule verified on Tenderly" -ForegroundColor Green
    } else {
        Write-Host "  > Verification submitted (may take ~10 min to appear in UI)" -ForegroundColor DarkGray
    }
}

# ── Done ────────────────────────────────────────────────────────────────
Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "  🎉 AEGIS V4 TESTNET READY" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  RPC:    $NewRpcUrl" -ForegroundColor White
Write-Host "  Module: $NewModuleAddress" -ForegroundColor White
Write-Host "  UUID:   $NewUuid" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Run E2E sim:   npx ts-node scripts/e2e_mock_simulation.ts" -ForegroundColor DarkGray
Write-Host "  2. Run live E2E:  npx ts-node scripts/live_e2e.ts" -ForegroundColor DarkGray
Write-Host "  3. Start Oracle:  .\scripts\start_oracle.ps1" -ForegroundColor DarkGray
Write-Host "  4. Start UI:      cd aegis-frontend && npm run dev" -ForegroundColor DarkGray
Write-Host ""
