# 📚 Aegis V4 — Documentation

| Document | What It Is |
|---|---|
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | **Start here.** How to run all 3 demo scripts, what each shows, what judges see. Full CRE pipeline log excerpts included. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture diagrams — 12 Mermaid diagrams covering the full ERC-7579 → CRE → Uniswap flow |
| [ERC7579_ROADMAP.md](ERC7579_ROADMAP.md) | V3→V4 architecture roadmap — ERC-7579 module design, execution lifecycle, production path |
| [lessons_learned.md](lessons_learned.md) | Engineering ledger — every bug, root cause, and fix across all phases. Critical reference before debugging. |
| [sample_output/](sample_output/) | Real CRE oracle output from verified demo runs |

## Sample Output Files

| File | Description |
|---|---|
| [demo_1_cre_oracle.txt](sample_output/demo_1_cre_oracle.txt) | BRETT audited — GoPlus + BaseScan + GPT-4o + Llama-3 → Risk Code 0 |
| [demo_2_multi_agent.txt](sample_output/demo_2_multi_agent.txt) | TaxToken (Risk Code 18) and HoneypotCoin (Risk Code 36) blocked by AI |
| [demo_3_erc7579_architecture.txt](sample_output/demo_3_erc7579_architecture.txt) | Full ERC-7579 lifecycle: install → deposit → audit → swap → anti-replay → uninstall |

## Quick Engineering Notes

### CRE CLI `--target` Format
`--target` maps to the **top-level YAML key**, not a `targets:` section:
```yaml
tenderly-fork:          # ← This IS the target name
  user-workflow:
    workflow-name: "aegis-oracle-v4"
```

### First-Time Docker Setup
```bash
docker compose up --build -d
docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"
```

### GoPlus Auth
The oracle always uses `ConfidentialHTTPClient` for GoPlus — even unauthenticated calls.
To enable the authenticated tier (premium fields):
```bash
cre workflow secrets set --id AEGIS_GOPLUS_KEY    --value <app-key>
cre workflow secrets set --id AEGIS_GOPLUS_SECRET --value <app-secret>
```

See [lessons_learned.md](lessons_learned.md) for the full engineering ledger.
