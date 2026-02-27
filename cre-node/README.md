# 🔗 Aegis V4 — Chainlink CRE Oracle Node

The Chainlink Runtime Environment (CRE) oracle that powers Aegis V4's off-chain AI security audit pipeline. All external API calls go through `ConfidentialHTTPClient` — API keys never leave the DON.

## What It Does

When `AegisModule.requestAudit(token)` is called on-chain, the CRE workflow:

1. **Detects** the `AuditRequested` event via EVM log trigger (WASM sandbox)
2. **Phase 1 — GoPlus** — static on-chain analysis via `ConfidentialHTTPClient`. Attempts JWT auth with `AEGIS_GOPLUS_KEY`; falls back to unauthenticated free tier on same channel. Checks: honeypot, sell restriction, proxy, unverified source.
3. **Phase 2 — BaseScan** — fetches full Solidity source via `ConfidentialHTTPClient`. `AEGIS_BASESCAN_SECRET` stays in the DON.
4. **Phase 3 — AI Consensus** — sends source to GPT-4o and Llama-3 (each via `ConfidentialHTTPClient`). Both models independently audit for: obfuscated tax, privilege escalation, external call risk, logic bombs. **Union of Fears:** blocked if EITHER model raises a flag.
5. **Delivers** `onReport(tradeId, riskScore)` to `AegisModule` via `KeystoneForwarder`.

## Files

| File | Purpose |
|---|---|
| `aegis-oracle.ts` | Main CRE workflow — 3-phase audit pipeline |
| `workflow.yaml` | CRE workflow config — links oracle to AegisModule address |
| `project.yaml` | CRE project config — chains, RPC URLs |
| `config.json` | Runtime config — `vaultAddress` = AegisModule |
| `secrets.yaml` | Maps CRE secret IDs → `.env` variable names |
| `Dockerfile` | Ubuntu 24.04 + Node 20 + Bun + Foundry + CRE CLI + Javy |

## Running the Oracle

### First time only
```bash
docker compose up --build -d
docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"
```

### Register secrets (once per CRE installation)
```bash
cre workflow secrets set --id AEGIS_BASESCAN_SECRET  --value <key>
cre workflow secrets set --id AEGIS_OPENAI_SECRET    --value <key>
cre workflow secrets set --id AEGIS_GROQ_SECRET      --value <key>
cre workflow secrets set --id AEGIS_GOPLUS_KEY       --value <key>   # optional — enables auth tier
cre workflow secrets set --id AEGIS_GOPLUS_SECRET    --value <key>   # optional
```

### Using the launcher script
```powershell
.\scripts\start_oracle.ps1
```

### Simulate manually (from a tx hash)
```bash
docker exec aegis-oracle-node bash -c "
  cd /app && cre workflow simulate /app \
    --evm-tx-hash <TX_HASH> \
    --evm-event-index 0 \
    --non-interactive --trigger-index 0 \
    -R /app -T tenderly-fork
"
```

## ConfidentialHTTPClient — Privacy Architecture

Every external API call uses `ConfidentialHTTPClient`, never plain `HTTPClient`:

| API | Secret ID | Channel |
|---|---|---|
| GoPlus JWT auth | `AEGIS_GOPLUS_KEY` + `AEGIS_GOPLUS_SECRET` | ConfidentialHTTPClient |
| GoPlus token_security | — (key stayed in DON) | ConfidentialHTTPClient |
| BaseScan source fetch | `AEGIS_BASESCAN_SECRET` | ConfidentialHTTPClient |
| OpenAI GPT-4o | `AEGIS_OPENAI_SECRET` | ConfidentialHTTPClient |
| Groq Llama-3 | `AEGIS_GROQ_SECRET` | ConfidentialHTTPClient |

## 8-Bit Risk Matrix

```
Bit 0 — Unverified source code  (GoPlus)
Bit 1 — Sell restriction        (GoPlus)
Bit 2 — Honeypot                (GoPlus)
Bit 3 — Proxy contract          (GoPlus)
Bit 4 — Obfuscated tax          (AI consensus — GPT-4o + Llama-3)
Bit 5 — Privilege escalation    (AI consensus)
Bit 6 — External call risk      (AI consensus)
Bit 7 — Logic bomb              (AI consensus)
```

`riskScore == 0` → CLEARED → `isApproved[token] = true`
`riskScore  > 0` → DENIED  → `ClearanceDenied` event emitted

## Mock Token Registry (for Tenderly Testing)

Tokens at these addresses return mock GoPlus data and include real malicious Solidity source that is sent to live GPT-4o and Llama-3:

| Address | Token | GoPlus Mock | AI Flags | Expected Risk Code |
|---|---|---|---|---|
| `0x...000b` | HoneypotCoin | `is_honeypot=1` | GPT-4o: privilege escalation | 36 (honeypot + priv) |
| `0x...000c` | TaxToken | `cannot_sell_all=1` | GPT-4o + Llama-3: obfuscated 99% tax | 18 (sellRestriction + obfuscatedTax) |

> The AI models read the actual Solidity source and produce independent reasoning. These are not hardcoded verdicts.

## CRE YAML Format

The `--target` flag maps to the **top-level key** in `workflow.yaml` and `project.yaml`:

```yaml
# ✅ Correct
tenderly-fork:
  user-workflow:
    workflow-name: "aegis-oracle-v4"
```

## Required Environment Variables

```bash
OPENAI_API_KEY=...       # GPT-4o
GROQ_API_KEY=...         # Llama-3
BASESCAN_API_KEY=...     # Source code fetch
CRE_ETH_PRIVATE_KEY=...  # Oracle signing key
GOPLUS_APP_KEY=...       # Optional — GoPlus authenticated tier
GOPLUS_APP_SECRET=...    # Optional — GoPlus authenticated tier
```
