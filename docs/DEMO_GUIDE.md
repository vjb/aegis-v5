# 🎬 Aegis Protocol V5 — Demo Guide

> **Four demo scripts with interactive scene introductions. All live on Base Sepolia.**
>
> 💡 **Recording tip:** Run all scripts with `-Interactive` — each act pauses with a bordered intro box before executing. Press ENTER to advance.

---

## Prerequisites

| Requirement | How to check |
|---|---|
| Foundry (`forge`, `cast`) | `forge --version` |
| Docker Desktop (running) | `docker ps` |
| pnpm | `pnpm --version` |
| `.env` filled in | See `.env.example` |
| Base Sepolia ETH (~0.05) | `cast balance <your-address> --rpc-url https://sepolia.base.org` |
| Pimlico API key (free) | [dashboard.pimlico.io](https://dashboard.pimlico.io) — set `PIMLICO_API_KEY` in `.env` |

### One-Time Setup

```powershell
# 1. Copy and fill environment variables
cp .env.example .env
# Fill: PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, PIMLICO_API_KEY,
#       AEGIS_MODULE_ADDRESS, TARGET_TOKEN_ADDRESS, MOCK_HONEYPOT_ADDRESS

# 2. Deploy contracts to Base Sepolia (if not already deployed)
forge script script/DeployMocks.s.sol:DeployMocks \
  --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY --broadcast

# 3. Start the Chainlink CRE Docker oracle node
docker compose up --build -d
# Watch for: ✅ CRE TS SDK is ready to use.
```

---

## Running the Demos

```powershell
# Automated (for logging — no pauses)
.\scripts\demo_v5_setup.ps1
.\scripts\demo_v5_master.ps1

# Interactive (for recording — press ENTER between scenes)
.\scripts\demo_v5_setup.ps1 -Interactive
.\scripts\demo_v5_master.ps1 -Interactive

# CRE-only showcase for Chainlink judges
.\scripts\demo_v5_cre.ps1 -Interactive

# Heimdall bytecode decompilation (experimental)
.\scripts\demo_v5_heimdall.ps1 -Interactive
```

### Recommended Recording Order

1. **Setup** → proves infrastructure works
2. **Master** → complete lifecycle (the main event)
3. **CRE** → deep-dive for Chainlink/AI judges
4. **Heimdall** → bonus experimental feature

---

## Demo 1 — Infrastructure Boot ([`demo_v5_setup.ps1`](../scripts/demo_v5_setup.ps1)) · [sample output](sample_output/demo_v5_setup_run.txt)

**Time:** ~2 minutes
**Tracks:** CRE & AI · Risk & Compliance

### What It Proves

The decentralized bedrock is live. Base Sepolia is reachable, the dev wallet is funded, the Docker oracle container builds cleanly, and the WASM plugin compiles.

| Scene | What you see |
|---|---|
| 1 — Network | Chain ID 84532 confirmed, dev wallet balance shown |
| 2 — Docker | Container torn down and rebuilt from scratch |
| 3 — WASM | Javy compiles TypeScript oracle to `aegis-oracle.wasm` |

---

## Demo 2 — End-to-End Showcase ([`demo_v5_master.ps1`](../scripts/demo_v5_master.ps1)) · [sample output](sample_output/demo_v5_master_run.txt)

**Time:** ~5 minutes
**Tracks:** CRE & AI · Privacy · DeFi & Tokenization · Autonomous Agents

### What It Proves

The complete V5 lifecycle on Base Sepolia: zero-custody treasury, agent subscription with budgets, live CRE AI consensus, on-chain enforcement (swap success + revert), budget verification, and kill switch.

| Act | On-chain action | What you see |
|---|---|---|
| 1 — The Bank | `cast balance` module | AegisModule treasury verified (owner-controlled) |
| 2 — The Keys | `subscribeAgent()` × 2 | NOVA (0.05 ETH) + CIPHER (0.008 ETH) subscribed on-chain |
| 3 — The Intents | `requestAudit()` × 2 via **ERC-4337 UserOp** | Both audits submitted via Pimlico bundler, tx hashes printed |
| 4 — The Oracle | `docker exec cre simulate` | **LIVE CRE** — GoPlus → BaseScan → GPT-4o + Llama-3 |
| 5 — The Execution | `triggerSwap()` × 2 via **ERC-4337 UserOp** | MockBRETT ✅ SUCCESS, MockHoneypot ❌ `TokenNotCleared()` REVERT |
| 6 — Budget Check | `agentAllowances()` | Budget mathematically deducted after swap |
| 7 — Kill Switch | `revokeAgent(REX)` | Subscribe REX → revoke → prove agent is locked out |

### CRE Pipeline (Act 4)

```
Phase 1 — GoPlus (ConfidentialHTTPClient)
  [GoPlus] MOCK registry hit: MockHoneypot
  [GoPlus] unverified=0 sellRestriction=0 honeypot=1

Phase 2 — BaseScan (ConfidentialHTTPClient)
  [BaseScan] Using MOCK source for MockHoneypot (917 chars)

Phase 3 — AI Consensus (ConfidentialHTTPClient)
  [GPT-4o]  privilegeEscalation=true
  [GPT-4o]  Reasoning: The contract restricts transfers to an owner-controlled allowlist...
  [Llama-3] privilegeEscalation=true
  [Llama-3] Reasoning: MockHoneypot restricts transfers to owner-controlled allowlist...

⚖️ Final Risk Code: 36
```

### What Judges Should See

- Both AI models produce **independent** reasoning — not a consensus shortcut
- `ConfidentialHTTPClient` used for all API calls — keys never leave DON
- MockBRETT gets Risk Code 0 → swap succeeds
- MockHoneypot gets Risk Code 36 → swap **reverts** with `TokenNotCleared()`

> **Recording tip:** All scripts support `-Interactive` mode with bordered ActIntro boxes that explain each step before execution — perfect for recordings and live presentations.

---

## Demo 3 — CRE Deep Dive ([`demo_v5_cre.ps1`](../scripts/demo_v5_cre.ps1)) · [sample output](sample_output/demo_v5_cre_run.txt)

**Time:** ~3 minutes
**Tracks:** CRE & AI · Privacy

### What It Proves

The raw, unadulterated Chainlink CRE WASM execution. No frontend, no abstraction — just the oracle analyzing a known honeypot contract in real-time with full color-coded log streaming.

- Generates a live `requestAudit` transaction on Base Sepolia
- Runs `docker exec cre workflow simulate` with the real tx hash
- Streams raw WASM output: GoPlus (Yellow), GPT-4o (Cyan), Llama-3 (Magenta)
- Shows Confidential HTTP connections with animated spinners

---

## Demo 4 — Heimdall Bytecode Decompilation ([`demo_v5_heimdall.ps1`](../scripts/demo_v5_heimdall.ps1)) · [sample output](sample_output/demo_v5_heimdall_run.txt)

**Time:** ~2 minutes
**Tracks:** Risk & Compliance · CRE & AI

### What It Proves

Aegis can analyze contracts with **no verified source code**. Raw EVM bytecode is decompiled locally via Heimdall, then analyzed by GPT-4o to produce a risk verdict — zero external dependencies beyond the AI model.

| Scene | What you see |
|---|---|
| 1 — BaseScan Probe | Confirms target has no verified source code |
| 2 — Bytecode Fetch | `eth_getCode` retrieves raw EVM bytecode (13K+ hex chars) |
| 3 — Heimdall Decompile | Docker container decompiles bytecode to Solidity (~14K chars) |
| 4 — GPT-4o Analysis | AI analyzes decompiled code, produces 8-bit risk verdict |

> ⚠️ **Experimental:** This is a standalone pipeline, not yet wired into the live CRE oracle.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Docker not running | Start Docker Desktop, then `docker compose up --build -d` |
| `secret not found` | Register secrets with `cre workflow secrets set` |
| CRE returns `riskCode=0` for everything | Check oracle: `docker logs aegis-oracle-node` |
| Tx reverts on Base Sepolia | Check wallet balance: `cast balance <addr> --rpc-url https://sepolia.base.org` |
| WASM compilation fails | Run `docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"` |
| UserOp gas estimation fails | Check Pimlico dashboard for API credit balance (free tier: 10K/day) |
