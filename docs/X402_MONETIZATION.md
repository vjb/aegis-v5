# x402 Oracle Monetization

Aegis exposes its CRE threat-intelligence pipeline as a **paid API** using the [x402 HTTP payment protocol](https://x402.org). Any AI agent can request a token audit; the endpoint returns HTTP 402 with USDC payment instructions, verifies the signed authorization through the Coinbase facilitator, and only then runs the full pipeline.

## How It Works

```
Agent                        Aegis API                   Facilitator (x402.org)
  │                              │                              │
  │  GET /api/oracle/audit       │                              │
  │  ?token=0x...                │                              │
  │─────────────────────────────►│                              │
  │                              │                              │
  │  402 Payment Required        │                              │
  │  { accepts: [USDC, $0.05] }  │                              │
  │◄─────────────────────────────│                              │
  │                              │                              │
  │  GET /api/oracle/audit       │                              │
  │  X-PAYMENT: <signed EIP-3009>│                              │
  │─────────────────────────────►│  POST /verify                │
  │                              │─────────────────────────────►│
  │                              │  { isValid: true }           │
  │                              │◄─────────────────────────────│
  │                              │                              │
  │                              │  [run CRE pipeline]          │
  │                              │                              │
  │  200 OK                      │  POST /settle                │
  │  { riskCode, verdict, ... }  │─────────────────────────────►│
  │◄─────────────────────────────│  { success, txHash }         │
  │                              │◄─────────────────────────────│
```

1. **No payment** → 402 with USDC payment instructions (price, network, asset address).
2. **With `X-PAYMENT` header** → facilitator verifies the EIP-3009 `transferWithAuthorization` signature.
3. **If valid** → GoPlus + BaseScan + GPT-4o pipeline runs, returns 8-bit risk mask.
4. **Settlement** → USDC transfer is submitted on-chain *after* the successful response.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `TREASURY_ADDRESS` | Safe Smart Account | Wallet that receives USDC payments |
| `OPENAI_API_KEY` | `.env` | GPT-4o for source code analysis |
| `BASESCAN_API_KEY` | `.env` | Contract source retrieval |

## Endpoint

```
GET /api/oracle/audit?token=0x<address>
```

### Without Payment (HTTP 402)

```json
{
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "50000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xC006bfc3Cac01634168e9cD0a1fEbD4Ffb816e14",
    "description": "Aegis CRE Oracle Audit — 8-bit risk analysis via GoPlus + GPT-4o"
  }]
}
```

### With Payment (HTTP 200)

```json
{
  "protocol": "x402",
  "payment": "$0.05 USDC",
  "token": "0x46d40e...",
  "pipeline": "Aegis CRE v5",
  "goplus": { "honeypot": false, "proxy": false },
  "ai": { "obfuscatedTax": true, "reasoning": "Hidden 15% sell tax..." },
  "riskCode": 53,
  "verdict": "BLOCKED"
}
```

## Receipt Page

After a successful payment, the audit result can be viewed as a styled receipt at:

```
/oracle/receipt
```

## Files

| File | Role |
|---|---|
| `aegis-frontend/app/api/oracle/audit/route.ts` | x402-gated API endpoint |
| `aegis-frontend/app/oracle/receipt/page.tsx` | Styled transaction receipt page |
| `test/x402/OracleMonetizationLive.spec.ts` | Live integration tests (4 tests) |

## Branch

`feature/x402-monetization`
