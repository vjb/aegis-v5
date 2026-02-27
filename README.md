# 🛡️ Aegis Protocol V4: The Institutional AI Firewall

**An ERC-7579 Executor Module that provides military-grade, Just-In-Time (JIT) security for autonomous AI trading agents.**

> **The session key limits the blast radius. Aegis prevents the explosion.**

---

## 🚨 The Problem: The Briefcase of Cash

The Web3 AI landscape is the Wild West. To deploy an autonomous trading agent — ElizaOS, a sniper bot, a DeFi strategy runner — users are forced to paste raw private keys into `.env` files or Telegram chats.

**Giving an AI agent a private key is like handing a robot a briefcase full of cash and hoping it doesn't get tricked.**

If the AI hallucinates, gets prompt-injected, or falls for a honeypot token, the wallet is drained instantly. No recourse. No firewall. No warning.

### "But what about ERC-7715 Session Keys?"

Session keys solve the *authorization* problem, not the *intelligence* problem. A session key can restrict an AI bot to a 2 ETH budget — but if that AI gets tricked into buying a malicious rug-pull token, the Smart Account will happily execute the trade and lose all 2 ETH.

**Session keys limit the blast radius. Aegis prevents the explosion.**

---

## 💡 The V4 Solution: The Corporate Bank Account

Aegis V4 moves beyond the monolithic "Smart Treasury" model and upgrades to the full **Account Abstraction** stack.

Think of the user's wallet as a Corporate Bank Account:

| Layer | Standard | Role |
|---|---|---|
| **The Bank** | ERC-4337 | User holds funds in a secure Smart Account (e.g. Safe) |
| **The Security Plugin** | ERC-7579 | `AegisModule` installs directly on the Smart Account — holds zero funds, acts as a security gateway |
| **The Corporate Card** | ERC-7715 | User issues a mathematically restricted Session Key to their AI agent ("Max budget: 2 ETH, routed through Aegis") |
| **The Compliance Department** | Chainlink CRE | Intercepts every trade intent and runs a parallel multi-model LLM audit before funds can move |

---

## ⚙️ The Execution Loop

When the AI Agent spots a trading opportunity, the following JIT sequence fires:

```
AI Agent signs UserOp
      │
      ▼
ERC-4337 Bundler
      │  (verifies ERC-7715 session key, enforces budget cap)
      ▼
AegisModule.executeFromExecutor()   ← ERC-7579 Executor
      │  emits AuditRequested — NO FUNDS MOVE YET
      ▼
Chainlink CRE Node (WASM enclave)
      │  ┌─ GoPlus static analysis (DON node-mode, BFT median consensus)
      │  ├─ BaseScan source fetch (Confidential HTTP, proxy-piercing)
      │  └─ GPT-4o + Llama-3 parallel audit (Confidential HTTP, Union-of-Fears)
      │  risk matrix: 8-bit flag (honeypot│sell-restriction│obfuscated-tax│logic-bomb…)
      ▼
onReport(tradeId, riskScore) → AegisModule
      │  riskScore == 0 → CLEARED
      │  riskScore  > 0 → BLOCKED, emit ClearanceDenied(token, riskScore)
      ▼
Smart Account executes swap via Uniswap V3
      │  tokens land back in Smart Account cold storage
      ▼
SwapExecuted event ✅
```

**No funds move until the Chainlink CRE DON delivers a clean verdict.**
If the oracle times out or denies clearance, the transaction is abandoned atomically.

---

## 🔐 Security Layers — All Three Must Pass

| Layer | Mechanism | What it prevents |
|---|---|---|
| **Budget Cap** | `agentAllowances[agent]` decremented atomically on-chain | Agent spending beyond its grant |
| **Firewall** | CRE DON risk audit (8-bit riskMatrix, BFT consensus) | Honeypots, rug-pulls, logic bombs, sell-restriction scams |
| **Clearance** | `isApproved[token]` reset after every swap (CEI) | Replay attacks; the same approval cannot be used twice |

---

## 🛠️ Technology Stack

### Smart Contracts (Foundry)
- **Rhinestone ModuleKit** — ERC-7579 module scaffolding, testing harness
- **`AegisModule.sol`** — Type-2 Executor Module; emits `AuditRequested`, enforces clearance before calling `executeFromExecutor`
- **Uniswap V3 SwapRouter02** — `exactInputSingle` with 3-tier fee fallback (0.3% → 0.05% → 1%)

### Off-Chain Oracle (Chainlink CRE)
- **Chainlink Runtime Environment** — decentralized WASM compute over a DON
- **Node-mode consensus** — `ConsensusAggregationByFields` with `median` aggregation for Byzantine-fault-tolerant flag voting
- **Confidential HTTP** — BaseScan source fetch and LLM calls run inside a secure enclave; API keys and proprietary prompts never leave the enclave
- **Dual-model AI** — GPT-4o + Llama-3.1 ("Union of Fears": a risk is flagged if either model flags it)

### Agentic Execution (TypeScript)
- **`permissionless.js`** + **`viem`** — ERC-4337 UserOperation construction and submission
- **Pimlico Bundler** — UserOp infrastructure
- **BYOA pattern** — agent wallet holds gas ETH only; all trading capital stays in the Smart Account

### Simulation & Testing
- **Foundry / Anvil** — local fork testing
- **Tenderly Virtual TestNets** — Base mainnet fork with state override and simulation API

---

## 📂 Repository Structure

```
aegis-v4/
├── contracts/                  # Foundry project
│   ├── src/
│   │   └── AegisModule.sol     # ERC-7579 Executor Module
│   └── test/
│       └── AegisModule.t.sol   # ModuleKit test suite
├── cre-node/                   # Chainlink CRE oracle
│   ├── aegis-oracle.ts         # CRE workflow handler
│   └── workflow.yaml           # CRE workflow config
├── agent/                      # TypeScript trading agent
│   └── bot.ts                  # BYOA agent (UserOp submitter)
├── aegis-frontend/             # Agentic Command Center UI
├── .agent/
│   └── skills/
│       └── aegis-v3-architecture.md
├── docs/
│   └── ERC7579_ROADMAP.md
├── .env.example
└── README.md
```

---

## 🚀 Quickstart

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [pnpm](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/) (for the CRE node)

### 1. Install Dependencies

```bash
pnpm install
forge install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Fill in: PIMLICO_API_KEY, OPENAI_API_KEY, GROQ_API_KEY,
#          BASESCAN_API_KEY, TENDERLY_KEY, TENDERLY_RPC_URL
```

### 3. Run the Test Suite

Verify the ERC-7579 execution loop — Smart Account deployment → Module installation → Mock oracle callback → JIT swap execution:

```bash
forge test -vvv
```

### 4. Run the End-to-End Simulation

```bash
# 1. Start the Chainlink CRE Oracle Node
docker-compose up -d

# 2. Run the AI Trading Bot (submits UserOps via Pimlico Bundler)
pnpm run start:agent
```

---

## 📖 Background: V3 → V4 Evolution

Aegis V3 was a standalone **Smart Treasury Vault** — users deposited ETH directly into `AegisVault.sol`, which held both funds and security logic. V3 proved the core concept: the Chainlink CRE DON can intercept trade intents, run multi-model AI consensus, and gate on-chain execution with sub-second latency.

V4 refactors this into a **composable security plugin** for the emerging Account Abstraction ecosystem. The vault is replaced by the user's own Smart Account (Safe, Kernel, or any ERC-4337 compliant wallet). The `AegisModule` is a pure ERC-7579 Executor that can be installed and uninstalled without moving funds.

See [docs/ERC7579_ROADMAP.md](docs/ERC7579_ROADMAP.md) for the full architectural evolution.

---

## 📜 License

MIT — see [`LICENSE`](LICENSE) for details.
