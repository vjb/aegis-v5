[🏠 Back to Main README](../README.md)

# 🧪 Aegis V5 — Scripts

Operational scripts for the Aegis V5 Account Abstraction stack on Base Sepolia.

## Scripts Overview

| Script | Purpose |
|---|---|
| `demo_v5_setup.ps1` | Act 0: Infrastructure boot (Docker, WASM, connectivity) · [output](../docs/sample_output/demo_v5_setup_run.txt) |
| `demo_v5_master.ps1` | Acts 1–7: Full live E2E demo (bank → keys → audit → CRE → swap/revert → budget → revoke) · [output](../docs/sample_output/demo_v5_master_run.txt) |
| `demo_v5_cre.ps1` | Standalone CRE WASM showcase for Chainlink judges · [output](../docs/sample_output/demo_v5_cre_run.txt) |
| `v5_setup_safe.ts` | Deploy Safe Smart Account + install AegisModule via Pimlico |
| `v5_e2e_mock.ts` | Full 5-phase E2E test (Base Sepolia, mocked oracle callback) · [output](../docs/sample_output/erc4337_userop_run.txt) |
| `v5_bot_config.ts` | ABI calldata builders for `requestAudit` and `triggerSwap` |
| `v5_safe_config.ts` | Safe Smart Account configuration constants |
| `v5_session_config.ts` | Agent scope configuration (allowance display) |
| `v5_audit_userop.ts` | Submit `requestAudit` via **Session Key** UserOp — owner key NOT used |
| `v5_swap_userop.ts` | Submit `triggerSwap` via **Session Key** UserOp — owner key NOT used |
| `v5_session_utils.ts` | Shared session key utility — Safe + SmartSessions creation, scoped permissions, `sendSessionKeyUserOp()` |
| `v5_install_session_validator.ts` | Deploy Safe with SmartSessions (ERC-7715) pre-installed · [output](../docs/sample_output/session_validator_install.txt) |
| `session_key_demo.ts` | Session key proof: agent submits `requestAudit` UserOp without owner key · [output](../docs/sample_output/session_key_demo.txt) |

---

## Demo Scripts (Cinematic Presentation)

All three cinematic scripts accept `-Interactive` for paused narration (for Loom recording):

```powershell
# Act 0 — Infrastructure Boot
.\scripts\demo_v5_setup.ps1 -Interactive

# Acts 1-5 — Full E2E: Bank → Keys → Audit → LIVE CRE → Swap/Revert
.\scripts\demo_v5_master.ps1 -Interactive

# Standalone CRE — Raw WASM execution for Chainlink judges
.\scripts\demo_v5_cre.ps1 -Interactive
# Or pass a specific tx hash:
.\scripts\demo_v5_cre.ps1 -TxHash 0xabc123...
```

---

## `v5_setup_safe.ts` — Safe Account Deployment

Deploys a Safe Smart Account on Base Sepolia with SmartSessions (ERC-7715). AegisModule (ERC-7579 Executor) is deployed separately. Session key scripts (`v5_audit_userop.ts`, `v5_swap_userop.ts`) deploy their own Safe with scoped session permissions via `v5_session_utils.ts`.

```bash
pnpm ts-node --transpile-only scripts/v5_setup_safe.ts
```

**What it does:**
1. Creates Safe Smart Account via Pimlico’s `toSafeSmartAccount`
2. Deploys Safe via first UserOp (initCode)
3. Calls `onInstall()` on AegisModule
4. Prints the Safe address for `.env`

---

## `v5_e2e_mock.ts` — Full E2E Test

Proves the full module lifecycle on Base Sepolia with mocked oracle callback.

```bash
pnpm ts-node --transpile-only scripts/v5_e2e_mock.ts
```

**5 Phases:**
1. Deploy Safe + install module
2. Fund treasury + subscribe agent
3. `requestAudit(MockBRETT)` via UserOp
4. Mock oracle callback (`onReportDirect`)
5. `triggerSwap(MockBRETT)` via UserOp → swap success

---

## Environment Setup

See the [Configure Environment](../README.md#3-configure-environment) section in the root README for the full list of required API keys and deployed addresses.
