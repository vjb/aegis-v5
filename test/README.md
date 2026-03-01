# 🧪 Aegis V5 — Test Suite

TDD-first test suite covering the full Aegis V5 stack: ERC-7579 module, CRE oracle, ERC-4337 AA, ERC-7715 session keys, and frontend components.

## Current Status

```
forge test --match-contract AegisModuleTest
  ✅ 21 passed, 0 failed  (18 AegisModule + 3 template tests)

pnpm exec jest
  ✅ 8 suites — 91 passed, 1 skipped
  ⏱  ~300s
```

> 📊 See [`docs/sample_output/forge_tests.txt`](../docs/sample_output/forge_tests.txt) and [`docs/sample_output/jest_tests.txt`](../docs/sample_output/jest_tests.txt) for full output.

## Running Tests

```bash
# All TypeScript (Jest)
pnpm exec jest --config jest.config.json

# Single suite
npx jest test/bot_v5.spec.ts --no-coverage

# Solidity (Forge)
forge test --match-contract AegisModuleTest -vv
```

---

## Solidity Suite (Forge)

**`test/AegisModule.t.sol`** — 18 tests against `AegisModule.sol` (+ 3 template tests = 21 total):

| # | Test | Assertion |
|---|---|---|
| 1 | `test_requestAudit_emitsEvent` | `AuditRequested` emitted with correct tradeId |
| 2 | `test_requestAudit_blocksUnauthorizedAgent` | Non-subscribed agent → `NotAuthorized` |
| 3 | `test_onReport_clearance` | riskScore=0 → `isApproved[token]=true` |
| 4 | `test_onReport_denial` | riskScore>0 → `ClearanceDenied` emitted |
| 5 | `test_onReport_keystoneGuard` | Non-forwarder caller → `NotKeystoneForwarder` |
| 6 | `test_triggerSwap_requiresClearance` | Swap without clearance → `TokenNotCleared` |
| 7 | `test_triggerSwap_consumesClearance` | Clearance consumed after swap (anti-replay CEI) |
| 8 | `test_triggerSwap_mockEmitsEvent` | `SwapExecuted` emitted on success |
| 9 | `test_triggerSwap_deductsBudget` | Agent budget decremented after swap |
| 10 | `test_triggerSwap_insufficientBudget` | Swap exceeding budget → `InsufficientBudget` |
| 11 | `test_triggerSwap_onlyOwnerOrAgent` | Non-agent caller → `NotAuthorized` |
| 12 | `test_subscribeAgent` | `AgentSubscribed` emitted, allowance set |
| 13 | `test_subscribeAgent_onlyOwner` | Non-owner → `NotOwner` |
| 14 | `test_revokeAgent_blocksAudit` | Revoked agent → `NotAuthorized` on requestAudit |
| 15 | `test_tradeId_increment` | tradeIds are sequential (0, 1, 2...) |
| 16 | `test_revokeAgent_zerosBudget` | `revokeAgent()` zeroes agent budget |
| 17 | `test_depositETH` | `TreasuryDeposit` emitted, balance increases |
| 18 | `test_withdrawETH` | `TreasuryWithdrawal` emitted, balance decreases |

---

## TypeScript Suites (Jest)

### Protocol Correctness

| File | Tests | What It Covers |
|---|---|---|
| `oracle.spec.ts` | 12 | ABI encoding, riskScore bit decoding, oracle config shape, AI JSON parsing |
| `bot.spec.ts` | 6 | Agent calldata encoding, capital model, polling timeout |

### ERC-4337 AA Stack

| File | Tests | What It Covers |
|---|---|---|
| `safe_setup.spec.ts` | 7 | `buildSafeConfig`, `buildAegisModuleConfig`, `ENTRYPOINT_V07` constant; 1 integration test gated by env vars |
| `session_key.spec.ts` | 14 | SmartSessionValidator address, `requestAudit`/`triggerSwap` selectors, `buildAgentSession` shape |
| `bot_v5.spec.ts` | 9 | V5 call builders target module (not Safe), zero-value, correct selectors, 3-param triggerSwap |

### Live Integration (Base Sepolia)

| File | Tests | What It Covers |
|---|---|---|
| `live_e2e.spec.ts` | 5 | `requestAudit` → `onReportDirect` → `triggerSwap` success + `TokenNotCleared` revert |

### Frontend TDD

| File | Tests | What It Covers |
|---|---|---|
| `frontend.spec.ts` | 26 | Wallet rendering, session key display, oracle feed SSE event parsing |

---

## Test Architecture Notes

**Jest module resolution:** viem, permissionless, and @rhinestone/module-sdk are ESM packages.
The `jest.config.json` `moduleNameMapper` redirects them to their `_cjs/index.js` builds.

**Integration test gate:** `deploySafeWithAegisModule` is skipped unless `BASE_SEPOLIA_RPC_URL`, `PRIVATE_KEY`, and `AEGIS_MODULE_ADDRESS` are all set.

**ES2020 target:** `jest.config.json` uses `tsconfig` with `target: ES2020` to support BigInt literals in `live_e2e.spec.ts`.
