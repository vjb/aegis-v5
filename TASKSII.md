# Aegis Protocol V5: Account Abstraction (AA) Migration Plan
**Role:** Lead Web3 Account Abstraction Engineer
**Objective:** Upgrade the V4 EOA-based execution to a full ERC-4337 / ERC-7579 / ERC-7715 stack.

---

## ✅ Completed Phases

### Phase 1: Environment & AA Dependencies
- [x] Installed `permissionless`, `viem`, `@rhinestone/module-sdk`
- [x] Added `PIMLICO_API_KEY`, `SAFE_ADDRESS` to `.env`

### Phase 2: Safe Account & Module Provisioning
- [x] `test/safe_setup.spec.ts` — 6 unit + 1 integration test
- [x] `scripts/v5_safe_config.ts` — pure Rhinestone module builders
- [x] `scripts/v5_setup_safe.ts` — full Safe deploy + module install flow

### Phase 3: Session Key Validator
- [x] `scripts/v5_session_config.ts` — `buildAgentSession`, selectors
- [x] `test/session_key.spec.ts` — 14/14 passing

### Phase 4: Bot Refactor (UserOperations)
- [x] `scripts/v5_bot_config.ts` — pure call builders (`requestAudit`, `triggerSwap`)
- [x] `test/bot_v5.spec.ts` — all passing
- [x] `src/agent/bot.ts` — rewrote to `sendUserOperation` format

### Phase 5a: Tenderly + Local Bundler (ABANDONED)
- [x] Attempted Alto bundler in Docker → failed (`debug_traceCall` unsupported on Tenderly)
- [x] Attempted Direct Bundler Mock (manual `handleOps`) → failed (EP 0.7 PackedUserOperation encoding complexity)
- [x] Documented in `docs/BUNDLER_STRATEGY_DECISION.md` and `docs/ALTO_BUNDLER_DEBUG_LOG.md`

---

## 🔄 PIVOT: Base Sepolia + Pimlico Cloud

> **Decision:** Stop fighting infrastructure. Use Pimlico's hosted bundler on Base Sepolia.
> This gives us instant, working ERC-4337 with zero manual gas packing.

### Phase 5b: Base Sepolia Pivot ← CURRENT
- [x] 5b.1 Update TASKSII.md with pivot plan
- [x] 5b.2 Revert `bot.ts` to `smartAccountClient.sendUserOperation` via Pimlico
- [x] 5b.3 Rewrite `v5_setup_safe.ts` for Base Sepolia + Pimlico bundler
- [x] 5b.4 Create `script/DeployMocks.s.sol` — deploy `MockBRETT` + `MockHoneypot` ERC20s
- [x] 5b.5 Mock Uniswap swap in `AegisModule.sol` (emit SwapExecuted, skip router)
- [x] 5b.6 Deploy AegisModule + mock tokens to Base Sepolia via Forge
- [x] 5b.7 Run `v5_e2e_mock.ts` on Base Sepolia — **ALL 5 PHASES PASSED** ✅
- [ ] [CHECKPOINT 5b] commit + push

### Phase 6: Live CRE Integration
- [ ] 6.1 Update CRE node config to point at Base Sepolia
- [ ] 6.2 Run `live_e2e.ts` with real CRE Docker node intercepting `AuditRequested`
- [ ] 6.3 Verify oracle callback → swap execution via UserOp
- [ ] [FINAL CHECKPOINT] commit + push

### Phase 7: Frontend Integration
- [ ] 7.1 Update frontend to display Safe address + agent status
- [ ] 7.2 Wire oracle feed to show UserOp-based audit requests
- [ ] 7.3 End-to-end demo: UI → Agent → Safe → Module → Oracle → Swap

---

## Architecture (Post-Pivot)

```
┌─────────────┐    UserOp     ┌──────────────┐   handleOps   ┌────────────┐
│  AI Agent   │──────────────▶│   Pimlico    │──────────────▶│ EntryPoint │
│  (bot.ts)   │  via SDK      │  Cloud       │  on-chain     │   0.7      │
│  Session Key│               │  Bundler     │               │            │
└─────────────┘               └──────────────┘               └─────┬──────┘
                                                                   │
                                                          ┌────────▼───────┐
                                                          │  Safe Proxy    │
                                                          │  (Smart Acct)  │
                                                          │  + 4337 Module │
                                                          └────────┬───────┘
                                                                   │
                                                          ┌────────▼───────┐
                                                          │ AegisModule    │
                                                          │ (ERC-7579)     │
                                                          │ requestAudit() │
                                                          │ triggerSwap()  │
                                                          └────────────────┘
```