# 📚 Aegis V5 — Documentation

> **Technical deep-dives, architecture diagrams, and operational guides for the Aegis Protocol V5 stack.**

| Document | What It Is |
|---|---|
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | **Start here.** How to run the V5 demo scripts on Base Sepolia |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture — 12 Mermaid diagrams (ERC-7579 → CRE → ERC-4337) |
| [ERC_STANDARDS.md](ERC_STANDARDS.md) | ERC-4337 + ERC-7579 + ERC-7715 — what is live vs simulated |
| [CONFIDENTIAL_HTTP.md](CONFIDENTIAL_HTTP.md) | Privacy track — how `ConfidentialHTTPClient` protects all API keys and source code |
| [HEIMDALL_PIPELINE.md](HEIMDALL_PIPELINE.md) | Experimental: bytecode decompilation for unverified contracts (standalone demo) |
| [BUNDLER_STRATEGY_DECISION.md](BUNDLER_STRATEGY_DECISION.md) | Why Pimlico Cloud Bundler was selected over direct `handleOps` |
| [LESSONS_LEARNED.md](LESSONS_LEARNED.md) | Engineering ledger — bugs, root causes, fixes from the full V3→V5 journey |
| [sample_output/](sample_output/) | Raw captured test/demo output for hackathon judges |

## Sample Output

See [sample_output/README.md](sample_output/README.md) for the full index of captured test/demo output files.

## Demo Script Features

All three demo scripts (`setup`, `master`, `cre`) feature:
- **V3-style ActIntro boxes** — bordered explainers before each scene in `-Interactive` mode
- **Animated spinners** — visual feedback for on-chain transactions
- **Color-coded output** — GoPlus (Yellow), BaseScan (DarkCyan), GPT-4o (Cyan), Llama-3 (Magenta)
- **Summary checklists** — phase completion boxes at the end of each script
- **Success/Info helpers** — consistent formatting across all scripts

The main demo now runs 7 acts: Treasury → Subscribe Agents → Audit Intents → CRE AI → Swap/Revert → Budget Verification → Kill Switch

## Engineering Notes

See [LESSONS_LEARNED.md](LESSONS_LEARNED.md) for the full engineering ledger — CRE CLI gotchas, WASM caching, Docker setup, and all bugs encountered during V3→V5 development.
