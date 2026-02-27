# 🛡️ Aegis Protocol V4: The Institutional AI Firewall

> **ERC-7579 Executor Module · Chainlink CRE Oracle · Account Abstraction (ERC-4337)**
>
> *Aegis is a zero-custody AI security firewall that installs onto your Smart Account and mathematically constrains what an autonomous AI agent can do with your capital.*

[![Forge Tests](https://img.shields.io/badge/forge%20tests-7%20passing-brightgreen)](test/AegisModule.t.sol)
[![Jest Tests](https://img.shields.io/badge/jest%20tests-12%20passing-brightgreen)](test/)
[![CRE Live](https://img.shields.io/badge/chainlink%20CRE-live%20simulation%20passing-blue)](cre-node/)
[![ERC-7579](https://img.shields.io/badge/ERC--7579-executor-orange)](src/AegisModule.sol)

---

## 🚨 The Problem: The Briefcase of Cash

Giving an autonomous AI trading agent your private key is like handing a robot a briefcase full of cash and hoping it doesn't get robbed or manipulated. Every Eliza agent, every sniper bot operating today does exactly this.

**Aegis V4 takes a completely different approach.**

---

## 🏦 The Solution: The Corporate Bank Account

Think of your wallet as a **Corporate Bank Account**. The AI agent operates within strict, programmatic limits set by the human owner. The Aegis Protocol is the **Compliance Department** that intercepts every trade intent before any capital moves.

> [!IMPORTANT]
> **Transparency Note:** The diagrams below distinguish what is **running today** in V4 from what is on the **production roadmap**. Judges, auditors, and technical reviewers: please read both.

---

### What V4 Runs Today (Live on Tenderly Base Fork)

```
AI Agent (EOA with private key — budget enforced on-chain)
         │
         │  cast send / viem direct RPC tx
         ▼
   AegisModule.sol (ERC-7579 Executor — deployed, verified)
         │
    requestAudit(token) ──►  AuditRequested event emitted on-chain
         │
         ▼
   Chainlink CRE DON  (live Docker node)
   ┌─────────────────────────────────────┐
   │  GoPlus Security API  (live)        │
   │  BaseScan ConfidentialHTTP (live)   │
   │  GPT-4o  +  Llama-3   (live)       │
   │  8-bit riskScore aggregated         │
   └─────────────────────────────────────┘
         │
    onReport(tradeId, riskScore)  ◄─  CRE node wallet signs & sends directly
         │
         ▼
   riskScore == 0 → triggerSwap() → Uniswap V3 SwapRouter02
   riskScore >  0 → ClearanceDenied — trade wiped, capital preserved
```

**What is NOT wired in V4** (agents use a funded EOA + private key, not a Smart Account):
- ERC-4337 EntryPoint / UserOperations / Bundler (Pimlico)
- ERC-7715 Session Key (no EIP-712 off-chain policy signature)
- Chainlink Keystone Forwarder (oracle delivers `onReport()` directly)

---

### Production Roadmap (V5 — Full AA Stack)

```
AI Agent  (ERC-7715 Session Key — cryptographic budget policy)
         │
         │  signs ERC-4337 UserOperation → Pimlico Bundler
         ▼
   ERC-4337 EntryPoint
         │
         ▼
   Safe Smart Account  (ERC-7579 — installModule: AegisModule)
         │
    requestAudit(token)  ──►  AuditRequested event
         │
         ▼
   Chainlink CRE DON  (same oracle, same 8-bit risk matrix)
         │
    Chainlink Keystone Forwarder  ──►  onReport(tradeId, riskScore)
         │
         ▼
   riskScore == 0 → executeFromExecutor()
         │
         ▼
   Safe Smart Account executes Uniswap swap
   (Zero capital ever in the module — true zero-custody)
```

**Security invariant (V4 and V5):** The oracle is the same, the 8-bit risk matrix is the same, the module logic is the same. V5 adds the AA custody layer on top — the oracle and module require no changes.

---


## 🎬 Demo Scripts

> **See [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) for the full guide** — prerequisites, step-by-step instructions per demo, expected CRE log output, and what judges should look for.

All three demos run automatically via PowerShell. The VNet health check at the top of each script auto-provisions a fresh Tenderly VNet if blocks are exhausted.

```powershell
# Run any demo in non-interactive mode (for CI/logging)
.\scripts\demo_1_cre_oracle.ps1
.\scripts\demo_2_multi_agent.ps1
.\scripts\demo_3_erc7579_architecture.ps1

# Run interactive with narrated pauses (for recording)
.\scripts\demo_1_cre_oracle.ps1 -Interactive
```

### Demo 1 — The AI Black Box
**What it shows:** The complete Chainlink CRE oracle pipeline on a single real token (BRETT).

1. `depositETH()` + `subscribeAgent(NEXUS, 0.05 ETH)` — agent hired, budget set
2. `requestAudit(BRETT)` → `AuditRequested` event emitted on-chain
3. `cre workflow simulate` — WASM sandbox activates:
   - **Phase 1:** GoPlus API (live) → `honeypot=0 sellRestriction=0 unverified=0`
   - **Phase 2:** BaseScan via `ConfidentialHTTPClient` → 52,963 chars of real `BrettToken.sol` — **API key never left the DON**
   - **Phase 3:** GPT-4o + Llama-3 both read the real source → `Risk Code: 0`
4. Oracle verdict committed on-chain → `isApproved[BRETT] = TRUE`

See: [`docs/sample_output/demo_1_cre_oracle.txt`](docs/sample_output/demo_1_cre_oracle.txt)

### Demo 2 — The Firewall That Runs Itself
**What it shows:** Three AI agents, three simultaneous trade intents, real CRE oracle for every one.

- `NOVA` → BRETT → CRE: Risk Code 0 → `ClearanceUpdated(BRETT, true)` → real Uniswap V3 swap ✅
- `CIPHER` → TaxToken → CRE: Risk Code 18 (sell restriction + obfuscated tax) → `ClearanceDenied` ⛔
- `REX` → HoneypotCoin → CRE: Risk Code 36 (honeypot + privilege escalation by AI) → `ClearanceDenied` ⛔
- REX tries bypass → `triggerSwap()` reverts `TokenNotCleared` ✅
- Owner fires REX → `revokeAgent(REX)` → any REX call reverts `NotAuthorized` ✅

See: [`docs/sample_output/demo_2_multi_agent.txt`](docs/sample_output/demo_2_multi_agent.txt)

### Demo 3 — ERC-7579 Architecture Walk-Through
**What it shows:** The full ERC-7579 executor module lifecycle with real CRE oracle for TOSHI.

1. Module installed on Smart Account via `onInstall()`
2. PHANTOM agent subscribed with 0.02 ETH budget
3. `requestAudit(TOSHI)` → CRE oracle runs → Risk Code 0 → `isApproved[TOSHI] = TRUE`
4. `triggerSwap(TOSHI, 0.01 ETH)` → clearance consumed (anti-replay) → `isApproved[TOSHI] = FALSE`
5. Second swap attempt reverts with `TokenNotCleared` → CEI pattern proven
6. `killSwitch()` → agent deauthorized
7. `onUninstall()` → module removed from account

See: [`docs/sample_output/demo_3_erc7579_architecture.txt`](docs/sample_output/demo_3_erc7579_architecture.txt)

---

## ✅ Confirmed Clean Tokens (Base Mainnet)

All verified through real CRE oracle — GoPlus live API + BaseScan source fetch + GPT-4o + Llama-3:

| Token | Address | CRE Risk Code | Both AI Models |
|---|---|---|---|
| BRETT | `0x532f27101965dd16442E59d40670FaF5eBB142E4` | **0** | All flags false |
| TOSHI | `0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4` | **0** | All flags false |
| DEGEN | `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` | **0** | All flags false |
| WETH (native) | `0x4200000000000000000000000000000000000006` | **0** | All flags false |

---

## 🗂️ Repository Structure

```
aegis-v4/
├── src/
│   └── AegisModule.sol              # ← The core ERC-7579 executor module
│
├── cre-node/
│   ├── aegis-oracle.ts              # ← CRE oracle: GoPlus + BaseScan + GPT-4o + Llama-3
│   ├── workflow.yaml                # ← CRE workflow config (EVM log trigger)
│   ├── project.yaml                 # ← CRE project config (chain + RPC)
│   ├── config.json                  # ← Runtime config (AegisModule address)
│   └── secrets.yaml                 # ← Maps secret IDs to .env vars
│
├── scripts/
│   ├── new_tenderly_testnet.ps1     # ← One-command VNet provisioner + auto-verify
│   ├── start_oracle.ps1             # ← Starts Chainlink CRE Docker node
│   ├── demo_1_cre_oracle.ps1        # ← Demo 1: BRETT real CRE oracle pipeline
│   ├── demo_2_multi_agent.ps1       # ← Demo 2: 3 agents, real CRE for each token
│   └── demo_3_erc7579_architecture.ps1  # ← Demo 3: Full ERC-7579 lifecycle + TOSHI CRE
│
├── test/
│   ├── AegisModule.t.sol            # ← 7 Forge TDD tests
│   ├── oracle.spec.ts               # ← 6 Jest tests (ABI encoding, risk matrix)
│   └── bot.spec.ts                  # ← 6 Jest tests (calldata, BYOA safety)
│
├── docs/
│   ├── ARCHITECTURE.md              # ← System architecture (12 Mermaid diagrams)
│   ├── CONFIDENTIAL_HTTP.md         # ← Privacy track: ConfidentialHTTPClient deep-dive
│   ├── DEMO_GUIDE.md                # ← How to run demos, what judges see
│   ├── LESSONS_LEARNED.md           # ← Engineering ledger (bugs + fixes)
│   └── sample_output/               # ← Real CRE oracle log files from demo runs
│
└── docker-compose.yaml              # ← CRE oracle Docker environment
```

---

## ⚡ Quickstart

### Prerequisites
- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`)
- [pnpm](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Tenderly account + API key (for VNet)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Run smart contract tests
```bash
forge test --match-contract AegisModuleTest -vv
# Expected: 7 passed, 0 failed
```

### 3. Run TypeScript tests
```bash
pnpm exec jest
# Expected: 12 passed, 0 failed
```

### 4. Provision a fresh Tenderly VNet & deploy AegisModule
```powershell
cp .env.example .env   # Fill in your keys
.\scripts\new_tenderly_testnet.ps1
```

### 5. Start the Chainlink CRE oracle node
```powershell
.\scripts\start_oracle.ps1
# cre-setup runs automatically on first container start
```

### 6. Run the live integration
```bash
# Trigger an audit (emits AuditRequested on-chain)
cast send --rpc-url $TENDERLY_RPC_URL --private-key $PRIVATE_KEY \
  $AEGIS_MODULE_ADDRESS "requestAudit(address)" 0x000000000000000000000000000000000000000a

# In the Docker container, simulate the oracle:
docker exec aegis-oracle-node bash -c \
  "cd /app && cre workflow simulate /app \
   --evm-tx-hash <YOUR_TX_HASH> \
   --evm-event-index 0 \
   --non-interactive --trigger-index 0 \
   -R /app -T tenderly-fork"
```

---

## 🔐 The 3-Step Security Loop

### Step 1 — Agent Submits Trade Intent
The AI agent (holding only gas ETH) sends a UserOp calling `AegisModule.requestAudit(token)`. This emits `AuditRequested` on-chain. **No capital moves yet.**

> **Key security property:** The agent can only choose *which token* to request. **The firewall rules (`firewallConfig`) are set by the human owner** via `setFirewallConfig()` and are stored on-chain in the module. The agent cannot modify them. An agent cannot loosen its own leash.

### Step 2 — Chainlink CRE Renders Verdict
The Chainlink CRE DON catches the event and runs a multi-phase audit against the **owner-defined** `firewallConfig` (emitted alongside the trade intent):
- **GoPlus** — static on-chain analysis (honeypot, sell restriction, proxy)
- **BaseScan** — source code retrieval (via Confidential HTTP)
- **GPT-4o + Llama-3** — dual-model AI consensus (obfuscated tax, privilege escalation, logic bombs)

The result is an **8-bit risk matrix** delivered to `AegisModule.onReport(tradeId, riskScore)` through the Chainlink KeystoneForwarder. **Only the KeystoneForwarder can call this function.**

### Step 3 — JIT Swap (or Hard Block)
- `riskScore == 0` → `triggerSwap()` is unblocked. The module calls `executeFromExecutor()` on the Smart Account. Capital moves.
- `riskScore > 0` → `ClearanceDenied` emitted. Trade blocked. **Zero capital at risk.**

---

## 🏗️ Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture deep-dive.

| Layer | Technology | Role |
|---|---|---|
| Smart Account | ERC-4337 (Safe) | Holds all capital |
| Session Key | ERC-7715 | Agent signing authority (gas only) |
| Security Module | ERC-7579 Executor | This repo — `AegisModule.sol` |
| Oracle | Chainlink CRE DON | Off-chain AI audit + on-chain callback |
| Bundler | Pimlico | ERC-4337 UserOp relay |

---

## 📊 The 8-Bit Risk Matrix

| Bit | Flag | Source |
|---|---|---|
| 0 | Unverified source code | GoPlus |
| 1 | Sell restriction | GoPlus |
| 2 | Honeypot | GoPlus |
| 3 | Proxy contract | GoPlus |
| 4 | Obfuscated tax | AI (GPT-4o + Llama-3) |
| 5 | Privilege escalation / transfer allowlist honeypot | AI |
| 6 | External call risk | AI |
| 7 | Logic bomb | AI |

---

## 🔗 Links

- [**Demo Guide**](docs/DEMO_GUIDE.md) ← how to run all 3 demos, what to look for
- [**Confidential HTTP**](docs/CONFIDENTIAL_HTTP.md) ← Privacy track deep-dive
- [System Architecture](docs/ARCHITECTURE.md) ← 12 Mermaid diagrams
- [Engineering Ledger](docs/LESSONS_LEARNED.md)
- [Smart Contract](src/AegisModule.sol)
- [CRE Oracle](cre-node/aegis-oracle.ts)
- [Chainlink CRE Docs](https://docs.chain.link/cre)
- [Rhinestone ModuleKit](https://docs.rhinestone.wtf)
- [ERC-7579 Standard](https://eips.ethereum.org/EIPS/eip-7579)
