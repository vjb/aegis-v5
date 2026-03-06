[🏠 Back to Main README](../README.md)

# 🛡️ Aegis Protocol V5 — Solidity Source

> **ERC-7579 Executor Module** deployed on Base Sepolia.

## [`AegisModule.sol`](AegisModule.sol)

The core smart contract — an ERC-7579 Type-2 Executor Module that acts as a zero-custody AI security gateway. Implements the full ERC-7579 interface (`onInstall`, `onUninstall`, `isModuleType`). Deployed standalone on Base Sepolia (Safe module installation requires Rhinestone Registry attestation — see [`LESSONS_LEARNED.md`](../docs/LESSONS_LEARNED.md)).

### Key Functions

| Function | Who Calls It | Purpose |
|---|---|---|
| `subscribeAgent(address, uint256)` | Owner only | Registers an AI agent with an ETH budget cap |
| `revokeAgent(address)` | Owner only | Instantly zeros an agent's budget and access |
| `requestAudit(address)` | Owner or Agent | Submits a trade intent, emits `AuditRequested` for CRE DON |
| `onReport(bytes, bytes)` | KeystoneForwarder only | Production CRE callback — clears or denies token. Demo uses `onReportDirect(uint256, uint256)` (owner relay) |
| `onReportDirect(uint256, uint256)` | Owner only | Demo/testing callback (simulates oracle) |
| `triggerSwap(address, uint256, uint256)` | Owner or Agent | Executes swap if token is cleared and budget allows |
| `setFirewallConfig(string)` | Owner only | Updates the dynamic firewall policy |
| `depositETH()` | Anyone | Deposits ETH into the module treasury |
| `withdrawETH(uint256)` | Owner only | Withdraws ETH from treasury |

### Security Model

- **Zero-custody** — the module has execution rights but the owner controls all funds
- **Budget enforcement** — `agentAllowances` mapping, deducted before external calls (CEI)
- **Anti-replay** — `isApproved` is reset to `false` after each swap
- **Keystone guard** — `onReport` can only be called by the `keystoneForwarder` address

### Test Coverage

18 Forge tests in [`test/AegisModule.t.sol`](../test/AegisModule.t.sol) — see [`docs/sample_output/forge_tests.txt`](../docs/sample_output/forge_tests.txt) for output.

See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full system architecture with Mermaid diagrams.
