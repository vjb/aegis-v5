# 📋 Sample Output — Aegis Protocol V5

> **Raw, unmodified captures from actual test and demo script runs on Base Sepolia.**
>
> These files are captured directly from script execution via `| Out-File`. Nothing has been edited, cleaned, or modified. Spinner artifacts and control characters are preserved as-is to prove authenticity.

## Files

| File | Script | What It Proves |
|---|---|---|
| [forge_tests.txt](forge_tests.txt) | `forge test -vv` | 18 Solidity tests passing |
| [jest_tests.txt](jest_tests.txt) | `npx jest` | 95 TypeScript tests passing across 8 suites |
| [heimdall_tests.txt](heimdall_tests.txt) | `npx jest heimdall` | 6 Heimdall live integration tests (real GPT-4o + bytecode decompilation) |
| [demo_v5_setup_run.txt](demo_v5_setup_run.txt) | `demo_v5_setup.ps1` | Infrastructure boot: Base Sepolia ✅, Docker ✅, WASM ✅ |
| [demo_v5_master_run.txt](demo_v5_master_run.txt) | `demo_v5_master.ps1` | Full 7-act lifecycle: subscribe → audit → CRE AI → swap/revert → budget → kill switch |
| [demo_v5_cre_run.txt](demo_v5_cre_run.txt) | `demo_v5_cre.ps1` | Raw CRE WASM execution with GPT-4o + Llama-3 consensus |
| [demo_v5_heimdall_run.txt](demo_v5_heimdall_run.txt) | `demo_v5_heimdall.ps1` | **Heimdall pipeline:** eth_getCode → bytecode decompilation → GPT-4o detects MALICIOUS |
| [erc4337_userop_run.txt](erc4337_userop_run.txt) | `v5_e2e_mock.ts` | **ERC-4337 proof:** Safe deploy → Pimlico UserOp → triggerSwap via Account Abstraction |
| [session_validator_install.txt](session_validator_install.txt) | `v5_install_session_validator.ts` | **ERC-7579 proof:** Safe deploy → SmartSessionValidator installed → agent subscribed (session signing is [roadmap](../../docs/ERC7579_ROADMAP.md)) |

## Key Highlights in `demo_v5_master_run.txt`

- **Act 2**: `subscribeAgent(NOVA, 0.05 ETH)` + `subscribeAgent(CIPHER, 0.008 ETH)` — real on-chain txs
- **Act 4**: Live CRE WASM execution — GoPlus detects honeypot, GPT-4o + Llama-3 both flag `privilegeEscalation: true`
- **Act 5**: MockBRETT swap ✅ SUCCESS, MockHoneypot swap ❌ `TokenNotCleared()` REVERT
- **Act 6**: `agentAllowances()` proves budget was deducted on-chain
- **Act 7**: `revokeAgent(REX)` — budget zeroed, access denied

## How These Were Generated

```powershell
# Each file was captured with:
powershell -ExecutionPolicy Bypass -File .\scripts\<script>.ps1 2>&1 | Out-File docs\sample_output\<output>.txt -Encoding utf8
```

All runs were executed on **2026-03-01** against **Base Sepolia (Chain ID 84532)**.
