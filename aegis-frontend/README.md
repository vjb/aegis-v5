# 🖥️ Aegis Protocol V4 — Frontend

Next.js UI for the Aegis Protocol. Connects to a live Tenderly VNet and the Chainlink CRE oracle to show real-time audit results, agent activity, and on-chain verdicts.

## Features

- **Oracle Feed** — live streaming log of the CRE pipeline (GoPlus → BaseScan → GPT-4o → Llama-3 → verdict)
- **Wallet connect** — connects to MetaMask or any injected provider
- **Agent dashboard** — shows subscribed agents, their budgets, and trade history
- **Firewall tab** — displays active risk blocks and bypassed attempts
- **Marketplace** — browse verified safe tokens cleared by the oracle

## Getting Started

```bash
cd aegis-frontend
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Requires:** A running Tenderly VNet (run `.\scripts\new_tenderly_testnet.ps1` from repo root) and the CRE oracle Docker node (run `.\scripts\start_oracle.ps1`).

## Environment

The frontend reads `TENDERLY_RPC_URL` and `AEGIS_MODULE_ADDRESS` from the root `.env` via the dev server. No separate `.env` needed in this directory for local development.

## Triggering a Demo Audit from the UI

1. Connect your wallet (MetaMask, set to the Tenderly VNet network)
2. Navigate to the **Agents** tab and deposit ETH into the module
3. Subscribe an agent with a budget
4. Click a token to trigger `requestAudit()` — the Oracle Feed will animate in real-time
5. Watch the CRE pipeline stream: GoPlus → BaseScan → GPT-4o → Llama-3 → verdict

## Key Components

| Component | File | Description |
|---|---|---|
| Oracle Feed | `components/OracleFeed.tsx` | Live streaming CRE log with phase indicators |
| Wallet | `components/WalletConnect.tsx` | MetaMask / injected provider connection |
| Agent Dashboard | `components/AgentDashboard.tsx` | Agent subscription management |
| Firewall Tab | `components/FirewallTab.tsx` | Real-time block/clear history |

## Related

- [Root README](../README.md) — full protocol overview
- [Demo Guide](../docs/DEMO_GUIDE.md) — how to run all 3 demo scripts
- [CRE Oracle](../cre-node/README.md) — oracle node setup
