# Aegis Protocol V5 — Hackathon Proof Points

> This document directly maps Aegis Protocol's V5 architecture to the Convergence Hackathon grading rubrics.

---

## Track Requirement Mappings

### Risk & Compliance

| Requirement | Implementation | Evidence |
|---|---|---|
| CRE Workflow Simulation | `cre workflow simulate` with multi-model AI consensus | [`demo_v5_master.ps1`](../scripts/demo_v5_master.ps1) |
| CRE-Only Showcase | Raw CRE output proving WASM sandbox + AI consensus + ConfidentialHTTP | [`demo_v5_cre.ps1`](../scripts/demo_v5_cre.ps1) |
| Blockchain + External API | CRE bridges GoPlus, BaseScan, OpenAI, and Groq into deterministic on-chain callback | [`cre-node/aegis-oracle.ts`](../cre-node/aegis-oracle.ts) |
| Automated Risk Monitoring | 8-bit risk matrix with owner-configurable firewall knobs | [`src/AegisModule.sol`](../src/AegisModule.sol) |
| Protocol Safeguard Triggers | `TokenNotCleared()` revert, `ClearanceDenied` event, `revokeAgent()` | [`test/AegisModule.t.sol`](../test/AegisModule.t.sol) |

### CRE & AI

| Requirement | Implementation |
|---|---|
| AI agents consuming CRE workflows | AI Trading Agent submits `requestAudit()` → CRE evaluates → `triggerSwap()` |
| Split-Brain AI Consensus | GPT-4o + Llama-3 run in parallel inside WASM sandbox, "Union of Fears" bitmask |
| Per-Field Median Consensus | `ConsensusAggregationByFields` absorbs LLM nondeterminism across DON nodes |
| Confidential HTTP for AI Privacy | All LLM + BaseScan calls via `ConfidentialHTTPClient` — keys never leave enclave |
| CRE Workflow Config | [`workflow.yaml`](../cre-node/workflow.yaml) · [`config.json`](../cre-node/config.json) |
| AI-in-the-Loop Execution | CRE callback directly controls whether agent can execute swap |

### Privacy

| Requirement | Implementation |
|---|---|
| Confidential HTTP for LLM Queries | GPT-4o + Llama-3 via `ConfidentialHTTPClient` (`confidential-http@1.0.0-alpha`) |
| Confidential Source Retrieval | BaseScan API key sealed inside DON — never exposed |
| Protection of Protocol IP | Threat-detection prompts encrypted in transit, invisible to node operators |
| Full Documentation | [`CONFIDENTIAL_HTTP.md`](CONFIDENTIAL_HTTP.md) |

### Autonomous Agents

| Requirement | Implementation |
|---|---|
| `cre simulate` execution | `docker exec cre workflow simulate` with real Base Sepolia tx |
| On-chain write on CRE-supported testnet | `requestAudit()` + `onReportDirect()` + `triggerSwap()` on Base Sepolia |
| Agent-driven execution | AI agent submits UserOps via Pimlico bundler — no human in the loop |
| BYOA (Bring Your Own Agent) | Any external agent can be subscribed via `subscribeAgent(address, uint256)` |

### DeFi & Tokenization

| Requirement | Implementation |
|---|---|
| Novel DeFi primitive | JIT Smart Treasury — AI-gated, budget-enforced token execution |
| CRE as DeFi orchestration layer | Multi-model AI audit governs per-token clearance for swap execution |
| Live ERC-20 balance changes | Cleared swaps produce real, verifiable token balance changes on Base Sepolia |

---

## Test Suite Evidence

| Suite | Tests | Status | Evidence |
|---|---|---|---|
| **Forge (Solidity)** | 21 | ✅ All passing | [`forge_tests.txt`](sample_output/forge_tests.txt) |
| **Jest (TypeScript)** | 99 | ✅ (2 visualizer side-quest) | [`jest_tests.txt`](sample_output/jest_tests.txt) |
| **Heimdall Live** | 6 | ✅ All passing (live GPT-4o) | [`heimdall_tests.txt`](sample_output/heimdall_tests.txt) |
| **Frontend UI** | 42/50 | ✅ Tested | [`UI_TEST_MATRIX.md`](UI_TEST_MATRIX.md) |
| **Total** | **168** | | |

> Full QA report: [`TEST_REPORT.md`](sample_output/20260301_195604/TEST_REPORT.md)

---

## On-Chain Contracts (Base Sepolia · Chain ID 84532)

| Contract | Address | Verified |
|---|---|---|
| **AegisModule** (ERC-7579) | [`0x23EfaEF29EcC0e6CE313F0eEd3d5dA7E0f5Bcd89`](https://sepolia.basescan.org/address/0x23efaef29ecc0e6ce313f0eed3d5da7e0f5bcd89#code) | ✅ BaseScan |
| **Safe + SmartSessionValidator** | [`0xC006bfc3Cac01634168e9cD0a1fEbD4Ffb816e14`](https://sepolia.basescan.org/address/0xC006bfc3Cac01634168e9cD0a1fEbD4Ffb816e14) | ✅ ERC-7579 |
| MockBRETT | [`0x46d40e0abda0814bb0cb323b2bb85a129d00b0ac`](https://sepolia.basescan.org/address/0x46d40e0abda0814bb0cb323b2bb85a129d00b0ac) | Deployed |
| MockHoneypot | [`0xf672c8fc888b98db5c9662d26e657417a3c453b5`](https://sepolia.basescan.org/address/0xf672c8fc888b98db5c9662d26e657417a3c453b5) | Deployed |
| **MaliciousRugToken** | [`0x99900d61f42bA57A8C3DA5b4d763f0F2Dc51E2B3`](https://sepolia.basescan.org/address/0x99900d61f42bA57A8C3DA5b4d763f0F2Dc51E2B3) | Deployed (unverified) |

---

## ERC Standards Compliance

| Standard | Implementation | Evidence |
|---|---|---|
| **ERC-7579** | AegisModule as Executor | `src/AegisModule.sol` — `onInstall`, `onUninstall`, `isModuleType` |
| **ERC-4337** | Smart Account via Safe | UserOps relayed through Pimlico bundler |
| **ERC-7715** | Session Keys | 2-selector scope (`requestAudit`, `triggerSwap`) |

| Layer | Standard | On-Chain? | What's Real | What's Simulated |
|---|---|---|---|---|
| **Wallet** | ERC-4337 | ✅ | Safe Smart Account + Pimlico Bundler | Demo scripts use `cast send` instead of UserOps |
| **Module** | ERC-7579 | ✅ | AegisModule installed on Safe, all functions live | — |
| **Session** | ERC-7715 | ✅ | Session config built, SmartSessionValidator installed | Browser-based signing (full key-delegation pending Safe SDK) |

---

## Chainlink CRE Integration

| Proof Point | Evidence |
|---|---|
| WASM Oracle (`aegis-oracle.ts`) | Compiled via Javy, runs in DON sandbox |
| `cre workflow simulate` | [`demo_v5_cre_run.txt`](sample_output/demo_v5_cre_run.txt) |
| ConfidentialHTTPClient | BaseScan + OpenAI + Groq keys sealed in enclave |
| Multi-model consensus | GPT-4o + Llama-3 via `ConsensusAggregationByFields` |
| On-chain callback | `onReport()` via KeystoneForwarder |

---

## AI Forensics

| Feature | Detail |
|---|---|
| Dual-model consensus | GPT-4o + Llama-3 (temperature=0, JSON schema) |
| 8-bit risk matrix | Bitwise "Union of Fears" — see [ARCHITECTURE.md](ARCHITECTURE.md#8-8-bit-risk-matrix) |
| Per-field median consensus | Tolerates LLM nondeterminism across DON nodes |
| Configurable firewall | 8 knobs injected into LLM system prompt |
| 3 distinct AI prompts | CRE source audit, Heimdall bytecode, chat interface — see [`AI_PROMPT_CATALOG.md`](AI_PROMPT_CATALOG.md) |

---

## Heimdall Bytecode Pipeline

| Proof Point | Evidence |
|---|---|
| Docker microservice | `services/decompiler/` — heimdall-rs v0.9.2 |
| **MaliciousRugToken detection** | 13,326 hex chars → 14,002 chars decompiled → `is_malicious: true` |
| Specialized RE prompt | Honeypot, hidden mint, fee manipulation, blocklisting, self-destruct |
| GPT-4o on decompiled code | [`heimdall_tests.txt`](sample_output/heimdall_tests.txt) |
| 6/6 live integration tests | Phase 2 (microservice) + Phase 3 (pipeline) + Phase 4 (LLM) |

---

## Frontend Dashboard

| Feature | Status |
|---|---|
| 3-panel command center | ✅ Agents, Firewall, Audit Log, Marketplace |
| AI chat interface | ✅ Real treasury balance, dynamic agent list |
| Oracle feed (SSE) | ✅ Live CRE audit — BRETT APPROVED, HoneypotCoin BLOCKED |
| Kill switch | ✅ PROTOCOL LOCKED banner |
| 5 marketplace bots | ✅ BLUECHIP, YIELD, DEGEN, SAFE, HEIMDALL |
| 8-bit firewall toggles | ✅ Synced with on-chain `firewallConfig()` |
| Trade simulation modal | ✅ Token picker, amount slider, oracle audit trigger |
| Session key display | ✅ Permitted/blocked functions, scoped selectors |

---

## Demo Scripts

| Script | Duration | What It Proves |
|---|---|---|
| `demo_v5_setup.ps1` | ~2 min | Docker, WASM compile, Base Sepolia connectivity |
| `demo_v5_master.ps1` | ~5 min | Full 7-act E2E: treasury → agents → audit → CRE → swap/revert → budget → kill switch |
| `demo_v5_cre.ps1` | ~3 min | Raw CRE WASM execution for Chainlink judges |
| `demo_v5_heimdall.ps1` | ~3 min | Bytecode decompilation → GPT-4o detects MALICIOUS contract |

---

## Documentation Index

| Document | Content |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 13 Mermaid diagrams, ERC stack, risk matrix |
| [`CONFIDENTIAL_HTTP.md`](CONFIDENTIAL_HTTP.md) | Privacy track deep-dive |
| [`HEIMDALL_PIPELINE.md`](HEIMDALL_PIPELINE.md) | Bytecode decompilation pipeline |
| [`AI_PROMPT_CATALOG.md`](AI_PROMPT_CATALOG.md) | All 3 AI prompts with templates |
| [`DEMO_GUIDE.md`](DEMO_GUIDE.md) | How to run all demos |
| [`X402_MONETIZATION.md`](X402_MONETIZATION.md) | x402 oracle monetization |
| [`UI_TEST_MATRIX.md`](UI_TEST_MATRIX.md) | 42/50 frontend tests documented |
