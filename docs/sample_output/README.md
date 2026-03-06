# 📋 Sample Output — Aegis Protocol V5

> **Raw, unmodified captures from actual test and demo script runs on Base Sepolia.**
>
> These files are captured directly from script execution via `| Tee-Object`. Spinner artifacts and control characters are preserved as-is to prove authenticity.

## Demo Scripts

| File | Script | What It Proves |
|---|---|---|
| [demo_v5_setup_run.txt](demo_v5_setup_run.txt) | `demo_v5_setup.ps1` | Infrastructure boot: Base Sepolia ✅, Docker ✅, WASM ✅ |
| [demo_v5_master_run.txt](demo_v5_master_run.txt) | `demo_v5_master.ps1` | Full 7-act lifecycle: subscribe → session key audit → CRE AI → swap/revert → budget → kill switch |
| [demo_v5_cre_run.txt](demo_v5_cre_run.txt) | `demo_v5_cre.ps1` | Raw CRE WASM execution with GPT-4o + Llama-3 consensus |
| [demo_v5_heimdall_run.txt](demo_v5_heimdall_run.txt) | `demo_v5_heimdall.ps1` | **Heimdall pipeline:** eth_getCode → bytecode decompilation → GPT-4o detects MALICIOUS |

## Tests

| File | Script | What It Proves |
|---|---|---|
| [forge_tests.txt](forge_tests.txt) | `forge test -vv` | 18/18 Solidity tests passing |
| [jest_tests.txt](jest_tests.txt) | `npx jest` | 92 TypeScript tests passing, 1 skipped |
| [heimdall_tests.txt](heimdall_tests.txt) | `npx jest heimdall` | 6 Heimdall live integration tests (real GPT-4o + bytecode decompilation) |

## Session Keys (ERC-7715)

| File | Script | What It Proves |
|---|---|---|
| [session_key_demo.txt](session_key_demo.txt) | `session_key_demo.ts` | Agent signs `requestAudit` UserOp with session key — owner key NOT used |
| [session_validator_install.txt](session_validator_install.txt) | `v5_install_session_validator.ts` | Safe deploy → SmartSessions (ERC-7715) installed → agent subscribed |
| [session_key_results.txt](session_key_results.txt) | Session key verification | Safe address, session key address, tx hash, SUCCESS status |

## ERC-4337 Account Abstraction

| File | Script | What It Proves |
|---|---|---|
| [erc4337_userop_run.txt](erc4337_userop_run.txt) | `v5_e2e_mock.ts` | Safe deploy → Pimlico UserOp → triggerSwap via Account Abstraction |
| [v5_e2e_mock_run.txt](v5_e2e_mock_run.txt) | `v5_e2e_mock.ts` | Full 5-phase E2E: deploy → fund → audit → oracle → swap |

## How These Were Generated

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\<script>.ps1 2>&1 | Tee-Object -FilePath docs\sample_output\<output>.txt
```

All runs were executed on **2026-03-06** against **Base Sepolia (Chain ID 84532)**.
