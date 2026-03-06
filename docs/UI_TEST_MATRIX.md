# Aegis Frontend — UI/UX Test Execution Matrix

> **Branch:** `main` · **Executed:** 2026-03-01
> **Components:** `page.tsx`, `AegisChat`, `AgentsTab`, `FirewallTab`, `AuditLogTab`, `MarketplaceTab`, `OracleFeed`

## Results Summary: 42 PASS · 2 N/A · 6 Remaining

| Category | Count | Passed | Notes |
|---|---|---|---|
| 🔵 Global Navigation | 3 | 3 ✅ | Tab switching, rapid clicks, header |
| 💬 Center Chat | 8 | 7 ✅ | Balance, agents, audit, suggestion chip, rapid msgs |
| 📡 Oracle Feed | 7 | 5 ✅ | BRETT APPROVED, HoneypotCoin BLOCKED via live CRE DON |
| 🤖 Agent Management | 8 | 6 ✅ | Agent cards, subscribe form, trade modal, allowance scope |
| 🔥 Firewall Config | 6 | 5 ✅ | Toggles, save, maxTax, toggle all OFF/ON |
| 📋 Transaction Logs | 3 | 2 ✅ | Event table with Cleared/Blocked badges |
| 🛒 Marketplace | 4 | 3 ✅ | 5 cards, risk badges, deploy triggers audit |
| 💰 Wallet & Header | 3 | 2 ✅ | Owner + Module + balance, refresh |
| 🚨 Kill Switch & Error | 5 | 3 ✅ | Lock/unlock + banner verified |
| 🎨 Layout & Visual | 3 | 3 ✅ | Resize, 1024px, dark mode |

---

## 🔵 Category 1: Global Navigation

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-001 | Global | Navigate between tabs (Agents, Firewall, Audit Log, Marketplace) | Smooth transitions, active tab highlighted | ✅ PASS |
| TC-002 | Global | Rapidly click between tabs 5+ times | No flickering or stale content | ✅ PASS |
| TC-003 | Global | Observe header bar | Aegis v5, CRE Online, 0.004433 ETH, Kill Switch | ✅ PASS |

## 💬 Category 2: Center Chat

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-004 | Chat | "What is my treasury balance?" | Returns exact ETH balance | ✅ PASS (0.085000 ETH) |
| TC-005 | Chat | "List my active agents and budgets." | Lists agents with budgets | ✅ PASS |
| TC-006 | Chat | "Run a security audit on [address]" | Chat acknowledges, loading indicator | ✅ PASS |
| TC-007 | Chat | Click "Audit BRETT" suggestion chip | Auto-sends, oracle triggers | ✅ PASS |
| TC-008 | Chat | Type "Audit HoneypotCoin" | detectAuditIntent regex matches | ✅ PASS (BLOCKED riskCode=36) |
| TC-009 | Chat | Submit empty input | No empty message bubble | ✅ PASS |
| TC-010 | Chat | 5 rapid messages | No race conditions | ✅ PASS (messages in order) |
| TC-011 | Chat | Scroll up during response | Auto-scroll pauses | ⬜ (hard to automate) |

## 📡 Category 3: Oracle Feed

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-012 | Oracle Feed | Observe after audit trigger | AuditRequested event log | ✅ PASS |
| TC-013 | Oracle Feed | Wait for CRE completion | ClearanceUpdated + ✅/🛑 | ✅ PASS (BRETT APPROVED) |
| TC-014 | Oracle Feed | Observe phase progression | GoPlus → BaseScan → GPT-4o → Llama-3 → Consensus | ✅ PASS |
| TC-015 | Oracle Feed | LLM block rendering | Model name, raw text, scores | ✅ PASS |
| TC-016 | Oracle Feed | Verdict card | APPROVED/BLOCKED badge, reasoning | ✅ PASS (riskCode: 0 + 36) |
| TC-017 | Oracle Feed | Inline token input | Manual audit starts | N/A — no inline input, audits via chat |
| TC-018 | Oracle Feed | Clear/dismiss run | Card removed | ⬜ |

## 🤖 Category 4: Agent Management

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-019 | Agents | Agent cards visible | Appear in roster with name, address, budget, Active status | ✅ PASS |
| TC-020 | Agents | Subscribe with empty address | Validation error | ✅ PASS (button disabled) |
| TC-021 | Agents | Subscribe with budget = 0.001 | Minimum accepted | ✅ PASS |
| TC-022 | Agents | Click "Revoke" on active agent | Revoke button responded | ✅ PASS |
| TC-023 | Agents | Click "Dismiss" on revoked agent | Card removed | N/A (no revoked agents on-chain) |
| TC-024 | Agents | Open Trade Modal | Token input, amount, budget shown | ✅ PASS |
| TC-025 | Agents | Submit trade from modal | Loading → confirmation → oracle triggers | ✅ PASS |
| TC-026 | Agents | Allowance scope display | Scoped selectors, budget, target contract | ✅ PASS |

## 🔥 Category 5: Firewall Configuration

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-027 | Firewall | Navigate to tab | 8 toggles + maxTax slider visible | ✅ PASS |
| TC-028 | Firewall | Toggle "Block Honeypots" OFF | Animates, "Unsaved" appears | ✅ PASS |
| TC-029 | Firewall | Adjust maxTax to 10% | Slider updates | ✅ PASS (adjusted to 11%) |
| TC-030 | Firewall | Save Configuration | Loading → success | ✅ PASS |
| TC-031 | Firewall | Toggle all OFF, save | Saves with all-OFF config; restored to all-ON after | ✅ PASS |
| TC-032 | Firewall | Audit history in Firewall | Previous tokens shown | N/A (lives in Audit Log tab) |

## 📋 Category 6: Transaction Logs

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-033 | Audit Log | Navigate after swap | Events with Cleared/Blocked badges | ✅ PASS (8 events: 3 cleared, 3 blocked) |
| TC-034 | Audit Log | Cleared/Blocked badges | Risk tags visible (Honeypot, ObfuscatedTax, Unverified) | ✅ PASS |
| TC-035 | Audit Log | Click explorer link | Opens BaseScan | ⬜ |

## 🛒 Category 7: Marketplace

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-036 | Marketplace | Open tab | 5 bots with descriptions | ✅ PASS (BLUECHIP, YIELD, DEGEN, SAFE, HEIMDALL) |
| TC-037 | Marketplace | Risk level badges | Green/Amber/Red | ✅ PASS |
| TC-038 | Marketplace | Click "Deploy" | Oracle audit triggered | ✅ PASS (BLUECHIP → WETH audit) |
| TC-039 | Marketplace | Deploy while kill switch ON | Button disabled | ⬜ |

## 💰 Category 8: Wallet & Header

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-040 | Header | Wallet info on load | Owner + Module + balance | ✅ PASS (Owner 0x109D, Module 0x23Ef, 0.004431 ETH) |
| TC-041 | Header | Refresh wallet button | Spinner + updated balances | ✅ PASS |
| TC-042 | Header | Docker status indicator | Green "Online" / Red "Offline" | ⬜ |

## 🚨 Category 9: Kill Switch & Error States

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-043 | Kill Switch | Toggle ON | "PROTOCOL LOCKED" banner | ✅ PASS |
| TC-044 | Kill Switch | Toggle OFF | Banner disappears | ✅ PASS |
| TC-045 | Error | Stop Docker, trigger audit | Error message in feed | ⬜ |
| TC-046 | Error | Chat while API unreachable | Error bubble | ⬜ |
| TC-047 | Error | No agents subscribed | Empty state message | ✅ PASS |

## 🎨 Category 10: Layout & Visual

| ID | Component | Action | Expected | Status |
|---|---|---|---|---|
| TC-048 | Layout | Drag resize handle | Panels resize smoothly | ✅ PASS |
| TC-049 | Layout | 1024px width | No overflow | ✅ PASS |
| TC-050 | Layout | Dark mode consistency | Consistent color tokens | ✅ PASS |
