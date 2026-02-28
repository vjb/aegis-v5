# 📚 Aegis V5 — Documentation

> **Technical deep-dives, architecture diagrams, and operational guides for the Aegis Protocol V5 stack.**

| Document | What It Is |
|---|---|
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | **Start here.** How to run the V5 demo scripts on Base Sepolia |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture — 12 Mermaid diagrams (ERC-7579 → CRE → ERC-4337) |
| [CONFIDENTIAL_HTTP.md](CONFIDENTIAL_HTTP.md) | Privacy track — how `ConfidentialHTTPClient` protects all API keys and source code |
| [BUNDLER_STRATEGY_DECISION.md](BUNDLER_STRATEGY_DECISION.md) | Why Pimlico Cloud Bundler was selected over direct `handleOps` |
| [LESSONS_LEARNED.md](LESSONS_LEARNED.md) | Engineering ledger — bugs, root causes, fixes from the full V3→V5 journey |
| [sample_output/](sample_output/) | Raw captured test/demo output for hackathon judges |

## Sample Output Files

| File | Description |
|---|---|
| [forge_tests.txt](sample_output/forge_tests.txt) | 21 Forge tests passing (18 AegisModule + 3 template tests) |
| [jest_tests.txt](sample_output/jest_tests.txt) | 83 Jest tests passing across 7 suites |
| [demo_v5_setup_run.txt](sample_output/demo_v5_setup_run.txt) | Infrastructure boot: Base Sepolia, Docker, WASM compilation |
| [demo_v5_master_run.txt](sample_output/demo_v5_master_run.txt) | Full 7-act lifecycle with live CRE AI consensus |
| [demo_v5_cre_run.txt](sample_output/demo_v5_cre_run.txt) | Raw CRE WASM execution against a known honeypot |

## Demo Script Features

All three demo scripts (`setup`, `master`, `cre`) feature:
- **V3-style ActIntro boxes** — bordered explainers before each scene in `-Interactive` mode
- **Animated spinners** — visual feedback for on-chain transactions
- **Color-coded output** — GoPlus (Yellow), BaseScan (DarkCyan), GPT-4o (Cyan), Llama-3 (Magenta)
- **Summary checklists** — phase completion boxes at the end of each script
- **Success/Info helpers** — consistent formatting across all scripts

The master demo now runs 7 acts: Treasury → Subscribe Agents → Audit Intents → CRE AI → Swap/Revert → Budget Verification → Kill Switch

## Quick Engineering Notes

### CRE CLI `--target` Format
`--target` maps to the **top-level YAML key**:
```yaml
base-sepolia:          # ← This IS the target name
  user-workflow:
    workflow-name: "aegis-oracle-v5"
```

### First-Time Docker Setup
```bash
docker compose up --build -d
# entrypoint.sh automatically runs bun x cre-setup (compiles WASM)
```

### GoPlus Auth
All GoPlus calls use `ConfidentialHTTPClient` — even unauthenticated ones. See [CONFIDENTIAL_HTTP.md](CONFIDENTIAL_HTTP.md) for the full privacy story.
```bash
cre workflow secrets set --id AEGIS_GOPLUS_KEY    --value <app-key>
cre workflow secrets set --id AEGIS_GOPLUS_SECRET --value <app-secret>
```

### CRE WASM Cache
The CRE caches compiled WASM at `/root/.cre/`. After editing `aegis-oracle.ts`, clear the cache before re-simulating:
```bash
docker exec aegis-oracle-node bash -c "find /root/.cre -type f ! -name 'cre.yaml' ! -name 'update.json' | xargs rm -f"
```

### CRE Simulate Is a Dry-Run
`cre workflow simulate` does NOT write to the real chain. After simulation, parse `Final Risk Code` from `[USER LOG]` output and call `onReportDirect(tradeId, riskCode)` separately to commit the verdict on-chain.
