# Aegis Protocol V5 — Presentation Content Reference

> This file is the single source of truth for agents generating illustrations, infographics, and presentations about Aegis Protocol V5. Everything here reflects the project as it currently stands on Base Sepolia.

---

## What Aegis Is (One Sentence)

Aegis is a zero-custody AI security firewall — an ERC-7579 smart contract module that intercepts every AI-agent trade intent, routes it through a dual-LLM oracle running inside Chainlink CRE, and blocks the transaction on-chain if either model detects malicious patterns.

---

## The Problem Aegis Solves

AI trading bots require users to hand over private keys. If the bot encounters a honeypot token, scam contract, or compromised API — the user's capital is gone. There is no security layer between the AI agent and the user's money.

**Aegis is that security layer.** It enforces three constraints:

1. **Zero Custody** — Capital stays in a Safe Smart Account. The owner keeps the keys.
2. **Budget Limits** — Each AI agent gets an ETH budget on-chain. Exceeding it reverts.
3. **Per-Trade AI Clearance** — Every trade intent is audited by two independent LLMs before execution. Fail = revert. No capital at risk.

---

## The Tech Stack

| Layer | Standard | Implementation |
|---|---|---|
| **Smart Account** | ERC-4337 | Safe + Pimlico Bundler + EntryPoint v0.7 |
| **Module** | ERC-7579 | AegisModule — Type-2 Executor (on-chain, verified) |
| **Session Keys** | ERC-7715 | SmartSessions — agent signs UserOps, owner key never used |
| **Oracle** | Chainlink CRE | WASM-compiled TypeScript — GoPlus + BaseScan + GPT-4o + Llama-3 |
| **Privacy** | ConfidentialHTTPClient | All API keys sealed inside DON enclave — never exposed |

---

## On-Chain Contracts (Base Sepolia · Chain ID 84532)

| Contract | Address | Status |
|---|---|---|
| AegisModule (ERC-7579 Executor) | `0x23EfaEF29EcC0e6CE313F0eEd3d5dA7E0f5Bcd89` | Verified on BaseScan |
| Safe + SmartSessions | `0xb9ff55a887727AeF9C56e7b76101693226eA9a91` | Session Keys Active |
| MockBRETT (safe token) | `0x46d40e0abda0814bb0cb323b2bb85a129d00b0ac` | Deployed |
| MockHoneypot (malicious) | `0xf672c8fc888b98db5c9662d26e657417a3c453b5` | Deployed |
| MaliciousRugToken (unverified) | `0x99900d61f42bA57A8C3DA5b4d763f0F2Dc51E2B3` | Deployed (no source) |

Owner wallet: `0x109D8072B1762263ed094BC05c5110895Adc65Cf`

---

## The Trade Lifecycle (Step by Step)

1. **Owner deposits ETH** into AegisModule treasury
2. **Owner subscribes an AI agent** with a scoped ETH budget (e.g., 0.05 ETH)
3. **Agent detects** an alpha opportunity (e.g., BRETT token)
4. **Agent signs a UserOp** with its ERC-7715 session key (owner key not used)
5. **Pimlico Bundler** relays the UserOp → SmartSessions validates → AegisModule receives `requestAudit(BRETT)`
6. **AuditRequested event** emitted on-chain
7. **Chainlink CRE DON** intercepts the event and runs the WASM oracle:
   - **Phase 1 — GoPlus:** Token security data (honeypot, sell restriction, proxy, unverified)
   - **Phase 2 — BaseScan:** Fetches full Solidity source via ConfidentialHTTPClient
   - **Phase 3 — AI Consensus:** GPT-4o and Llama-3 independently analyze source code
8. **Union of Fears** — if either model flags a risk, the corresponding bit is set in the 8-bit risk code
9. **Oracle callback** delivers `onReportDirect(tradeId, riskCode)` to AegisModule
10. **If riskCode = 0:** Token is cleared → agent submits `triggerSwap()` → swap executes, budget deducted
11. **If riskCode > 0:** Token is blocked → `triggerSwap()` reverts with `TokenNotCleared()` — zero capital lost

---

## The 8-Bit Risk Matrix

| Bit | Flag | Detection Source |
|---|---|---|
| 0 | Unverified source code | GoPlus |
| 1 | Sell restriction | GoPlus |
| 2 | Honeypot | GoPlus |
| 3 | Proxy contract | GoPlus |
| 4 | Obfuscated tax | AI (GPT-4o + Llama-3) |
| 5 | Privilege escalation | AI |
| 6 | External call risk | AI |
| 7 | Logic bomb | AI |

The owner configures which bits matter via `setFirewallConfig()`. The CRE oracle reads the owner's config from the `AuditRequested` event and applies those toggles to every check.

**Example:** `riskCode = 36` = `0b00100100` = Bit 2 (Honeypot) + Bit 5 (Privilege Escalation) → BLOCKED

---

## The AI Prompts (Three Distinct Strategies)

| Prompt | Model | Input | Trigger |
|---|---|---|---|
| CRE Oracle Audit | GPT-4o + Llama-3 (temp=0) | Verified Solidity source from BaseScan | `requestAudit()` on-chain |
| Heimdall Bytecode | GPT-4o (temp=0) | Decompiled pseudocode from bytecode | When no source is published |
| Chat Interface | GPT-4o (temp=0.7, streaming) | Live chain state (agents, balances, verdicts) | User message in dashboard |

The CRE Oracle prompt receives **runtime-injected variables** from the owner's on-chain firewall config (maxTax%, blockProxies, blockHoneypots). Both GPT-4o and Llama-3 get the same prompt — their boolean outputs are combined with bitwise OR.

---

## ConfidentialHTTPClient (Privacy Track)

All five external API calls in the CRE oracle use `ConfidentialHTTPClient`:

| API | What is Protected |
|---|---|
| GoPlus JWT auth | App credentials |
| GoPlus token_security | Token address queried before trade |
| BaseScan source fetch | API key + contract being audited |
| OpenAI GPT-4o | API key + full Solidity source |
| Groq Llama-3 | API key + full Solidity source |

Secrets are registered by ID in the DON vault (`cre workflow secrets set --id AEGIS_OPENAI_SECRET --value <key>`). The secret value is never in source code. It is injected at runtime inside the WASM sandbox. No node operator can read the request or response.

---

## Heimdall Bytecode Pipeline (Experimental)

**Status:** Standalone demo. Not wired into the live CRE oracle.

**What it proves:** Aegis can audit contracts with no verified source code. Raw EVM bytecode is decompiled locally via Heimdall-rs, then analyzed by GPT-4o.

Pipeline: `eth_getCode` (19,666 hex chars) → Heimdall Docker (symbolic execution → 15,000 chars Solidity-like pseudocode) → GPT-4o (forensic analysis) → 8-bit risk code

**Live result:** MaliciousRugToken (5 embedded vulnerabilities: 95% hidden tax, selfdestruct, unlimited mint, blocklist, seller allowlist) was correctly flagged as `is_malicious: true` from bytecode alone.

---

## Session Keys (ERC-7715)

The AI agent holds a session key — a scoped, limited-permission key that can only call `requestAudit()` and `triggerSwap()` on AegisModule. The owner's private key is never used for trade operations.

**On-chain evidence:** [tx 0xe1cae604...](https://sepolia.basescan.org/tx/0xe1cae6043ad913f0d949b4551239c3b1de18f959c71fd107b1605256a2d1398d)

---

## Owner Controls

| Function | What It Does |
|---|---|
| `depositETH()` | Fund the module treasury |
| `subscribeAgent(addr, budget)` | Grant agent a scoped ETH budget |
| `revokeAgent(addr)` | Instantly zero agent's budget (kill switch) |
| `setFirewallConfig(config)` | Set vault-wide AI firewall policy (8 toggles) |
| `withdrawETH(amount)` | Withdraw ETH to owner |

The owner can revoke any agent at any time. Budget is zeroed instantly. The agent cannot override the firewall config.

---

## What's Simulated (and Why)

| What We Do | What Production Looks Like | Why |
|---|---|---|
| `cre workflow simulate` | `cre workflow deploy` to live DON | DON deployment requires Chainlink team approval |
| AegisModule deployed standalone | `installModule(TYPE_EXECUTOR, aegis)` on Safe | Requires Rhinestone Registry attestation |
| Swap emits `SwapExecuted` event | Uniswap V3 `exactInputSingle` | No DEX liquidity on testnet |
| Owner calls `onReportDirect()` | KeystoneForwarder delivers DON-signed report | Part of CRE production infrastructure |

Every simulation gap is a platform limitation, not missing code. The contract, oracle, and session key infrastructure are production-ready.

---

## Demo Scripts

| Script | Duration | What It Proves |
|---|---|---|
| `demo_v5_setup.ps1` | ~2 min | Docker, WASM compilation, Base Sepolia connectivity |
| `demo_v5_master.ps1` | ~5 min | Full 7-act lifecycle: treasury → agents → audit → CRE → swap/revert → budget → kill switch |
| `demo_v5_cre.ps1` | ~3 min | Raw CRE WASM execution for Chainlink judges |
| `demo_v5_heimdall.ps1` | ~2 min | Bytecode decompilation → GPT-4o detects malicious contract |

---

## Frontend Dashboard

| Feature | Status |
|---|---|
| 3-panel command center (Agents, Firewall, Audit Log, Marketplace) | Live |
| AI chat interface with real treasury balance and dynamic agent list | Live |
| Oracle feed via SSE (live CRE audit stream) | Live |
| Kill switch with PROTOCOL LOCKED banner | Live |
| 5 marketplace bots (BLUECHIP, YIELD, DEGEN, SAFE, HEIMDALL) | Live |
| 8-bit firewall toggle switches synced with on-chain config | Live |
| Trade simulation modal with token picker and oracle trigger | Live |

---

## Hackathon Tracks

| Track | Key Feature |
|---|---|
| **Risk & Compliance** | 8-bit risk matrix, owner-configurable firewall, CRE WASM pipeline |
| **CRE & AI** | Dual-LLM consensus (GPT-4o + Llama-3) inside CRE WASM sandbox |
| **Privacy** | ConfidentialHTTPClient for all 5 API calls — keys sealed in DON |
| **Autonomous Agents** | Session key UserOps via ERC-7715 + Pimlico bundler |
| **DeFi & Tokenization** | AI-gated Smart Treasury — per-trade clearance, budget enforcement |

---

## Files Using Chainlink

| File | Role |
|---|---|
| `cre-node/aegis-oracle.ts` | CRE WASM Oracle — GoPlus + BaseScan + GPT-4o + Llama-3 |
| `cre-node/workflow.yaml` | CRE workflow definition |
| `cre-node/workflow.ts` | CRE entry point |
| `cre-node/config.json` | CRE node config |
| `cre-node/secrets.yaml` | Secret ID references for DON vault |
| `cre-node/Dockerfile` | Docker container for CRE node + Javy WASM compilation |
| `src/AegisModule.sol` | ERC-7579 Executor — `onReport()` callback from CRE |
| `test/oracle.spec.ts` | Oracle unit tests |
| `aegis-frontend/app/api/audit/route.ts` | Frontend API: CRE pipeline + `onReportDirect()` |
| `aegis-frontend/app/components/OracleFeed.tsx` | UI: SSE stream consumer |
| `scripts/v5_session_utils.ts` | Session key utility — Safe creation with SmartSessions |

---

## AI Acknowledgment

**Protocol:** GPT-4o + Llama-3 (CRE WASM) · **Development:** Google Antigravity, Gemini, Claude · **Media:** NotebookLM, Veo 3
