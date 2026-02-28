# 📚 Aegis V5 — Documentation

> **Technical deep-dives, architecture diagrams, and operational guides for the Aegis Protocol V5 stack.**

| Document | What It Is |
|---|---|
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | **Start here.** How to run the V5 demo scripts on Base Sepolia |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture — 12 Mermaid diagrams (ERC-7579 → CRE → ERC-4337) |
| [CONFIDENTIAL_HTTP.md](CONFIDENTIAL_HTTP.md) | Privacy track — how `ConfidentialHTTPClient` protects all API keys and source code |
| [BUNDLER_STRATEGY_DECISION.md](BUNDLER_STRATEGY_DECISION.md) | Why Pimlico Cloud Bundler was selected over direct `handleOps` |
| [LESSONS_LEARNED.md](LESSONS_LEARNED.md) | Engineering ledger — bugs, root causes, fixes from the full V3→V5 journey |
| [sample_output/](sample_output/) | Real CRE oracle output from verified demo runs |

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
