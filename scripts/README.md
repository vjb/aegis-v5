# 🧪 Aegis V4 — Scripts

Operational scripts for provisioning, testing, and running the Aegis V4 protocol.

## Scripts Overview

| Script | Purpose |
|---|---|
| `new_tenderly_testnet.ps1` | One-command VNet provisioner |
| `start_oracle.ps1` | CRE oracle Docker launcher |
| `demo_1_cre_oracle.ps1` | Demo 1: CRE oracle + BRETT real token |
| `demo_2_multi_agent.ps1` | Demo 2: 3 agents, real CRE for each token |
| `demo_3_erc7579_architecture.ps1` | Demo 3: ERC-7579 full lifecycle |
| `e2e_mock_simulation.ts` | E2E test (mocked oracle callback) |
| `live_e2e.ts` | E2E test (real CRE oracle, no mocks) |

---

## `new_tenderly_testnet.ps1` — VNet Provisioner

Creates a fresh Tenderly Virtual Testnet (Base mainnet fork), deploys `AegisModule`, funds the deployer, and auto-updates all config files.

```powershell
.\scripts\new_tenderly_testnet.ps1
```

**What it does:**
1. Creates new Tenderly VNet via API
2. Updates `.env` with new `TENDERLY_RPC_URL` and `TENDERLY_TESTNET_UUID`
3. Funds deployer with **2 ETH** via `tenderly_setBalance` (enough for all demo operations)
4. Deploys `AegisModule` with your `PRIVATE_KEY`
5. Updates `AEGIS_MODULE_ADDRESS` in `.env`
6. Updates `cre-node/config.json` and `cre-node/workflow.yaml` with new addresses
7. Verifies contract on Tenderly explorer

**Requires in `.env`:** `TENDERLY_KEY`, `DEV_WALLET_ADDRESS`, `PRIVATE_KEY`

---

## `start_oracle.ps1` — CRE Oracle Docker Launcher

Updates the CRE node config and starts the Chainlink CRE Docker environment.

```powershell
.\scripts\start_oracle.ps1
```

**What it does:**
1. Reads `TENDERLY_RPC_URL` and `AEGIS_MODULE_ADDRESS` from `.env`
2. Updates `cre-node/config.json` with current module address
3. Starts `docker compose up --build -d`
4. Tails container logs

**First time only:** After starting, run inside Docker:
```bash
docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"
```

---

## Demo Scripts

See [docs/DEMO_GUIDE.md](../docs/DEMO_GUIDE.md) for the full guide. Quick reference:

```powershell
# Non-interactive (for CI/logging)
.\scripts\demo_1_cre_oracle.ps1           # BRETT real token — CRE oracle pipeline
.\scripts\demo_2_multi_agent.ps1          # 3 agents — NOVA cleared, CIPHER+REX blocked
.\scripts\demo_3_erc7579_architecture.ps1 # Full ERC-7579 lifecycle

# Interactive (for video recording)
.\scripts\demo_1_cre_oracle.ps1 -Interactive
```

Each script auto-provisions a new VNet if the current one is out of blocks.

---

## `e2e_mock_simulation.ts` — E2E Test (Mocked Oracle)

Proves the full module lifecycle using Anvil impersonation to mock the oracle callback.

```bash
pnpm ts-node scripts/e2e_mock_simulation.ts
```

Flow:
1. Agent calls `requestAudit(token)` on-chain
2. **Mocks** the CRE callback: impersonates `keystoneForwarder`, calls `onReport(tradeId, 0)`
3. Agent calls `triggerSwap(token, amount)`
4. Asserts clearance was consumed (anti-replay) ✅

---

## `live_e2e.ts` — E2E Test (Real CRE Oracle)

Production-grade integration test. Does NOT mock anything — waits for the real Chainlink CRE node to call `onReport`.

```bash
pnpm ts-node scripts/live_e2e.ts
```

**Prerequisites:**
1. Tenderly VNet running (`.\scripts\new_tenderly_testnet.ps1`)
2. CRE Docker node running (`.\scripts\start_oracle.ps1`)
3. `AEGIS_MODULE_ADDRESS` set in `.env`

**Timeout:** 5 minutes. Polls every second for `ClearanceUpdated` or `ClearanceDenied` events.

---

## Environment Setup

```bash
# Copy and fill
cp .env.example .env

# Required
TENDERLY_KEY=...
DEV_WALLET_ADDRESS=...
PRIVATE_KEY=...

# Set automatically by new_tenderly_testnet.ps1
TENDERLY_RPC_URL=...
AEGIS_MODULE_ADDRESS=...

# AI APIs (for CRE oracle)
OPENAI_API_KEY=...
GROQ_API_KEY=...
BASESCAN_API_KEY=...
GOPLUS_APP_KEY=...     # optional — enables GoPlus authenticated tier
GOPLUS_APP_SECRET=...  # optional
```
