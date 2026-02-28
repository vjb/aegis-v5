# Bundler Strategy Decision: Direct `handleOps` vs. Off-Chain Bundler

## Context

Aegis V5 migrates the Smart Treasury from raw `sendTransaction` calls to ERC-4337 Account Abstraction. This requires a **bundler** — a service that receives `UserOperation` structs, validates them, and submits them to the `EntryPoint.handleOps()` contract.

During development on a Tenderly Virtual TestNet, we discovered a fundamental incompatibility between the Pimlico **Alto** bundler and Tenderly's RPC implementation. This document records the decision to bypass the off-chain bundler and submit `handleOps()` directly.

---

## The Problem

Alto bundler requires `debug_traceCall` with a custom JavaScript tracer to enforce ERC-4337's off-chain simulation rules (opcode banning, storage access restrictions). Tenderly VNets do not expose `debug_traceCall`, returning `"not supported"`. This makes Alto fundamentally incompatible with Tenderly as a backing node.

See [ALTO_BUNDLER_DEBUG_LOG.md](./ALTO_BUNDLER_DEBUG_LOG.md) for the full debugging trace.

---

## Options Evaluated

### Option A: Deploy on Base Sepolia with Pimlico's Hosted Bundler

| Aspect | Detail |
|---|---|
| **How it works** | Use Pimlico's public bundler API (`api.pimlico.io`) targeting the live Base Sepolia testnet |
| **Pros** | Full ERC-4337 compliance (on-chain + off-chain). All Safe infrastructure pre-deployed. Production-grade gas estimation. |
| **Cons** | Requires a Pimlico API key. Requires Base Sepolia ETH (faucet). Loses Tenderly's state forking, snapshots, and admin RPCs (`tenderly_setBalance`). Slower iteration — every tx is a real L2 transaction. Can't rewind state for demo replays. |
| **Verdict** | Good for production. Too slow and inflexible for hackathon demo iteration. |

---

### Option B: Use Anvil (Local Foundry Node) Instead of Tenderly

| Aspect | Detail |
|---|---|
| **How it works** | Run `anvil --fork-url <base_sepolia_rpc>` locally. Anvil supports `debug_traceCall`. |
| **Pros** | Full `debug_traceCall` support. Alto bundler works natively. Fast local iteration. Free. |
| **Cons** | Loses Tenderly's persistent state, dashboard UI, and shared team access. Must restart anvil between demo runs (no persistent VNet). Fork state diverges from Tenderly's Base fork. Have to redeploy all contracts on each restart. |
| **Verdict** | Viable but adds operational complexity. Good for CI/CD testing, less ideal for live demos. |

---

### Option C: Direct `handleOps()` Submission ✅ (Selected)

| Aspect | Detail |
|---|---|
| **How it works** | Build the `PackedUserOperation` struct locally, sign it with the owner's ECDSA key, and submit `EntryPoint.handleOps([packedOp], beneficiary)` as a standard Ethereum transaction from the owner wallet. |
| **Pros** | **Full on-chain ERC-4337 compliance.** The EntryPoint, Safe, and module execute the exact same code path as a bundler-submitted UserOp. Works on any RPC (Tenderly, Anvil, mainnet). No external dependencies. Fastest iteration speed. |
| **Cons** | No off-chain mempool simulation (opcode banning, storage access rules). The owner wallet acts as a centralized private bundler. Not suitable for public-facing production (users can't submit UserOps permissionlessly). |
| **Verdict** | **Best fit for hackathon.** On-chain architecture is identical. Judges see real `handleOps` traces. The "bundler" question is an infrastructure concern, not an architecture concern. |

---

## Key Insight: On-Chain vs. Off-Chain Compliance

The ERC-4337 spec defines two layers:

1. **On-chain protocol** — `EntryPoint.handleOps()`, `validateUserOp()`, gas accounting, nonce management, signature verification. This is the **architecture**.
2. **Off-chain mempool rules** — Opcode banning (`SELFDESTRUCT`, `GASPRICE`), storage access restrictions, `debug_traceCall` simulation. This is **bundler infrastructure**.

When we submit `handleOps()` directly, we preserve the entire on-chain protocol. The transaction trace is indistinguishable from one submitted by a real bundler. What we skip is the off-chain simulation — which is equivalent to running a private/centralized bundler, something that Alchemy, Biconomy, and Pimlico themselves do in production.

---

## Implementation

The `v5_setup_safe.ts` script:
1. Builds the `UserOperation` struct using `permissionless.js` (`toSafeSmartAccount`)
2. Signs it with the owner's private key via Safe's EIP-712 typed data
3. Packs it into the `PackedUserOperation` format (0.7 EntryPoint)
4. Calls `EntryPoint.handleOps([packedOp], owner)` as a standard transaction
5. Verifies the Safe deployed and module installed via `isModuleInstalled()`
