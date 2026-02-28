# 🧪 Aegis — Test Suite

TDD-first test suite covering V4 (protocol correctness) and V5 (ERC-4337 AA migration).
All TypeScript tests were written **before** their implementation files.

## Running Tests

```bash
# All TypeScript (Jest)
pnpm exec jest --config jest.config.json

# Single suite
npx jest test/bot_v5.spec.ts --no-coverage

# Solidity (Forge)
forge test --match-contract AegisModuleTest -vv
```

## Current Status

```
pnpm exec jest
  ✅ 5 suites — 42 passed, 1 skipped (integration gate)
  ⏱  ~24s

forge test --match-contract AegisModuleTest
  ✅ 7 passed, 0 failed
```

---

## TypeScript Suites (Jest)

### V4 — Protocol Correctness

| File | Tests | What It Covers |
|---|---|---|
| `oracle.spec.ts` | 6 | ABI encoding, riskScore bit decoding, oracle config shape |
| `bot.spec.ts` | 6 | Agent calldata encoding, V4 capital model, polling timeout |

### V5 — ERC-4337 AA Migration (feat/v5-aa-stack)

| File | Tests | What It Covers | Phase |
|---|---|---|---|
| `safe_setup.spec.ts` | 6 ✅ + 1 ⏭️ | `buildSafeConfig`, `buildAegisModuleConfig`, `ENTRYPOINT_V07` constant; integration test skipped until Anvil | 2 |
| `session_key.spec.ts` | 14 | SmartSessionValidator address, `requestAudit`/`triggerSwap` selectors, `buildAgentSession` shape, `SmartSessionMode` enum | 3 |
| `bot_v5.spec.ts` | 9 | V5 call builders target module (not Safe), zero-value, correct selectors, 3-param triggerSwap (V4 bug fixed), calldata length | 4 |

**The 1 skipped test** (`safe_setup.spec.ts:deploySafeWithAegisModule`) is an integration gate — it runs when `TENDERLY_RPC_URL`, `PRIVATE_KEY`, and `AEGIS_MODULE_ADDRESS` are all set. It deploys a real Safe and asserts `isModuleInstalled`.

---

## Solidity Suite (Forge)

**`test/AegisModule.t.sol`** — 7 tests against `AegisModule.sol`:

| # | Test | Assertion |
|---|---|---|
| 1 | `test_requestAudit_emitsEvent` | `AuditRequested` emitted with correct tradeId |
| 2 | `test_onReport_clearance` | riskScore=0 → `isApproved[token]=true` |
| 3 | `test_onReport_denial` | riskScore>0 → `ClearanceDenied` emitted |
| 4 | `test_onReport_keystoneGuard` | non-forwarder caller → `NotKeystoneForwarder` |
| 5 | `test_triggerSwap_requiresClearance` | swap without clearance → `TokenNotCleared` |
| 6 | `test_triggerSwap_consumesClearance` | clearance consumed after swap (anti-replay CEI) |
| 7 | `test_tradeId_increment` | tradeIds are sequential (1, 2, 3...) |

---

## V5 Test Architecture Notes

**Jest module resolution:** viem, permissionless, and @rhinestone/module-sdk are ESM packages.
The `jest.config.json` `moduleNameMapper` redirects them to their `_cjs/index.js` builds.
Known workaround: `encodeFunctionData` from viem CJS has incorrect type overloads in ts4.x
with `as const` ABIs — fixed in `v5_bot_config.ts` with a typed `EncodeFn` cast wrapper.
See `docs/LESSONS_LEARNED.md` for detail.

**Integration test gate:** `deploySafeWithAegisModule` is skipped unless all three env vars are
present. This prevents false CI failures while allowing live integration on dev machines.

---

## Phase Roadmap

| Phase | Status | Test File |
|---|---|---|
| P2 — Safe + Module Install | ✅ unit / ⏭️ integration | `safe_setup.spec.ts` |
| P3 — Session Key | ✅ 14/14 | `session_key.spec.ts` |
| P4 — Bot UserOps | ✅ 9/9 | `bot_v5.spec.ts` |
| P5a — E2E Mock (Anvil) | 🔲 run `scripts/start_v5_local.ps1` | — |
| P5b — E2E + Swap (Tenderly) | 🔲 needs new VNet | — |
| P6 — Live CRE Integration | 🔲 real `onReport()` via Chainlink DON | — |
