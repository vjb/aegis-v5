# 🏗️ ERC Standards Implementation — Aegis Protocol V5

> **Three Ethereum Request for Comment (ERC) standards form the Agentic Web architecture of Aegis Protocol.**
>
> This document explains how each standard is implemented, what is live on-chain, and what is simulated for the hackathon demo.

---

## ERC-4337 — Account Abstraction

**Status:** ✅ Live on Base Sepolia

### What It Is

ERC-4337 replaces traditional Externally Owned Account (EOA) wallets with Smart Accounts that can be programmed with custom validation logic, gas sponsorship, and bundled transactions. Instead of a raw private key signing every transaction, users submit **UserOperations** (intents) that are processed by a Bundler and routed through an on-chain EntryPoint contract.

### How Aegis Uses It

Aegis uses **Safe Smart Accounts** as the wallet layer. The AI agent never holds the user's private key. Instead, it submits structured intents to the **Pimlico Cloud Bundler**, which handles:

- **Gas estimation** — calculating the gas required for UserOps
- **Paymaster integration** — sponsoring gas so agents don't need native ETH
- **EntryPoint submission** — routing validated UserOps to the ERC-4337 EntryPoint on Base Sepolia

### What Is Real

| Component | Status | Evidence |
|---|---|---|
| Safe Smart Account deployment | ✅ Live | [`v5_setup_safe.ts`](../scripts/v5_setup_safe.ts) — `toSafeSmartAccount()` via `permissionless` SDK |
| Pimlico Cloud Bundler | ✅ Live | [`v5_e2e_mock.ts`](../scripts/v5_e2e_mock.ts) — real `pimlicoBundlerActions` on Base Sepolia |
| UserOp submission | ✅ Live | `sendUserOperation()` calls execute real transactions on Base Sepolia |
| EntryPoint (v0.7) | ✅ Live | Standard ERC-4337 EntryPoint on Base Sepolia |

### What Is Simulated

| Component | Status | Why |
|---|---|---|
| Paymaster gas sponsorship | ✅ Proven in E2E | Demo scripts use `cast send` (direct EOA) for reliability. The E2E test ([`v5_e2e_mock.ts`](../scripts/v5_e2e_mock.ts)) uses real Pimlico-sponsored UserOps — see [`erc4337_userop_run.txt`](sample_output/erc4337_userop_run.txt). |

### Key Files

- [`scripts/v5_setup_safe.ts`](../scripts/v5_setup_safe.ts) — Safe deployment + module installation
- [`scripts/v5_e2e_mock.ts`](../scripts/v5_e2e_mock.ts) — Full 5-phase E2E with real UserOps
- [`scripts/v5_bot_config.ts`](../scripts/v5_bot_config.ts) — ABI calldata builders for `requestAudit` and `triggerSwap`

---

## ERC-7579 — Modular Smart Accounts

**Status:** ✅ Live on Base Sepolia

### What It Is

ERC-7579 defines a standard interface for modular plugins that can be installed onto Smart Accounts. Instead of monolithic wallet logic, accounts can install and uninstall **Executor**, **Validator**, and **Hook** modules — each with well-defined lifecycle methods (`onInstall`, `onUninstall`, `isModuleType`).

### How Aegis Uses It

`AegisModule.sol` is an **ERC-7579 Type-2 Executor Module** that inherits from Rhinestone's `ERC7579ExecutorBase`. When installed onto a Safe Smart Account, it gains the execution rights to:

1. **Accept audit requests** from subscribed AI agents (`requestAudit`)
2. **Receive oracle verdicts** from the Chainlink CRE DON (`onReport`)
3. **Execute or block swaps** based on the AI firewall's risk assessment (`triggerSwap`)
4. **Enforce per-agent budgets** — each agent has an independent ETH spending cap (`agentAllowances`)
5. **Revocation** — the owner can revoke any agent instantly (`revokeAgent`)

The critical design principle: **the module has execution rights but never holds custody**. Capital stays in the Safe. The module can only route cleared trades, not withdraw funds arbitrarily.

### What Is Real

| Component | Status | Evidence |
|---|---|---|
| `AegisModule.sol` inherits `ERC7579ExecutorBase` | ✅ Live | [`src/AegisModule.sol`](../src/AegisModule.sol) line 4, 56 |
| Module type declaration (`TYPE_EXECUTOR`) | ✅ Live | `isModuleType()` returns `typeID == TYPE_EXECUTOR` |
| `onInstall` / `onUninstall` lifecycle | ✅ Live | Standard ERC-7579 interface implemented |
| `subscribeAgent` / `revokeAgent` | ✅ Live | On-chain budget management with events |
| `requestAudit` → `AuditRequested` event | ✅ Live | Emits on Base Sepolia, CRE DON intercepts the event |
| `onReport` callback from KeystoneForwarder | ✅ Live | Guarded by `keystoneForwarder` address check |
| `triggerSwap` with budget deduction | ✅ Live | CEI pattern, budget math enforced on-chain |
| 21 Forge tests passing | ✅ Verified | [`forge_tests.txt`](sample_output/forge_tests.txt) |

### What Is Simulated

| Component | Status | Why |
|---|---|---|
| Token swap execution | ⚠️ Mock on testnet | Base Sepolia has no Uniswap V3 liquidity. `triggerSwap` emits `SwapExecuted` with a mock 1:1000 ratio. Production Uniswap V3 code is preserved in comments (lines 322-332). |
| Oracle callback in demos | ⚠️ `onReportDirect` | Demo scripts use `onReportDirect()` (owner-callable) to relay the oracle verdict. `cre workflow simulate` executes the full AI pipeline locally but does not write on-chain — it's a sandbox dry-run. The real `onReport()` function is fully implemented, guarded by `keystoneForwarder`, and [tested](sample_output/forge_tests.txt). |

### Key Files

- [`src/AegisModule.sol`](../src/AegisModule.sol) — The ERC-7579 Executor Module (350 lines)
- [`test/AegisModule.t.sol`](../test/AegisModule.t.sol) — 18 AegisModule tests + 3 template tests (21 total)
- [`forge_tests.txt`](sample_output/forge_tests.txt) — Test output

---

## ERC-7715 — Session Keys

**Status:** ✅ Configuration built and tested · Budget enforcement live on-chain

### What It Is

ERC-7715 defines a standard for **scoped session keys** — temporary, limited-permission credentials that allow a third party (like an AI agent) to submit UserOperations on behalf of a Smart Account without holding the owner's private key. Each session key is mathematically constrained to:

- **Specific target contracts** — the agent can only interact with the AegisModule
- **Specific function selectors** — only `requestAudit(address)` and `triggerSwap(address,uint256,uint256)`
- **Spending budgets** — maximum ETH the agent can spend per session
- **Time limits** — sessions expire after a configurable duration (default: 24 hours)

### How Aegis Uses It

The session key architecture ensures the AI agent **never touches the owner's private key**. The agent receives a scoped credential that permits exactly two actions — requesting an audit and triggering a swap — on exactly one contract (the AegisModule), with a hard-capped budget.

```
Owner's Key ──→ subscribeAgent(agentAddr, 0.05 ETH)
                 ↓
Agent's Session Key ──→ requestAudit(tokenAddr)     ✅ Permitted
                    ──→ triggerSwap(token, amt, min) ✅ Permitted
                    ──→ withdrawETH(1 ether)         ❌ Blocked (not in selector scope)
                    ──→ transfer(attacker, 100 ETH)  ❌ Blocked (not in selector scope)
```

### What Is Real

| Component | Status | Evidence |
|---|---|---|
| Session config builder (`buildAgentSession`) | ✅ Built | [`scripts/v5_session_config.ts`](../scripts/v5_session_config.ts) — full ERC-7715 Session object |
| Rhinestone `@rhinestone/module-sdk` integration | ✅ Built | Uses `getSmartSessionsValidator`, `SmartSessionMode`, `Session` types |
| SmartSessionsValidator address (canonical) | ✅ Referenced | `0x00000000008bDABA73cD9815d79069c247Eb4bDA` |
| Function selector scoping | ✅ Built | `SELECTOR_REQUEST_AUDIT` (`0xe34eac65`) and `SELECTOR_TRIGGER_SWAP` (`0x684bceb0`) |
| Budget enforcement on-chain | ✅ Live | `agentAllowances` mapping in `AegisModule.sol` — deducted in `triggerSwap` |
| Session key unit tests | ✅ Passing | [`test/session_key.spec.ts`](../test/session_key.spec.ts) |

### What Is Simulated

| Component | Status | Why |
|---|---|---|
| SmartSessionValidator installation on Safe | ✅ Live | Installed on Safe [`0xC006bfc3Cac01634168e9cD0a1fEbD4Ffb816e14`](https://sepolia.basescan.org/address/0xC006bfc3Cac01634168e9cD0a1fEbD4Ffb816e14) via Rhinestone-attested ERC-7579 launchpad. `isModuleInstalled(validator)` returns `true`. See [`v5_install_session_validator.ts`](../scripts/v5_install_session_validator.ts). |
| Agent submitting UserOps via session signature | ⚠️ Demo uses owner key | Demo scripts use `cast send` (owner key). The E2E test submits real UserOps via Pimlico. In production, the agent would sign UserOps using its session credential via the installed SmartSessionValidator. |

### On-Chain Budget Enforcement

The `agentAllowances` mapping in `AegisModule.sol` provides **mathematically enforced** budget control:

1. `subscribeAgent(agent, budget)` — sets `agentAllowances[agent] = budget`
2. `triggerSwap` checks `agentAllowances[msg.sender] >= amountIn` before executing
3. Budget is deducted **before** the external call (CEI pattern — prevents reentrancy)
4. `revokeAgent(agent)` — sets `agentAllowances[agent] = 0` immediately

All of this is verified by Forge tests (`test_triggerSwap_deductsBudget`, `test_triggerSwap_insufficientBudget`). The SmartSessionValidator adds **function-level selector gating** at the Safe level — defense in depth on top of the existing budget enforcement.

### Key Files

- [`scripts/v5_session_config.ts`](../scripts/v5_session_config.ts) — ERC-7715 session builder (pure config, no network calls)
- [`test/session_key.spec.ts`](../test/session_key.spec.ts) — Session key configuration tests
- [`src/AegisModule.sol`](../src/AegisModule.sol) — On-chain budget enforcement (`agentAllowances`)

---

## Summary — Real vs Simulated

| Layer | Standard | On-Chain? | What's Real | What's Simulated |
|---|---|---|---|---|
| **Wallet** | ERC-4337 | ✅ | Safe Smart Account + Pimlico Bundler | Demo scripts use `cast send` instead of UserOps |
| **Plugin** | ERC-7579 | ✅ | AegisModule installed as Executor, 21 tests | Swap is mock (no DEX liquidity on testnet) |
| **Permissions** | ERC-7715 | ✅ | Session config built, budget enforced on-chain | SmartSessionValidator installation is a deployment step |

> **Bottom line:** The smart contract security layer (budgets, revocation, firewall enforcement) is **fully live on Base Sepolia**. The ERC-7715 session key configuration is architecturally complete and unit-tested. The `agentAllowances` mapping in `AegisModule.sol` enforces per-agent budgets on-chain — the SmartSessionValidator adds an additional layer of function-selector gating at the Safe level, which is a deployment step rather than a code gap.
