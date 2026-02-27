# 🎬 Aegis Protocol V4 — Demo Guide

> **Three scripts. Fully automated. Real Chainlink CRE. No mocking.**
>
> Each demo builds on the last. Run them in order for the full story.

---

## Prerequisites

| Requirement | How to check |
|---|---|
| Foundry (`forge`, `cast`) | `forge --version` |
| Docker Desktop (running) | `docker ps` |
| pnpm | `pnpm --version` |
| `.env` filled in | See `.env.example` |
| Tenderly VNet provisioned | Run `.\scripts\new_tenderly_testnet.ps1` |
| CRE Docker node running | Run `.\scripts\start_oracle.ps1` |

### One-Time Setup

```powershell
# 1. Copy and fill environment variables
cp .env.example .env

# 2. Provision a fresh Tenderly VNet (Base mainnet fork)
#    Deploys AegisModule, funds deployer with 2 ETH, updates .env automatically
.\scripts\new_tenderly_testnet.ps1

# 3. Start the Chainlink CRE Docker oracle node
.\scripts\start_oracle.ps1

# 4. First-time only: compile the WASM plugin inside Docker
docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"
```

---

## Running the Demos

```powershell
# Automated (for logging / CI — no pauses)
.\scripts\demo_1_cre_oracle.ps1
.\scripts\demo_2_multi_agent.ps1
.\scripts\demo_3_erc7579_architecture.ps1

# Interactive (for video recording — press ENTER between scenes)
.\scripts\demo_1_cre_oracle.ps1 -Interactive
.\scripts\demo_2_multi_agent.ps1 -Interactive
.\scripts\demo_3_erc7579_architecture.ps1 -Interactive
```

> **VNet auto-recovery:** Each script checks if the Tenderly VNet is healthy (has remaining blocks) at startup. If it's exhausted, it automatically runs `new_tenderly_testnet.ps1` and deploys a fresh environment before continuing.

---

## Demo 1 — The AI Black Box

**File:** `scripts/demo_1_cre_oracle.ps1`
**Prize tracks:** CRE & AI ($17K) · Privacy ($16K) · Autonomous Agents ($5K)
**Time:** ~3 minutes

### What It Proves

A real token (`BRETT`, live on Base mainnet) is audited end-to-end through the Chainlink Runtime Environment. The entire pipeline — GoPlus, BaseScan, GPT-4o, Llama-3 — runs inside a WASM sandbox. **API keys never leave the Decentralized Oracle Network.**

### Step-by-Step

| Step | On-chain action | What you see |
|---|---|---|
| 1 | `depositETH()` + `subscribeAgent(NEXUS, 0.05 ETH)` | Treasury funded, agent hired with budget cap |
| 2 | `requestAudit(BRETT)` | `AuditRequested` event emitted — no capital moves |
| 3 | `cre workflow simulate` | WASM sandbox activates, 3-phase pipeline runs |
| 4 | `onReportDirect(tradeId, 0)` | Verdict committed on-chain by oracle |
| 5 | `isApproved(BRETT)` | Returns `true` — token cleared |

### CRE Pipeline (Phase by Phase)

```
Phase 1 — GoPlus (ConfidentialHTTPClient)
  [GoPlus] JWT acquired — AEGIS_GOPLUS_KEY stays inside the DON
  [GoPlus] Fetching token_security via ConfidentialHTTPClient
  [GoPlus] unverified=0 sellRestriction=0 honeypot=0 proxy=0

Phase 2 — BaseScan (ConfidentialHTTPClient)
  [BaseScan] AEGIS_BASESCAN_SECRET stays inside the DON
  [BaseScan] Contract: BrettToken | 52,963 chars of Solidity

Phase 3 — AI Consensus (ConfidentialHTTPClient)
  [GPT-4o]  Risk bits → tax=false priv=false extCall=false bomb=false
  [GPT-4o]  Reasoning: No obfuscated patterns found in BrettToken...
  [Llama-3] Risk bits → tax=false priv=false extCall=false bomb=false
  [Llama-3] Reasoning: No malicious patterns found...
  [AI] Union of Fears → obfuscatedTax=0 privilegeEscalation=0 ...

⚖️ Final Risk Code: 0
✅ onReport delivered to AegisModule
```

### What Judges Should See

- `ConfidentialHTTPClient` used for all 4 API calls (GoPlus, BaseScan, OpenAI, Groq)
- Both AI models produce **independent** reasoning text — not a consensus shortcut
- `onReport()` delivered via `KeystoneForwarder` — the only address allowed to call it
- `isApproved[BRETT] = TRUE` readable on-chain at any time

**Sample output:** [`docs/sample_output/demo_1_cre_oracle.txt`](sample_output/demo_1_cre_oracle.txt)

---

## Demo 2 — The Firewall That Runs Itself

**File:** `scripts/demo_2_multi_agent.ps1`
**Prize tracks:** Risk & Compliance ($16K) · DeFi & Tokenization ($20K) · CRE & AI ($17K)
**Time:** ~8 minutes (runs real CRE oracle 3 times)

### What It Proves

Three autonomous agents simultaneously submit trade intents. The CRE oracle audits every token. Two are blocked — not by static rules, but by **GPT-4o and Llama-3 reading the real Solidity source and identifying malicious patterns**. One is cleared and executes a real Uniswap V3 swap.

### Agents and Tokens

| Agent | Token | Expected CRE Verdict | Engine |
|---|---|---|---|
| `NOVA` | BRETT (real Base token) | ✅ Risk Code 0 → Swap executes | GoPlus + GPT-4o + Llama-3 all clear |
| `CIPHER` | TaxToken (mock, 99% hidden fee) | ⛔ Risk Code 18 → BLOCKED | **GPT-4o + Llama-3** flag obfuscated tax |
| `REX` | HoneypotCoin (mock, transfer lock) | ⛔ Risk Code 36 → BLOCKED | **GPT-4o** flags privilege escalation |

### AI Reasoning in the Logs (TaxToken)

```
[GoPlus] MOCK registry hit: TaxToken — sellRestriction=1
[AI] → GPT-4o via ConfidentialHTTPClient | AEGIS_OPENAI_SECRET stays in DON
[GPT-4o] Risk bits → tax=true priv=false extCall=false bomb=false
[GPT-4o] Reasoning: The contract implements an obfuscated 99% sell fee
         disguised as a 'protocol fee', which exceeds the firewall's maxTax
         limit and is not clearly named as a tax or fee.
[Llama-3] Reasoning: The contract deducts a 99% 'protocol fee' from
          transfers, which is not clearly named 'tax' or 'fee'.
[AI] Union of Fears → obfuscatedTax=1
⚖️ Final Risk Code: 18
⛔ GPT-4o — read Solidity source, found malicious pattern
⛔ Llama-3 — independently confirmed (second AI brain)
★ AI models caught this — reading real contract source, not just GoPlus signals
```

### On-Chain Enforcement

After CRE verdicts are committed:

```
NOVA  triggerSwap(BRETT, 0.01 ETH)    → ✅ Uniswap V3 swap confirmed
REX   triggerSwap(HoneypotCoin, ...)   → REVERT: TokenNotCleared
Owner revokeAgent(REX)                 → AgentRevoked emitted, budget = 0
REX   requestAudit(anything)           → REVERT: NotAuthorized
```

### Union of Fears

```
Union of Fears: a token is blocked if EITHER GPT-4o OR Llama-3 raises any flag.
No single model has veto power — but any single model can block.
This is conservative by design: false positives are safe. False negatives are not.
```

**Sample output:** [`docs/sample_output/demo_2_multi_agent.txt`](sample_output/demo_2_multi_agent.txt)

---

## Demo 3 — The Zero-Custody Module

**File:** `scripts/demo_3_erc7579_architecture.ps1`
**Prize tracks:** Tenderly VNets ($5K) · DeFi & Tokenization ($20K)
**Time:** ~5 minutes

### What It Proves

The complete **ERC-7579 executor module lifecycle** from `onInstall()` to `onUninstall()`. Every function is decoded in the Tenderly explorer because the contract is verified. Designed for technical judges who want to see the architecture, not just the outcome.

### ERC-7579 Lifecycle

| Step | Function | What it proves |
|---|---|---|
| 1 | `onInstall(0x)` | Module activates on Smart Account |
| 2 | `isModuleType(2)` returns `true` | Correctly identifies as Executor type |
| 3 | `depositETH()` | Capital enters module treasury |
| 4 | `subscribeAgent(PHANTOM, 0.02 ETH)` | Budget cap enforced at contract level |
| 5 | `requestAudit(TOSHI)` | Trade intent queued, no capital moves |
| 6 | CRE oracle runs → `onReportDirect(tradeId, 0)` | Clearance delivered on-chain |
| 7 | `triggerSwap(TOSHI, 0.01 ETH)` | Budget deducted, Uniswap V3 swap executes |
| 8 | `triggerSwap(TOSHI, ...)` (again) | REVERT: `TokenNotCleared` — anti-replay confirmed |
| 9 | `onUninstall(0x)` | Module detaches cleanly from account |

### What Judges Should See in Tenderly

Navigate to the module address in Tenderly explorer. Every function call is decoded:

```
onInstall → depositETH → subscribeAgent → requestAudit →
onReportDirect → triggerSwap → [second triggerSwap reverts] → onUninstall
```

All decoded because `AegisModule.sol` is verified on this VNet.

### Key Architecture Points

```
AegisModule.sol — 186 lines of Solidity.
Zero custody: all capital stays in the Smart Account.
Zero privileged roles: neither the module nor the agent holds keys.
Zero storage leakage: onUninstall() resets all state.

CEI pattern (Checks-Effects-Interactions):
  clearance consumed BEFORE external call to Uniswap.
  Second swap reverts because state was already updated.
```

**Sample output:** [`docs/sample_output/demo_3_erc7579_architecture.txt`](sample_output/demo_3_erc7579_architecture.txt)

---

## The Confidential HTTP Story (Privacy Track)

All four external API calls go through `ConfidentialHTTPClient` — the DON's encrypted HTTP channel:

| API | Secret ID | What stays in the DON |
|---|---|---|
| GoPlus (auth) | `AEGIS_GOPLUS_KEY` | App key + secret used in JWT exchange |
| GoPlus (data) | — | Token address queried via same confidential channel |
| BaseScan | `AEGIS_BASESCAN_SECRET` | API key for source code fetch |
| OpenAI (GPT-4o) | `AEGIS_OPENAI_SECRET` | API key + full contract source |
| Groq (Llama-3) | `AEGIS_GROQ_SECRET` | API key + full contract source |

The source code of potentially dangerous contracts — containing full Solidity — is sent to AI models via `ConfidentialHTTPClient`. It never appears in any on-chain transaction or public log.

---

## Registering CRE Secrets

Secrets must be registered once with the CRE CLI before the oracle can use them:

```bash
cre workflow secrets set --id AEGIS_BASESCAN_SECRET  --value <your-basescan-key>
cre workflow secrets set --id AEGIS_OPENAI_SECRET    --value <your-openai-key>
cre workflow secrets set --id AEGIS_GROQ_SECRET      --value <your-groq-key>
cre workflow secrets set --id AEGIS_GOPLUS_KEY       --value <your-goplus-app-key>
cre workflow secrets set --id AEGIS_GOPLUS_SECRET    --value <your-goplus-app-secret>
```

If `AEGIS_GOPLUS_KEY` is not registered, GoPlus runs unauthenticated (free tier) via the same confidential channel. The AI pipeline is unaffected.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| VNet out of blocks | Script auto-provisions a new one, or run `.\scripts\new_tenderly_testnet.ps1` |
| Docker not running | Start Docker Desktop, then `docker compose up --build -d` |
| `secret not found` | Register secrets with `cre workflow secrets set` (see above) |
| CRE returns `riskCode=0` for everything | Check if oracle is running: `docker logs aegis-oracle-node` |
| Uniswap swap reverts | Pool snapshot may have low liquidity — try re-provisioning VNet |
