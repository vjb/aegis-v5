---
name: aegis-v3-architecture
description: >
  Deep knowledge of the Aegis Protocol V3 — a "Smart Treasury" system where
  an autonomous trading agent operates within hard boundaries enforced by an
  on-chain vault and a Chainlink CRE Security DON. Covers the AegisVault.sol
  contract, the CRE oracle (aegis-oracle.ts), the BYOA standalone agent (bot.ts),
  the Tenderly VNet testing environment, and all deployment patterns.
---

# Aegis Protocol V3 — Architecture Skill

## Mental Model

Think of AegisVault as **a company credit card that only works at pre-approved stores**.

- The **owner** (human) deposits ETH into the vault treasury and sets the firewall policy.
- An **authorized agent** (AI bot / 3rd-party) has a spending budget but ZERO custody
  of the underlying capital. Its wallet holds gas ETH only.
- Before any swap, the agent submits a **trade intent** on-chain (`requestAudit`).
- The **Chainlink CRE DON** intercepts the `AuditRequested` event, forensically audits
  the target token contract, and calls back `onReport()` with a risk score.
- The vault only permits `executeSafeSwap()` if clearance was granted **and** the agent
  is within its budget cap.

This enforces three orthogonal safety layers simultaneously:
1. **Firewall Layer** — CRE DON risk audit (GoPlus + AI LLM consensus)
2. **Budget Cap Layer** — on-chain `agentAllowances[msg.sender]` deducted atomically
3. **Clearance Layer** — `isApproved[token]` flag, reset after each swap (anti-replay)

---

## AegisVault.sol — Contract Architecture

**Deployment target:** Base Mainnet / Tenderly Base fork  
**Key addresses (Base):**
- `SWAP_ROUTER` = `0x2626664c2603336E57B271c5C0b26F421741e481` (Uniswap V3 SwapRouter02)
- `WETH` = `0x4200000000000000000000000000000000000006`

### State Variables

| Variable | Type | Purpose |
|---|---|---|
| `owner` | `address` | Sole authority over treasury and policy |
| `agentAllowances[agent]` | `mapping(address => uint256)` | Per-agent ETH budget (wei). Zero = revoked. |
| `tradeRequests[tradeId]` | `mapping(uint256 => TradeRequest)` | Pending audit intents |
| `nextTradeId` | `uint256` | Auto-incrementing trade ID |
| `isApproved[token]` | `mapping(address => bool)` | CRE clearance per token (cleared after swap) |
| `firewallConfig` | `string` | JSON policy set by owner, applied to all agent requests |
| `keystoneForwarder` | `address` | Only address allowed to call `onReport()` |

### Key Functions

#### Treasury Management (owner only)
```solidity
depositETH() external payable                        // fund the vault
subscribeAgent(address agent, uint256 budget)        // grant agent a budget
revokeAgent(address agent)                           // zero out budget instantly
setFirewallConfig(string calldata config)            // update firewall JSON
withdrawETH(uint256 amount)                          // owner reclaims ETH
withdrawERC20(address token, uint256 amount)         // owner reclaims tokens
```

#### The 3-Step Agent Flow
```solidity
// Step 1 — Agent submits intent (emits AuditRequested, triggers CRE DON)
requestAudit(address token) onlyOwnerOrAgent returns (uint256 tradeId)

// Step 2 — Chainlink DON delivers verdict (called by KeystoneForwarder)
onReport(bytes calldata metadata, bytes calldata report) external
// Internally decodes: (uint256 tradeId, uint256 riskScore) = abi.decode(report, ...)
// riskScore == 0 → isApproved[token] = true
// riskScore >  0 → ClearanceDenied emitted

// Bypass for testing (owner or forwarder can call directly)
onReportDirect(uint256 tradeId, uint256 riskScore) external

// Step 3 — Agent executes swap (only if cleared and within budget)
executeSafeSwap(address token, uint256 amountIn, uint256 amountOutMinimum) external
// Checks: agentAllowances[msg.sender] >= amountIn
//         isApproved[token] == true
//         address(this).balance >= amountIn
// Then: deducts budget, clears approval (CEI), tries 3 fee tiers (0.3%, 0.05%, 1%)
```

#### ERC165 Support
The contract implements `supportsInterface()` for **IReceiver** and **IERC165**  
because the Chainlink `KeystoneForwarder` checks `supportsInterface` before delivering reports.

### Default Firewall Config (JSON)
```json
{
  "maxTax": 5,
  "blockProxies": true,
  "strictLogic": true,
  "blockHoneypots": true
}
```
Extended config (used by CRE oracle):
```json
{
  "maxTax": 5,
  "blockProxies": true,
  "strictLogic": true,
  "maxOwnerHolding": 20,
  "minLiquidity": 1,
  "blockMintable": true,
  "blockHoneypots": true,
  "allowUnverified": false
}
```

### Events
```solidity
AuditRequested(uint256 indexed tradeId, address indexed user, address indexed targetToken, string firewallConfig)
FirewallConfigUpdated(string newConfig)
ClearanceUpdated(address indexed token, bool approved)
ClearanceDenied(address indexed token, uint256 riskScore)
SwapExecuted(address indexed targetToken, uint256 amountIn, uint256 amountOut)
TreasuryDeposit(address indexed from, uint256 amount)
TreasuryWithdrawal(address indexed to, uint256 amount)
AgentSubscribed(address indexed agent, uint256 allowance)
AgentRevoked(address indexed agent)
```

---

## CRE Oracle (aegis-oracle.ts) — Architecture

The oracle is a Chainlink CRE workflow that listens for `AuditRequested` events
and delivers a risk verdict back on-chain via `writeReport()`.

### Imports
```typescript
import { EVMClient, HTTPClient, ConfidentialHTTPClient, handler, Runner,
         getNetwork, hexToBase64, bytesToHex, ConsensusAggregationByFields,
         identical, ignore, median, type Runtime, type NodeRuntime, type EVMLog,
         TxStatus } from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";
```

### AuditResult Type (per-field consensus)
```typescript
type AuditResult = {
    targetAddress: string;
    goPlusStatus: string;
    unverifiedCode: number;      // Bit 0 — GoPlus: is_open_source === "0"
    sellRestriction: number;     // Bit 1 — GoPlus: cannot_sell_all === "1"
    honeypot: number;            // Bit 2 — GoPlus: is_honeypot === "1"
    proxyContract: number;       // Bit 3 — GoPlus: is_proxy === "1"
    obfuscatedTax: number;       // Bit 4 — AI: hidden fee-on-transfer
    privilegeEscalation: number; // Bit 5 — AI: backdoor minting/takeover
    externalCallRisk: number;    // Bit 6 — AI: dangerous delegatecall/reentrancy
    logicBomb: number;           // Bit 7 — AI: conditional reverts, time traps
};
```

### 3-Phase Execution Pipeline

**Phase 1 — Node Mode: GoPlus Static Analysis**  
Runs in DON node mode with `ConsensusAggregationByFields` (median = majority-vote).  
Fields: `targetAddress` (identical), `goPlusStatus` (ignore), all risk bits (median).

**Phase 2 — Confidential HTTP: BaseScan Source Fetch**  
Uses `ConfidentialHTTPClient` to protect the BaseScan API key.  
Supports up to 2 proxy-piercing hops (`contractData.Proxy === "1"`).  
Source code capped at 15 000 bytes before sending to LLMs.

**Phase 3 — Confidential HTTP: Dual-Model AI Consensus**  
- **OpenAI GPT-4o** (`temperature: 0.0`, `response_format: json_object`)
- **Groq Llama-3.1-8b-instant** (`temperature: 0.0`, `response_format: json_object`)
- Risk aggregation: **Union of Fears** — a flag is raised if EITHER model returns `true`.
- The AI prompt embeds the human-set `firewallConfig` rules (e.g. `maxTax`, `blockMintable`)
  so the operator's policy is enforced at the LLM reasoning level as well.

### Risk Matrix Encoding
```typescript
let riskMatrix = 0;
if (staticResult.unverifiedCode && !allowUnverified) riskMatrix |= 1;   // Bit 0
if (staticResult.sellRestriction)                    riskMatrix |= 2;   // Bit 1
if (staticResult.honeypot && blockHoneypots)         riskMatrix |= 4;   // Bit 2
if (staticResult.proxyContract && blockProxies)      riskMatrix |= 8;   // Bit 3
if (obfuscatedTax)                                   riskMatrix |= 16;  // Bit 4
if (privilegeEscalation)                             riskMatrix |= 32;  // Bit 5
if (externalCallRisk)                                riskMatrix |= 64;  // Bit 6
if (logicBomb)                                       riskMatrix |= 128; // Bit 7
```
`riskMatrix === 0` → clearance granted (`isApproved[token] = true`)  
`riskMatrix > 0`  → clearance denied, reason bitmask logged

### Report Delivery
```typescript
// ABI-encode (tradeId, riskMatrix) matching AegisVault.onReport signature
const reportDataHex = encodeAbiParameters(
    parseAbiParameters('uint256, uint256'),
    [tradeId, BigInt(riskMatrix)]
);
// Send via EVMClient.writeReport() → KeystoneForwarder → AegisVault.onReport()
evmClient.writeReport(runtime, {
    receiver: runtime.config.vaultAddress,
    report: reportResponse,
    gasConfig: { gasLimit: "500000" }
});
```

### Event Parsing — Critical Detail
`AuditRequested` has three **indexed** topics + one **non-indexed** string:
```
topics[0] = event signature hash
topics[1] = tradeId (indexed uint256)
topics[2] = user (indexed address)
topics[3] = targetToken (indexed address)
data       = ABI-encoded firewallConfig string (offset + length + bytes)
```
Parse `targetAddress` from `topics[3]`:
```typescript
const targetTokenHex = bytesToHex(log.topics[3]).replace("0x", "");
const targetAddress = "0x" + targetTokenHex.slice(-40).toLowerCase();
```
Parse `tradeId` from `topics[1]`:
```typescript
const tradeIdHex = bytesToHex(log.topics[1]);
const tradeId = BigInt(tradeIdHex.startsWith("0x") ? tradeIdHex : "0x" + tradeIdHex);
```

### Hack/Demo Mock Registry
For hackathon demos, the oracle intercepts requests to known dummy addresses
(e.g. `0x...000a` = UnverifiedDoge, `0x...000b` = HoneypotCoin, `0x...000c` = TaxToken)
and returns pre-built GoPlus + source data without making live API calls.

### CRE SDK Secrets (DON Vault Secrets)
```
AEGIS_BASESCAN_SECRET   → BaseScan/Etherscan API key
AEGIS_OPENAI_SECRET     → OpenAI API key
AEGIS_GROQ_SECRET       → Groq API key
```
All secret-bearing calls use `ConfidentialHTTPClient` with `vaultDonSecrets`.

### Workflow Initialization
```typescript
const initWorkflow = (config: Config) => {
    const evmClient = new EVMClient(network.chainSelector.selector);
    return [handler(
        evmClient.logTrigger({ addresses: [hexToBase64(config.vaultAddress)] }),
        onAuditTrigger
    )];
};
export async function main() {
    const runner = await Runner.newRunner<Config>();
    await runner.run(initWorkflow);
}
```
Config type: `{ vaultAddress: string; chainSelectorName: string; }`

---

## BYOA Standalone Agent (bot.ts) — Architecture

**"Bring Your Own Agent"** — proves 3rd-party AI agents can use the vault
without ever holding user capital.

### Key Design Principle
> Agent wallet holds **gas ETH only**.  
> All trading capital lives inside `AegisVault`.  
> The agent can never spend more than its `agentAllowances[agent]` budget.

### Dependencies
```typescript
import { createPublicClient, createWalletClient, http, parseEther, 
         getAddress, defineChain, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
```

### Chain Definition (Tenderly VNet, Base fork)
```typescript
const aegisTenderly = defineChain({
    id: 73578453,
    name: 'Aegis Tenderly VNet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [TENDERLY_RPC_URL] } },
    testnet: true
});
```

### 5-Step Agent Flow
1. `requestAudit(TARGET_TOKEN_ADDRESS)` — submits intent on-chain
2. Waits for `AuditRequested` tx to confirm
3. Polls for `ClearanceUpdated` or `ClearanceDenied` event (HTTP polling, not WS — Tenderly VNets don't support WebSocket subscriptions)
4. If approved → `executeSafeSwap(token, parseEther('1'), BigInt(1))`
5. If denied → logs reason, exits safely. **Zero capital was ever at risk.**

### Polling Logic
```typescript
// Polls every 1 second, max 120 attempts (2-minute timeout)
// Checks getLogs() for ClearanceUpdated or ClearanceDenied from startBlock
```
If `executeSafeSwap` reverts with `"Insufficient agent budget"`, the error is caught
and displayed as the Budget Cap layer working correctly.

### Required Env Vars
```
AGENT_PRIVATE_KEY       # Agent's signing key (gas wallet only)
TENDERLY_RPC_URL        # Tenderly VNet HTTP RPC endpoint
AEGIS_VAULT_ADDRESS     # Deployed AegisVault contract
TARGET_TOKEN_ADDRESS    # Token the agent wants to buy
```

---

## Environment Variables (Full Reference)

| Variable | Used By | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | cre-node | GPT-4o audit calls |
| `GROQ_API_KEY` | cre-node | Llama-3 audit calls |
| `BASESCAN_API_KEY` | cre-node | Source code fetch (via Etherscan V2 API) |
| `GOPLUS_APP_KEY` | cre-node | GoPlus security API |
| `GOPLUS_APP_SECRET` | cre-node | GoPlus security API |
| `COINGECKO_API_KEY` | cre-node | Pool/liquidity discovery |
| `TENDERLY_KEY` | scripts | Tenderly access key |
| `TENDERLY_RPC_URL` | all | Virtual TestNet HTTP RPC |
| `AEGIS_VAULT_ADDRESS` | all | Deployed contract address |
| `AGENT_ID` | frontend | Agent character/session ID |
| `AGENT_PRIVATE_KEY` | bot.ts | Agent signing wallet (gas only) |

---

## Testing Patterns

### Direct `onReportDirect` (Mock CRE for local testing)
When the real CRE DON isn't running, simulate it:
```bash
# Approve trade ID 0 (riskScore = 0 means CLEAR)
cast send $VAULT "onReportDirect(uint256,uint256)" 0 0 \
  --private-key $OWNER_KEY --rpc-url $RPC

# Deny trade ID 1 (riskScore = 4 means honeypot bit set)
cast send $VAULT "onReportDirect(uint256,uint256)" 1 4 \
  --private-key $OWNER_KEY --rpc-url $RPC
```

### Full Lifecycle (cast commands)
```bash
# 1. Deploy
cast send --create $(cat out/AegisVault.sol/AegisVault.json | jq -r .bytecode.object) \
  --constructor-args $FORWARDER_ADDRESS

# 2. Fund treasury
cast send $VAULT "depositETH()" --value 5ether --private-key $OWNER_KEY --rpc-url $RPC

# 3. Subscribe agent with 2 ETH budget
cast send $VAULT "subscribeAgent(address,uint256)" $AGENT_ADDR 2000000000000000000 \
  --private-key $OWNER_KEY --rpc-url $RPC

# 4. Agent requests audit
cast send $VAULT "requestAudit(address)" $TOKEN \
  --private-key $AGENT_KEY --rpc-url $RPC

# 5. (CRE DON delivers verdict OR use onReportDirect for testing)

# 6. Agent executes swap
cast send $VAULT "executeSafeSwap(address,uint256,uint256)" \
  $TOKEN 1000000000000000000 1 \
  --private-key $AGENT_KEY --rpc-url $RPC
```

### Budget Cap Test (verify it blocks overspend)
```bash
# Subscribe agent with only 0.5 ETH
cast send $VAULT "subscribeAgent(address,uint256)" $AGENT 500000000000000000 ...

# Approve the token
cast send $VAULT "onReportDirect(uint256,uint256)" 0 0 ...

# Try to swap 1 ETH — should revert "Aegis: Insufficient agent budget"
cast send $VAULT "executeSafeSwap(address,uint256,uint256)" $TOKEN 1000000000000000000 1 ...
```

---

## Architecture Invariants (Never Break These)

1. **CEI pattern in `executeSafeSwap`**: Budget deducted and `isApproved` cleared BEFORE the external Uniswap call. This prevents reentrancy.
2. **`delete tradeRequests[tradeId]`** in `_processReport`: Prevents replay of the same verdict.
3. **`isApproved` resets after each swap**: A new `requestAudit` + oracle verdict cycle is required for every trade. No standing approvals.
4. **`onReport` gated to `keystoneForwarder` only**: Only the real Chainlink forwarder (or `onReportDirect` for owner-authorized testing) can write verdicts.
5. **Agent wallet holds zero capital**: The BYOA model is only secure if the agent wallet is funded with gas only. Capital must stay in the vault.
6. **DON consensus uses `median` aggregation**: Each DON node independently calls GoPlus. The median of 0/1 flags across N nodes gives Byzantine-fault-tolerant majority voting.
