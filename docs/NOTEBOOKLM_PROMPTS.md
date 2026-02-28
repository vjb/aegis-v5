# 🎨 NotebookLM Prompts — Aegis Protocol V5

> **10 prompts for Google NotebookLM.** 5 for infographics, 5 for slide decks.
>
> **Feed NotebookLM the relevant docs** (README.md, ARCHITECTURE.md, ERC_STANDARDS.md, CONFIDENTIAL_HTTP.md, etc.) as sources before using these prompts.

---

## Global Rules (embedded in every prompt below)

These constraints are already baked into each prompt — no need to add them separately:

- **Avoid clutter.** White space is your friend. Every element must earn its place.
- **Lighter color palette.** Prefer soft blues, teals, greens, and warm grays. Use color to differentiate components in diagrams — never all-black.
- **Minimal text.** Only use text to label elements or for impact statements. Never add text just to fill space.
- **Agents are robots.** Every visual representation of an AI agent must look like a robot — not a person, not an abstract shape.

---

## 🖼️ Infographic Prompts

### 1. The Aegis Lifecycle — One Trade, Seven Steps

```
Create a clean, horizontal infographic showing the lifecycle of a single AI agent trade through Aegis Protocol. The flow has 7 steps:

1. Robot agent submits requestAudit(token) intent
2. AuditRequested event emitted on Base Sepolia
3. Chainlink CRE DON intercepts the event
4. GoPlus + BaseScan scan the token (static analysis)
5. GPT-4o and Llama-3 analyze the source code in parallel (show two robot brains side by side)
6. 8-bit risk verdict delivered on-chain via onReport
7. Clean token → swap executes ✅ OR Dirty token → swap reverts ❌ (show a fork)

Style: Use a light gradient background (soft blue to white). Each step is a rounded card with a small icon. Arrows connect them left to right. The robot agent on the left is teal, the firewall in the middle is orange, the blockchain on the right is green. Minimal text — only step labels. No paragraphs.
```

### 2. Zero-Custody Architecture — Who Holds What

```
Create a simple infographic comparing traditional custody vs Aegis zero-custody.

Left side (labeled "Traditional"): Show a robot agent holding a key and a wallet full of coins. Red warning indicators — the agent can drain everything.

Right side (labeled "Aegis Protocol"): Show the same robot agent but with only a scoped session key badge. The wallet (Safe Smart Account) is separate, locked, with an orange shield labeled "AegisModule." The robot can only call requestAudit and triggerSwap — show these as two small permission badges.

Style: Split-panel layout. Light cream/white background. Left side has a subtle red tint. Right side has a subtle green tint. Large bold labels at the top: "Full Access" vs "Scoped Access." Minimal text. The robot should look identical on both sides — the difference is what it's holding.
```

### 3. The Three ERC Standards Stack

```
Create a vertical layered infographic showing three ERC standards stacked like building blocks:

Bottom layer (foundation, blue): ERC-4337 Account Abstraction — show a Safe Smart Account icon with "Pimlico Bundler" and "EntryPoint" labels. Subtitle: "Smart wallet replaces raw private keys"

Middle layer (orange): ERC-7579 Modular Accounts — show a puzzle piece labeled "AegisModule" plugging into the Safe. Subtitle: "Zero-custody executor plugin"

Top layer (teal): ERC-7715 Session Keys — show a robot agent with a limited badge. Two small function labels: requestAudit, triggerSwap. Subtitle: "Scoped AI permissions with budget caps"

Style: Clean isometric or flat-layer stack. Light background. Each layer is a different soft color. A small vertical arrow on the side labeled "Security increases ↑". No dense text — just the labels and subtitles. Each layer has one icon.
```

### 4. Union of Fears — Dual-AI Consensus

```
Create an infographic explaining the "Union of Fears" consensus mechanism.

Show two robot brains side by side:
- Left robot labeled "GPT-4o" (cyan tint)
- Right robot labeled "Llama-3" (magenta tint)

Both receive the same contract source code (show a document icon flowing into both).

Below each robot, show a row of 4 risk fields: obfuscatedTax, privilegeEscalation, externalCallRisk, logicBomb. Each field has a true/false indicator.

Below that, show the two outputs merging into a single row with a logical OR operation. Label it "Union of Fears — if EITHER model flags a risk, it's flagged." The final merged result flows into an 8-bit risk code (show "Risk: 36" in an orange badge).

Style: Light gray background. The two robots are visually distinct colors but same shape. The merge operation is shown as converging arrows. Minimal text — just labels. The key insight (OR logic) should be the one bold statement.
```

### 5. Budget Enforcement — The Corporate Card Analogy

```
Create a friendly infographic using the corporate credit card analogy for Aegis budget enforcement.

Top: Show a CEO figure (human silhouette, not detailed) at a desk labeled "Safe Smart Account — $50,000 treasury"

Middle: Show three robot agents in a row, each with a corporate card badge:
- NOVA — $500 limit (teal card)
- CIPHER — $80 limit (orange card)
- REX — REVOKED (gray card with X)

Bottom: Show a transaction attempt by NOVA: "Buy 0.001 ETH of BRETT" → Budget deducted → New balance shown. Next to it, show REX attempting a transaction → big red "DENIED" stamp.

Style: Warm, approachable color palette. Light background. The robots are small and cute but clearly robotic. The cards are color-coded. Use checkmarks ✅ and X marks ❌ for outcomes. One-line labels only.
```

---

## 📊 Slide Deck Prompts

### 1. Aegis Protocol — Hackathon Pitch Deck (5 slides)

```
Create a 5-slide pitch deck for Aegis Protocol V5.

Slide 1 — Title: "Aegis Protocol: The Institutional AI Firewall" with subtitle "Zero-Custody Smart Treasury for Autonomous AI Agents." Show the Aegis logo concept (a shield with a circuit pattern). Background: dark navy gradient with subtle grid lines.

Slide 2 — The Problem: "AI agents are trading with full wallet access." Show a robot agent next to an unlocked vault with red warning glow. Two stats: "$2.1B lost to rug pulls in 2024" and "AI agents have no spending guardrails." Light red background tint.

Slide 3 — The Solution: Show the three-layer stack (ERC-4337 → ERC-7579 → ERC-7715) as colored blocks. Title: "Three ERC Standards. One Firewall." Each block has a one-line description. Soft blue/teal background.

Slide 4 — How It Works: Horizontal flow diagram. Robot agent → requestAudit → Chainlink CRE (GoPlus + GPT-4o + Llama-3) → onReport → triggerSwap ✅ or REVERT ❌. Use distinct colors for each stage (teal, orange, cyan, magenta, green/red). White background.

Slide 5 — Results: Three big numbers in colored cards: "21 Solidity Tests Passing" (green), "83 TypeScript Tests Passing" (blue), "7-Act Live Demo on Base Sepolia" (teal). Footer: "Built with Chainlink CRE · Safe · Pimlico · Rhinestone"

Global: Use lighter backgrounds throughout. Diagrams use distinct colors per component — never monochrome. Agents always look like robots. Maximum 20 words per slide outside of labels.
```

### 2. CRE Integration Deep Dive (4 slides)

```
Create a 4-slide technical deck focused on the Chainlink CRE integration.

Slide 1 — Title: "Inside the Chainlink CRE WASM Sandbox" with subtitle "How Aegis achieves decentralized AI consensus." Dark teal background with circuit pattern.

Slide 2 — The Pipeline: Vertical flow showing 4 phases. Phase 1: GoPlus API (yellow) — on-chain scam registry. Phase 2: BaseScan (blue) — source code retrieval. Phase 3: GPT-4o + Llama-3 (cyan/magenta) — parallel deep analysis. Phase 4: Union of Fears bitmask (orange) — conservative consensus. Each phase is a colored card with one icon and one label. White background.

Slide 3 — Confidential HTTP: Show a diagram of API keys sealed inside the DON enclave. Three arrows going out: "OpenAI API" "Groq API" "BaseScan API" — each labeled "ConfidentialHTTPClient." The keys are shown as locked inside a vault (the DON), never exposed to node operators. Subtitle: "API keys never leave the enclave." Light gray background.

Slide 4 — Live Proof: Show a terminal-style output snippet (3-4 lines max) of actual CRE simulation output: "[GPT-4o] privilegeEscalation=true" and "[Llama-3] privilegeEscalation=true" and "Final Risk Code: 36." Below it: "Both models independently flagged the honeypot." Dark background with monospace font for the terminal.

Global: Lighter backgrounds on slides 2-3. Distinct colors per component. Robots for agents. Minimal text.
```

### 3. The Agent Lifecycle — Subscribe to Revoke (3 slides)

```
Create a 3-slide deck showing the full agent lifecycle.

Slide 1 — Subscribe: Show a CEO figure using subscribeAgent() to provision a robot agent. The robot receives a teal badge with "NOVA — 0.05 ETH Budget." Arrow shows the budget being set on-chain. Title: "Step 1: Subscribe." Subtitle: "Owner grants scoped access with a hard budget cap." Soft green background.

Slide 2 — Operate: Show the robot agent in action — submitting requestAudit, receiving an oracle verdict, executing triggerSwap. A budget meter shows the balance decreasing from 0.05 to 0.049 ETH. Title: "Step 2: Operate." Subtitle: "Every trade is audited. Budget deducted atomically." Light blue background.

Slide 3 — Revoke: Show the CEO pressing a large orange button labeled "revokeAgent()." The robot agent goes gray, its badge shows "0 ETH — ACCESS DENIED." Title: "Step 3: Revoke." Subtitle: "One call. Budget zeroed. Sovereignty restored instantly." Soft orange background.

Global: Each slide is one concept, one visual. Lighter distinct background colors per slide. The robot agent looks the same across all three slides — only its status changes. Maximum 15 words per slide outside labels.
```

### 4. Real vs Simulated — Transparency Deck (3 slides)

```
Create a 3-slide transparency deck showing what is real and simulated in the hackathon demo.

Slide 1 — Title: "What's Real. What's Simulated. Full Transparency." Subtitle: "We believe honesty builds more trust than a polished facade." Clean white background with a thin teal border.

Slide 2 — The Stack: A table with three rows (ERC-4337, ERC-7579, ERC-7715). Columns: "Standard", "What's Live ✅", "What's Simulated ⚠️". Use green highlights for live items and soft amber for simulated. Key real items: Safe Smart Account, AegisModule on-chain, budget enforcement. Key simulated: swap is mock (no DEX liquidity on testnet), session validator not yet installed. Light background.

Slide 3 — Why It Matters: Show a split diagram. Left: "Security Layer" — shield icon, labeled "Budgets, revocation, firewall rules — all enforced on Base Sepolia." Right: "Execution Layer" — swap icon, labeled "Token swaps are mocked because Base Sepolia has no Uniswap liquidity." Bottom callout: "The parts that protect your money are real. The parts that trade tokens are simulated on testnet." Soft blue/green background.

Global: Lighter backgrounds. Use green and amber to distinguish real vs simulated — never red (simulated is not bad, it's expected on testnet). Minimal text.
```

### 5. Security Architecture — Defense in Depth (4 slides)

```
Create a 4-slide deck on Aegis Protocol's layered security architecture.

Slide 1 — Title: "Defense in Depth: Five Security Layers" with subtitle "Every layer must pass before funds move." Dark navy background with concentric ring visual.

Slide 2 — The Five Layers: Show 5 concentric rings (outermost to innermost): Ring 1 (teal): "ERC-7715 Session Key Scoping" — selectors + budget. Ring 2 (blue): "ERC-7579 Module Gating" — onlyOwnerOrAgent modifier. Ring 3 (orange): "CRE AI Consensus" — GoPlus + GPT-4o + Llama-3. Ring 4 (cyan): "On-Chain Clearance" — isApproved mapping, anti-replay. Ring 5 (green, center): "Budget Enforcement" — agentAllowances deduction via CEI. Light background.

Slide 3 — Attack Scenarios: Three cards showing blocked attacks. Card 1: Robot tries to call withdrawETH → "BLOCKED: Not in session key scope." Card 2: Robot tries to swap a flagged token → "BLOCKED: TokenNotCleared()." Card 3: Robot tries to overspend → "BLOCKED: InsufficientBudget()." Each card has a red ❌ and the robot looking disappointed. Light gray background.

Slide 4 — The Result: Large centered statement: "Zero capital at risk. The AI agent can only do exactly what it's permitted to do — nothing more." Below: three stats in colored badges: "18 Solidity tests" "83 TypeScript tests" "7-Act live demo." Teal/green background.

Global: Lighter colors for middle slides. Use distinct colors per security layer. Robots should look identical — the security system is what changes around them. Minimal text.
```
