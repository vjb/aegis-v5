# Aegis V5 Master Demo — Filming Blueprint

**Layout**: Terminal (left) | Pimlico Dashboard (right)
**Command**: `.\scripts\demo_v5_master.ps1 -Interactive`

---

## Pre-Roll Setup

| Screen | What to do |
|--------|------------|
| **Terminal** | Maximize, clear screen. Have the command ready to paste. |
| **Pimlico** | Open to **Request Logs** tab. Make sure Base Sepolia is selected. Clear/note the current timestamp so you can identify new entries. |

**Say**: *"We're running live on Base Sepolia. Terminal on the left, Pimlico bundler dashboard on the right. Everything you're about to see is real — real transactions, real AI models, real blockchain."*

Press Enter → ASCII banner appears.

**Say**: *"Aegis Protocol V5. The institutional AI firewall. We've moved from plain EOA wallets to ERC-4337 Smart Accounts with ERC-7715 Session Keys. Let me walk you through the full lifecycle."*

Press Enter to advance.

---

## ACT 1: THE ZERO-CUSTODY TREASURY

| Screen | What to show |
|--------|--------------|
| **Terminal** | Focus here. The ActIntro box explains the architecture. |
| **Pimlico** | Nothing happening yet — leave on Request Logs. |

**Say**: *"Act 1 — the treasury. The AegisModule is an ERC-7579 Executor installed on a Safe Smart Account. Critical point: the module has execution rights but holds ZERO custody. All capital stays in the Safe. The module can only do two things — requestAudit and triggerSwap. Nothing else."*

Press Enter → balance check runs.

**Say**: *"You can see the module's balance — it holds no funds. It's a gatekeeper, not a vault."*

Press Enter to advance.

---

## ACT 2: SUBSCRIBE AI AGENTS

| Screen | What to show |
|--------|--------------|
| **Terminal** | Focus here. Two `cast send` transactions will fire. |
| **Pimlico** | Nothing yet — these are owner EOA transactions, not UserOps. |

**Say**: *"Act 2 — subscribing agents. Think of this like issuing a corporate credit card. The human owner calls subscribeAgent with an address and a budget. NOVA gets 0.05 ETH, CIPHER gets 0.008 ETH. Two things happen on-chain: the agent is allowlisted, and a strict ETH spending cap is set. The smart contract will revert if an agent tries to exceed it."*

Press Enter → subscriptions broadcast.

**Say** (as the Agent Allowance Scope box appears): *"Look at this scope. NOVA can only call requestAudit and triggerSwap. It cannot call transfer, withdraw, or anything else. The function selectors are enforced in Solidity."*

Press Enter to advance.

---

## ACT 3: AGENT SUBMITS TRADE INTENTS ⭐ Pimlico Moment

| Screen | What to show |
|--------|--------------|
| **Terminal** | Focus here initially — two UserOps will submit. |
| **Pimlico** | 👉 **Switch to User Operations tab BEFORE pressing Enter.** Watch for new entries appearing. |

**Say**: *"Act 3 — the intents. Agent NOVA wants to buy two tokens. It submits audit requests on-chain. But here's the key — look at the Pimlico dashboard on the right."*

Press Enter → first UserOp (MockBRETT) fires.

**Say** (while spinner runs): *"The agent is signing with its SESSION KEY — not the owner's private key. The owner key never leaves cold storage. The Pimlico bundler packages this into a UserOperation and submits it to the EntryPoint contract."*

**👉 Pimlico action**: Point to/hover over the new entries appearing in User Operations. You should see:
- `pimlico_getUserOperationGasPrice` → Success
- `pm_sponsorUserOperation` → **Success** (Paymaster is covering gas)
- `eth_sendUserOperation` → Success

**Say**: *"See that pm_sponsorUserOperation — Success? The Paymaster is sponsoring all gas fees. The agent doesn't need to hold any ETH to pay for gas. That's ERC-4337 account abstraction in action."*

Second UserOp (MockHoneypot) fires.

**Say**: *"Same flow for the honeypot token. Both AuditRequested events are now on-chain. No capital has moved — these are pure intents."*

> **Tip**: After both UserOps complete, briefly hover over one of them in Pimlico to show the trace details if time allows.

Press Enter to advance.

---

## ACT 4: THE AI FIREWALL (LIVE CRE)

| Screen | What to show |
|--------|--------------|
| **Terminal** | **Full focus here.** The CRE output streams in real-time with color coding. |
| **Pimlico** | Nothing happening — this is Docker/Chainlink execution. Leave dashboard visible but don't interact. |

**Say**: *"Act 4 — this is the core innovation. The Chainlink DON detected the AuditRequested event and triggered the WASM sandbox. You're watching the raw CRE execution in real time."*

Press Enter → Docker command executes, output streams.

**Narrate the color-coded output as it appears**:

| Color | What it is | What to say |
|-------|-----------|-------------|
| **Yellow** lines (`[GoPlus]`) | GoPlus API check | *"Phase 1 — GoPlus Security API. Checking for known honeypot signatures."* |
| **DarkCyan** lines (`[BaseScan]`) | BaseScan source check | *"Phase 2 — BaseScan. Looking for verified source code."* |
| **Cyan** lines (`[GPT-4o]`) | Right Brain analysis | *"Phase 3 — GPT-4o, the Right Brain. Deep semantic forensics on the contract code."* |
| **Magenta** lines (`[Llama-3]`) | Left Brain analysis | *"And Llama-3, the Left Brain. Running in parallel for dual-model consensus."* |
| **Red** line (`Final Risk Code`) | The verdict | **Pause here.** *"Final Risk Code: 36. The AI caught the honeypot. Both models independently flagged it as malicious."* |

After CRE completes, the script delivers oracle verdicts:

**Say**: *"Now the oracle delivers the verdicts on-chain. MockBRETT gets Risk Code 0 — approved. MockHoneypot gets Risk Code 36 — denied. The smart contract stores these verdicts and they gate all future swaps."*

Press Enter to advance.

---

## ACT 5: AUDITED EXECUTION & AUTOMATED REVERTS ⭐⭐ Key Pimlico Moment

| Screen | What to show |
|--------|--------------|
| **Terminal** | Watch for the green success and red revert box. |
| **Pimlico** | 👉 **Switch to Request Logs tab.** This is the dramatic moment. |

**Say**: *"Act 5 — the execution. NOVA tries to swap both tokens. The smart contract checks isApproved() before allowing any capital to move. Watch the Pimlico dashboard carefully."*

Press Enter → MockBRETT swap fires (should succeed).

**Say**: *"MockBRETT — Risk Code 0, AI-cleared. The Session Key UserOp goes through the bundler, the Paymaster sponsors the gas, and the swap executes. Check Pimlico — you should see a successful UserOperation."*

**👉 Pimlico action**: Point to the successful entries.

Then MockHoneypot swap fires (should fail).

**Say** (as the red EXECUTION REVERTED box appears): *"Now MockHoneypot. Watch what happens—"*

**👉 Pimlico action**: Point to the new entry — `pm_sponsorUserOperation` → **Error**.

**Say**: *"Look at that. pm_sponsorUserOperation — Error. The Paymaster SIMULATED the UserOp before agreeing to pay, hit the TokenNotCleared revert, and refused to sponsor it. The transaction never even made it on-chain. Zero gas wasted. The firewall blocked it at TWO layers — the smart contract AND the Paymaster. The agent's funds are completely safe."*

> **This is the money shot.** Linger on this comparison: green success in terminal + Pimlico success for BRETT, red revert box + Pimlico error for Honeypot.

Press Enter to advance.

---

## ACT 6: BUDGET VERIFICATION

| Screen | What to show |
|--------|--------------|
| **Terminal** | Focus here — two `cast call` results. |
| **Pimlico** | Leave visible, no interaction needed. |

**Say**: *"Act 6 — budget verification. NOVA started with 0.05 ETH. After the BRETT swap, the smart contract automatically deducted the amount. Let's read the on-chain state."*

Press Enter → budgets display.

**Say**: *"NOVA's remaining budget is [read the value]. The deduction is mathematically enforced in Solidity. There is no way for NOVA to exceed its allowance — the contract reverts. CIPHER's budget is untouched because it didn't execute any swaps."*

Press Enter to advance.

---

## ACT 7: THE KILL SWITCH

| Screen | What to show |
|--------|--------------|
| **Terminal** | Focus here — subscribe then immediately revoke. |
| **Pimlico** | Leave visible, no interaction needed. |

**Say**: *"Act 7 — the kill switch. What happens if an agent goes rogue? The human owner can revoke any agent instantly. One transaction — revokeAgent — and the agent's budget is zeroed, its access is completely denied."*

Press Enter → REX subscribes, then gets revoked.

**Say**: *"We just subscribed Agent REX with 0.01 ETH, and immediately revoked it. REX's allowance is now zero. Any call from REX to requestAudit will revert with 'Not authorized.' Human sovereignty is absolute and instant."*

Press Enter to advance.

---

## OUTRO

| Screen | What to show |
|--------|--------------|
| **Terminal** | The summary box fills the screen. |
| **Pimlico** | Can briefly switch to **User Operations tab** to show the full history. |

**Say**: *"That's the full lifecycle. Let me recap what just happened, all live on Base Sepolia:"*

Read through the summary box highlights:
- *"subscribeAgent — owner granted budgets"*
- *"requestAudit — agents submitted intents via Session Keys, gas sponsored by Paymaster"*
- *"Chainlink CRE — GoPlus, BaseScan, GPT-4o, and Llama-3 in a WASM sandbox"*
- *"triggerSwap — the clean token executed, the honeypot was blocked"*
- *"revokeAgent — instant kill switch"*

**Closing**: *"Zero custody. Zero trust. Total protection. The stack is ERC-7579 modules, Chainlink CRE, and ERC-7715 Session Keys through Pimlico — all running on Base Sepolia."*

**👉 Pimlico action (optional)**: Scroll through User Operations tab briefly to show the full history of all operations from the demo.

---

## Quick Reference: Pimlico Tab Switching Guide

| Act | Pimlico Tab | Why |
|-----|-------------|-----|
| 1–2 | Request Logs (idle) | No UserOps — owner EOA transactions only |
| 3 | **User Operations** | Watch UserOps appear for requestAudit |
| 4 | Either (idle) | CRE is Docker-side, nothing on Pimlico |
| 5 | **Request Logs** | The `pm_sponsorUserOperation` Error is the money shot |
| 6–7 | Either (idle) | Owner EOA transactions, no UserOps |
| Outro | User Operations | Show full session history |

## Emergency Notes

- **If UserOp fails and falls back to cast send**: Say *"The Session Key route timed out, so it's falling back to the owner EOA. This is a testnet reliability issue — in production, the bundler handles this seamlessly."*
- **If CRE Docker errors**: Say *"The CRE sandbox hit a network issue. The important thing is the verdict was already computed — let me deliver it manually."*
- **If Pimlico shows nothing**: Refresh the dashboard page. Filter by the correct chain (Base Sepolia, 84532).
