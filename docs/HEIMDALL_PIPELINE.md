# 🔬 Heimdall Bytecode Decompilation Pipeline

> **Status:** Standalone experimental demo · Not yet integrated into the live CRE oracle pipeline

## The Problem: Unverified Contracts

Traditional security tools — including the core Aegis CRE oracle — require **verified source code** from BaseScan to analyze a smart contract. When a token is deployed without publishing its source, these tools go blind. Bit 0 of the Aegis 8-bit risk matrix ("Unverified source code") gets set, and the token is blocked by default.

But what if we could still analyze it?

## The Solution: Local Bytecode Decompilation

The Heimdall Pipeline is a proof-of-concept that demonstrates how Aegis could audit **any deployed contract**, even without verified source code:

```
eth_getCode(address)  →  Heimdall Docker (local)  →  GPT-4o  →  8-bit Risk Code
     │                         │                          │              │
   Raw EVM              Symbolic execution          AI forensic     Same format as
   bytecode             → Solidity-like code        analysis        verified pipeline
```

### How It Works

1. **Bytecode Extraction** — `eth_getCode` fetches the raw EVM bytecode from Base Sepolia via JSON-RPC
2. **Decompilation** — [Heimdall-rs v0.9.2](https://github.com/Jon-Becker/heimdall-rs) runs symbolic execution inside a local Docker container, reconstructing Solidity-like pseudocode with function signatures, storage patterns, and control flow
3. **AI Analysis** — GPT-4o (temperature=0, deterministic) receives the decompiled output with a specialized reverse-engineering prompt. The prompt instructs the LLM to hunt for honeypot sell blocks, hidden minting, fee manipulation (>90%), blocklisting patterns, and unauthorized self-destruct/delegatecall — all at the EVM opcode level (storage slots, `CALL`, `REVERT` patterns). It returns a structured JSON verdict including `is_malicious` and the standard 4 risk fields
4. **Risk Encoding** — Results are encoded as bits 4–7 of the standard 8-bit risk mask

### Key Advantages

| Feature | Heimdall Pipeline | Third-Party APIs |
|---|---|---|
| **Runs locally** | ✅ Docker container | ❌ External service |
| **No API keys needed** | ✅ Zero dependencies | ❌ Requires authentication |
| **No rate limits** | ✅ Unlimited | ❌ Cloudflare blocks |
| **Confidential** | ✅ Bytecode stays local | ❌ Sent to third party |
| **Speed** | ~2 seconds typical | Variable |

## Running the Demo

### Prerequisites

```bash
# Build the Heimdall Docker image
docker build -t aegis-heimdall ./services/decompiler

# Start the container
docker run -d -p 8080:8080 --name aegis-heimdall aegis-heimdall

# Verify it's running
curl http://localhost:8080/health
# → { "status": "ok", "heimdall": "heimdall 0.9.2" }
```

### Interactive Demo Script

```powershell
.\scripts\demo_v5_heimdall.ps1 -Interactive
```

This runs a 5-scene cinematic demo:

| Scene | What Happens |
|---|---|
| 1 | Verifies Heimdall Docker is alive |
| 2 | Queries BaseScan to confirm no verified source |
| 3 | Fetches raw bytecode via `eth_getCode` from Base Sepolia |
| 4 | Sends bytecode to Heimdall for symbolic decompilation |
| 5 | Feeds decompiled Solidity to live GPT-4o for risk analysis |

> **Sample output:** [`sample_output/demo_v5_heimdall_run.txt`](sample_output/demo_v5_heimdall_run.txt)

### Live Integration Tests

```bash
npx jest test/cre/HeimdallLive.spec.ts
```

Tests hit real infrastructure (zero mocking):
- **Phase 2:** Heimdall microservice health check, decompilation of real bytecode, empty input rejection
- **Phase 3:** Full pipeline — Base Sepolia RPC → Heimdall → structural assertions
- **Phase 4:** End-to-end — Base Sepolia → Heimdall → live GPT-4o → valid risk JSON

## Service Architecture

```
services/decompiler/
├── Dockerfile        # Multi-stage: rust:1.85 builder → debian:trixie runtime
├── server.js         # Express.js API (POST /decompile, GET /health)
├── package.json      # Dependencies (express only)
└── README.md         # Service-level documentation
```

The Docker image uses a multi-stage build:
1. **Builder stage** — Installs Rust toolchain and compiles heimdall-rs via bifrost
2. **Runtime stage** — Debian Trixie slim + Node.js 20 + the compiled heimdall binary

## Relationship to Core Aegis Pipeline

> **Important:** The Heimdall pipeline is currently a **standalone demonstration** and is **not wired into the live CRE oracle** (`cre-node/`). The core Aegis audit flow (triggered by `requestAudit()` on-chain) uses GoPlus + BaseScan + GPT-4o + Llama-3 without calling the Heimdall service.

The Heimdall pipeline answers the question: *"What would happen if we encountered an unverified contract?"* It proves that the infrastructure exists to extend Aegis's coverage to any deployed contract, regardless of verification status.

### Future Integration Path

To wire Heimdall into the live oracle, the CRE entrypoint would need to:
1. Check if BaseScan returns empty source code
2. If empty, call `eth_getCode` and `POST /decompile` to the Heimdall service
3. Feed the decompiled output to the existing LLM consensus layer

This would make the Heimdall fallback automatic and transparent to end users.
