# Aegis V4 — Engineering Ledger

| Date | Component | Issue | Resolution |
|---|---|---|---|
| 2026-02-26 | Phase 0 | Initial setup | Rhinestone module-template scaffolded via `forge init` |
| 2026-02-26 | Phase 0 | `UserOpGasLog.sol` solar linter import error | Patched import path from `src/external/ERC4337.sol` → `modulekit/external/ERC4337.sol` |
| 2026-02-26 | Phase 2 | `viem.parseAbiParameters` TS type error in Jest | Replaced `parseAbiParameters("uint256, uint256")` with `[{ type: "uint256" }, { type: "uint256" }]` inline objects |
| 2026-02-26 | Phase 4 | `e2e_mock_simulation.ts` viem type errors in ts-node | Added `// @ts-nocheck` — simulation scripts are runtime, not library code |
| 2026-02-27 | Phase 5 | `cre workflow simulate --target` failing with "target not found" | The `--target` flag maps to the **top-level YAML key** in `workflow.yaml` and `project.yaml`, not a `targets:` section or `settings/` subfolder. V3 working format: `tenderly-fork:` as the root key |
| 2026-02-27 | Phase 5 | `cre workflow simulate` failing with WASM compile error | `bun x cre-setup` must be run inside the Docker container before first simulate to download the Javy plugin WASM |
| 2026-02-27 | Phase 5 | CRE simulate ABI mismatch concern | V4 `onReport(uint256 tradeId, uint256 riskScore)` ABI is identical to V3 — no change needed in oracle encoding |
