# 🛡️ Aegis Protocol V5: The Institutional AI Firewall

> **ERC-7579 Executor Module · Chainlink CRE Oracle · ERC-4337 Account Abstraction · ERC-7715 Session Keys**
>
> *Aegis is a zero-custody AI security firewall that installs onto your Smart Account and mathematically constrains what an autonomous AI agent can do with your capital.*

[![Forge Tests](https://img.shields.io/badge/forge%20tests-18%20passing-brightgreen)](test/AegisModule.t.sol)
[![Jest Tests](https://img.shields.io/badge/jest%20tests-83%20passing-brightgreen)](test/)
[![CRE Live](https://img.shields.io/badge/chainlink%20CRE-live%20on%20Base%20Sepolia-blue)](cre-node/)
[![ERC-7579](https://img.shields.io/badge/ERC--7579-executor-orange)](src/AegisModule.sol)
[![ERC-4337](https://img.shields.io/badge/ERC--4337-Pimlico%20bundler-purple)](scripts/v5_e2e_mock.ts)

---

## 🚨 The Problem: The Briefcase of Cash

Giving an autonomous AI trading agent your private key is like handing a robot a briefcase full of cash and hoping it doesn't get robbed or manipulated. Every Eliza agent, every sniper bot operating today does exactly this.

**Aegis V5 takes a completely different approach.**

---

## 🏦 The Solution: The Corporate Bank Account

Think of your wallet as a **Corporate Bank Account**. The AI agent operates within strict, programmatic limits set by the human owner. The Aegis Protocol is the **Compliance Department** that intercepts every trade intent before any capital moves.

---

### V5 Architecture (Live on Base Sepolia)

```
AI Agent  (ERC-7715 session key — scoped to requestAudit + triggerSwap only)
         │
         │  smartAccountClient.sendUserOperation()
         ▼
   Pimlico Cloud Bundler  (gas estimation, paymaster, EntryPoint submission)
         │
         ▼
   ERC-4337 EntryPoint 0.7  (on Base Sepolia)
         │
         ▼
   Safe Smart Account  (ERC-7579 — AegisModule installed as Executor)
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
    onReport(tradeId, riskScore)  ◄─  CRE node wallet signs & sends
         │
         ▼
   riskScore == 0 → triggerSwap() → Swap executes
   riskScore >  0 → ClearanceDenied — trade wiped, capital preserved
```

---

## 🎬 Demo Scripts

> **Two cinematic PowerShell scripts for the final Loom presentation.**

```powershell
# Act 0: Boot infrastructure (Docker, WASM compile, Base Sepolia connectivity)
.\scripts\demo_v5_setup.ps1 -Interactive

# Act 1-5: Full live E2E (zero-custody → session keys → audit → CRE → swap/revert)
.\scripts\demo_v5_master.ps1 -Interactive
```

### `demo_v5_setup.ps1` — Infrastructure Boot
- Verifies Base Sepolia connectivity (Chain ID 84532)
- Checks deployer wallet balance
- Rebuilds Chainlink CRE Docker container
- Compiles TypeScript oracle to WASM via Javy

### `demo_v5_master.ps1` — The God Mode Demo
- **Act 1 — The Bank:** Zero-custody treasury proof (AegisModule holds 0 ETH)
- **Act 2 — The Keys:** ERC-7715 session key display (selectors `0xe34eac65`, `0x684bceb0`)
- **Act 3 — The Intents:** `requestAudit` for MockBRETT + MockHoneypot on Base Sepolia
- **Act 4 — The AI Oracle:** **LIVE** `docker exec cre workflow simulate` — GPT-4o + Llama-3 consensus with color-coded streaming output
- **Act 5 — The Execution:** MockBRETT swap ✅ SUCCESS, MockHoneypot swap ❌ `TokenNotCleared()` REVERT

See: [`docs/sample_output/demo_v5_master_run1.txt`](docs/sample_output/demo_v5_master_run1.txt)

---

---

## ⚡ Quickstart

### Prerequisites
- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`)
- [pnpm](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Base Sepolia ETH (~0.05 ETH for gas)
- Pimlico API key (free tier)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Run smart contract tests
```bash
forge test --match-contract AegisModuleTest -vv
# Expected: 18 passed, 0 failed
```

### 3. Run TypeScript tests
```bash
pnpm exec jest
# Expected: 83 passed, 1 skipped
```

### 4. Deploy to Base Sepolia
```bash
cp .env.example .env   # Fill in PRIVATE_KEY, PIMLICO_API_KEY, BASE_SEPOLIA_RPC_URL
forge script script/DeployMocks.s.sol:DeployMocks \
  --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY --broadcast
```

### 5. Run the cinematic demo
```powershell
.\scripts\demo_v5_setup.ps1 -Interactive
.\scripts\demo_v5_master.ps1 -Interactive
```

---

## 🔐 The 3-Step Security Loop

### Step 1 — Agent Submits Trade Intent
The AI agent (holding only an ERC-7715 session key — scoped to `requestAudit` and `triggerSwap` only) sends a UserOp calling `AegisModule.requestAudit(token)`. This emits `AuditRequested` on-chain. **No capital moves yet.**

### Step 2 — Chainlink CRE Renders Verdict
The Chainlink CRE DON catches the event and runs a multi-phase audit:
- **GoPlus** — static on-chain analysis (honeypot, sell restriction, proxy)
- **BaseScan** — source code retrieval (via ConfidentialHTTPClient)
- **GPT-4o + Llama-3** — dual-model AI consensus (obfuscated tax, privilege escalation, logic bombs)

The result is an **8-bit risk matrix** delivered to `AegisModule.onReport(tradeId, riskScore)`.

### Step 3 — JIT Swap (or Hard Block)
- `riskScore == 0` → `triggerSwap()` is unblocked. The module executes the swap. Capital moves.
- `riskScore > 0` → `ClearanceDenied` emitted. Trade blocked. **Zero capital at risk.**

---

## 🏗️ Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full deep-dive with 12 Mermaid diagrams.

| Layer | Technology | Role |
|---|---|---|
| Smart Account | ERC-4337 (Safe) | Holds all capital |
| Session Key | ERC-7715 | Agent signing authority (scoped to 2 selectors) |
| Security Module | ERC-7579 Executor | This repo — `AegisModule.sol` |
| Oracle | Chainlink CRE DON | Off-chain AI audit + on-chain callback |
| Bundler | Pimlico Cloud | ERC-4337 UserOp relay + paymaster |

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

- [**Demo Guide**](docs/DEMO_GUIDE.md) ← how to run both demo scripts
- [**Confidential HTTP**](docs/CONFIDENTIAL_HTTP.md) ← Privacy track deep-dive
- [System Architecture](docs/ARCHITECTURE.md) ← 12 Mermaid diagrams
- [Bundler Strategy](docs/BUNDLER_STRATEGY_DECISION.md) ← Why Pimlico
- [Smart Contract](src/AegisModule.sol)
- [CRE Oracle](cre-node/aegis-oracle.ts)
- [Chainlink CRE Docs](https://docs.chain.link/cre)
- [Rhinestone ModuleKit](https://docs.rhinestone.wtf)
- [ERC-7579 Standard](https://eips.ethereum.org/EIPS/eip-7579)
