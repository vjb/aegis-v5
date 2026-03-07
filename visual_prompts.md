# Aegis Protocol V5 — Visual Artifact Prompts

> For generating landscape infographics and presentation decks. Each prompt includes the full visual theme.

---

## Global Visual Theme (included in every prompt)

```
VISUAL THEME — Apply to EVERY image:
- Orientation: LANDSCAPE (16:9)
- Avoid Clutter: White space is your friend. Every visual element must earn its place.
- Color Palette: Soft blues, teals, greens, and warm grays. Use color to differentiate components. Never use an all-black palette.
- Minimal Text: Only labels and high-impact statements. Never add text to fill space.
- Agents are Cute Robots: Every AI agent must be a cute robot — not a human, not an abstract shape.
- Balance: Hardcore technical backend (WASM, raw bytecode, multi-LLM consensus) with a friendly, consumer-ready frontend.
- For presentation slides: Maximum 3 short bullet points per slide.
```

---

# PART 1: INFOGRAPHIC PROMPTS (10)

---

## Infographic 1 — "The Problem"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an infographic titled "STOP GIVING TRADING BOTS YOUR PRIVATE KEYS."

Left side: A worried person holding a golden key labeled "Private Key" while a cute robot reaches for it with grabby hands. The robot has a speech bubble: "Trust me."

Center: A broken shield icon with dollar signs falling through cracks. Label: "No Security Layer."

Right side: Three disaster scenarios as small illustrated vignettes:
1. A honeypot jar trapping a cute robot
2. A scam contract document with a skull watermark
3. A compromised API endpoint showing a broken padlock

Bottom bar: "AI trading bots are mainstream. The problem? You hand over your keys. Aegis is the security layer between your money and your AI agent."

Color scheme: Warm grays for the problem side, transitioning to soft teal at the bottom where the solution hint appears. Clean typography, no decorative borders.
```

---

## Infographic 2 — "The Corporate Credit Card Analogy"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an infographic showing the Aegis trust model as a corporate credit card analogy.

Left panel: A CEO figure (human) sitting behind a desk with a vault labeled "Safe Smart Account" — the vault is open showing ETH coins inside. Label: "CEO (You) — Holds the Bank Account."

Center panel: The CEO hands a small credit card to a cute robot employee. The card reads "Budget: 0.05 ETH." Label: "Employee (AI Agent) — Gets a Strict Limit."

Right panel: The cute robot tries to make a purchase at a store labeled "Token Swap." Between the robot and the store, a glowing shield (Aegis) with two small brain icons (GPT-4o, Llama-3) examines the transaction. Label: "Aegis — AI Compliance Department."

Two outcomes shown as branching paths at far right:
- Green checkmark path: "CLEARED → Swap Executes"
- Red X path: "BLOCKED → TokenNotCleared() Revert"

Bottom text: "Zero custody. Budget enforcement. Per-trade AI clearance."
```

---

## Infographic 3 — "The Full Trade Lifecycle"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create a horizontal flowchart infographic showing the Aegis trade lifecycle in 6 steps.

Step 1: A person deposits ETH into a vault icon labeled "AegisModule Treasury."
Step 2: The person connects a cute robot with a tag "Agent — 0.05 ETH Budget."
Step 3: The cute robot sees a token opportunity and signs a document labeled "UserOp (Session Key)." A small key icon labeled "ERC-7715" floats next to the robot.
Step 4: A bundler truck (labeled "Pimlico") carries the UserOp to a chain icon labeled "Base Sepolia."
Step 5: A Chainlink oracle node (labeled "CRE DON") contains two brain icons running in parallel — one labeled "GPT-4o" (blue) and one labeled "Llama-3" (magenta). Between them: "Union of Fears — if either flags risk, bit is set."
Step 6: Two branching outcomes — green path shows the robot celebrating with confetti and "Swap Executed," red path shows the robot looking sad behind a barrier with "TokenNotCleared() REVERT."

Clean horizontal layout with numbered circles (1-6) connected by arrows. Each step is a distinct panel. Ample white space between panels.
```

---

## Infographic 4 — "The 8-Bit Risk Matrix"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an infographic visualizing the 8-bit risk matrix used by Aegis Protocol.

Center: A large 8-bit binary number "00100100" displayed as 8 toggle switches in a row, each in its own colored pill. Bits 0-3 are in warm gold tones, bits 4-7 are in soft teal tones.

Above each bit, a label:
- Bit 0: "Unverified Source" (GoPlus)
- Bit 1: "Sell Restriction" (GoPlus)
- Bit 2: "Honeypot" (GoPlus) — this toggle is ON (red glow)
- Bit 3: "Proxy Contract" (GoPlus)
- Bit 4: "Obfuscated Tax" (AI)
- Bit 5: "Privilege Escalation" (AI) — this toggle is ON (red glow)
- Bit 6: "External Call Risk" (AI)
- Bit 7: "Logic Bomb" (AI)

Left side: A shield icon labeled "GoPlus Data (Bits 0-3)" in warm gold.
Right side: Two cute robot brains labeled "AI Consensus (Bits 4-7)" in soft teal.

Bottom: "Risk Code = 36 → Bits 2+5 active → BLOCKED. The Union of Fears: if EITHER model flags a risk, the bit is set."

Below the main visual: 8 small toggle switch icons in a row labeled "Owner's Firewall Config — setFirewallConfig()" showing that the owner chooses which bits matter.
```

---

## Infographic 5 — "CRE Oracle Pipeline"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an infographic showing the 3-phase CRE oracle pipeline as a horizontal assembly line.

Phase 1 — "GoPlus" (Gold panel):
A magnifying glass examines a token coin. Output: 4 small indicator pills showing "honeypot," "sell restriction," "unverified," "proxy." One pill is red (honeypot detected).

Phase 2 — "Source Code" (Teal panel):
A document icon with a padlock labeled "ConfidentialHTTPClient" connects to a BaseScan logo. A scroll unfurls showing "52,963 chars — BrettToken.sol." The padlock emphasizes: "API key sealed inside DON."

Phase 3 — "AI Consensus" (Blue-magenta panel):
Two cute robot brains sit side by side:
- Left robot is blue, labeled "GPT-4o (temp=0)"
- Right robot is magenta, labeled "Llama-3 (temp=0)"
Both read the same scroll of source code. Between them, a merge icon labeled "Union of Fears" combines their outputs into a single risk code.

Output arrow at far right: A verdict stamp — either green "CLEARED (0)" or red "BLOCKED (36)."

All phases connected by a conveyor belt with small arrows. Clean industrial aesthetic with soft colors. The "ConfidentialHTTPClient" padlock appears at every external API call.
```

---

## Infographic 6 — "Session Keys: Agent Autonomy"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an infographic contrasting the old model (hand over keys) vs the Aegis model (session keys).

Left half — "THE OLD WAY" (warm gray, slightly muted):
A person reluctantly hands a large golden master key to a cute robot. The key is labeled "PRIVATE KEY — Full Access." Red warning signs float around: "Unlimited Spending," "No Audit Trail," "Full Custody Transferred." The person looks nervous.

Right half — "THE AEGIS WAY" (soft blue-teal, vibrant):
The same person holds onto the master key firmly. Instead, they issue a small card-key to the cute robot. The card-key is labeled "SESSION KEY (ERC-7715)" with fine print: "requestAudit() ✓ triggerSwap() ✓ Everything Else ✗." The robot looks happy with the limited card.

Between the two halves: A vertical divider with a Pimlico bundler truck icon at the top, labeled "UserOps via ERC-4337."

Bottom: "The owner's private key is NEVER used for trade operations. The agent operates autonomously within scoped permissions."
```

---

## Infographic 7 — "ConfidentialHTTPClient: Privacy"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an infographic about ConfidentialHTTPClient — Aegis's privacy layer.

Top: Title "EVERY API CALL IS ENCRYPTED INSIDE THE DON"

Center: A large WASM sandbox container (depicted as a translucent blue box with a padlock) containing:
- 5 outgoing arrows, each going to a different API service icon:
  1. GoPlus (gold shield icon) — "App credentials"
  2. GoPlus token lookup — "Token address before trade"
  3. BaseScan (teal document) — "API key + contract address"
  4. OpenAI GPT-4o (blue brain) — "API key + full Solidity source"
  5. Groq Llama-3 (magenta brain) — "API key + full Solidity source"
- Each arrow passes through a padlock icon labeled "ConfidentialHTTPClient"

Outside the sandbox: A row of cute robot node operators peering at the sandbox. They have question marks over their heads. Label: "Node operators see NOTHING — not the request, not the response, not the API key."

Comparison table at bottom (2 columns):
- "Plain HTTP" column: "Keys visible, URLs logged, responses readable" (red X marks)
- "ConfidentialHTTPClient" column: "Keys in vault, encrypted transit, sandbox-only decryption" (green checkmarks)
```

---

## Infographic 8 — "Heimdall: Seeing Through Bytecode"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an infographic about the Heimdall bytecode decompilation pipeline.

Left: A mysterious black box labeled "Unverified Contract" with no visible code — just raw hex digits floating around it (0x6080604052...). A sign on it reads "No Source Code Published." Label: "Traditional firewalls STOP HERE."

Center: The Heimdall pipeline as 3 connected machines:
1. A small RPC antenna labeled "eth_getCode" pulls hex from the blockchain — "19,666 hex chars"
2. A Docker container machine labeled "Heimdall-rs" with gears visible — "Symbolic execution → 15,000 chars Solidity-like pseudocode"
3. A cute robot brain labeled "GPT-4o (temp=0)" reads the pseudocode with a magnifying glass

Right: The output — a verdict card in red showing:
- "VERDICT: MALICIOUS"
- "obfuscatedTax: TRUE"
- "is_malicious: TRUE"
- "The contract contains a honeypot pattern"

Bottom text: "Experimental standalone demo. Proves Aegis can audit ANY deployed contract — even without source code."

Subtle stamp in corner: "MaliciousRugToken: 5 vulnerabilities (95% hidden tax, selfdestruct, unlimited mint, blocklist, seller allowlist) — ALL detected from bytecode alone."
```

---

## Infographic 9 — "What's Real vs What's Simulated"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create an honest, transparent infographic showing what Aegis has live on-chain vs what's simulated.

Layout: Two columns side by side.

Left column — "LIVE ON BASE SEPOLIA" (vibrant soft blue-green, green checkmarks):
- ERC-7579 Executor Module (verified on BaseScan)
- ERC-7715 Session Keys (UserOps signed by agent, not owner)
- ERC-4337 Account Abstraction (Pimlico bundler)
- CRE WASM Oracle (real GPT-4o + Llama-3 API calls)
- On-chain budget enforcement (subscribeAgent, revokeAgent)
- TokenNotCleared revert (MockHoneypot blocked)
- GoPlus live security data
- Frontend making real on-chain transactions

Right column — "SIMULATED (Platform Limitations)" (soft warm gray, orange info icons):
- CRE: `simulate` not `deploy` — "DON deployment requires Chainlink approval"
- AegisModule: standalone, not installed on Safe — "Rhinestone Registry attestation required"
- Swaps: emit event, no real DEX — "No testnet liquidity"
- Oracle callback: owner-relayed — "Production uses KeystoneForwarder"

Bottom: "Every simulation gap is a platform limitation, not missing code. The Solidity, TypeScript, and WASM are production-ready."

A cute robot in the center holds up a sign that says "Judges deserve honesty."
```

---

## Infographic 10 — "The Full Aegis Stack"

```
VISUAL THEME: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — only labels and high-impact statements. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Create a layered architecture infographic showing the complete Aegis V5 stack.

Bottom layer (green): "Safe Smart Account" — a vault icon with ETH inside. Label: "ERC-4337 · Your capital, your keys."

Second layer (teal): "AegisModule" — a shield icon. Functions listed as small labels: depositETH, subscribeAgent, revokeAgent, requestAudit, triggerSwap, setFirewallConfig. Label: "ERC-7579 Executor."

Third layer (blue): "SmartSessions" — a key card icon with session permissions. Label: "ERC-7715 Session Keys · Scoped access."

Fourth layer (magenta): "Chainlink CRE DON" — two cute robot brains (GPT-4o + Llama-3) inside a WASM container. Padlock icons for ConfidentialHTTPClient. Label: "AI Oracle · GoPlus + BaseScan + dual-LLM consensus."

Top layer (gold): "AI Trading Agent" — a friendly cute robot with binoculars scanning for alpha opportunities. Label: "Autonomous · Budget-limited · Session key only."

Side annotation: "Heimdall Pipeline (Experimental)" as a dashed-line extension from the CRE layer, showing bytecode → decompile → GPT-4o.

Far right: "Owner Controls" panel showing revokeAgent (kill switch), setFirewallConfig (8 toggles), withdrawETH (exit).

Clean stacked layout with subtle drop shadows. Each layer slightly overlaps the one below. Generous white space.
```

---

# PART 2: PRESENTATION PROMPTS (10 × 10 slides)

---

## Presentation 1 — "The Pitch: Why Aegis Exists"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "Aegis Protocol V5: The Institutional AI Firewall." Subtitle: "Zero custody. Per-trade AI clearance. Budget enforcement." A cute robot wearing a small shield stands next to a Safe vault. Chainlink + Base Sepolia logos small in corner.

Slide 2 — "The Problem": A cute robot happily trading tokens while a person looks worried. Bullet: "AI bots need your private keys." "If they get it wrong — your money is gone." "No security layer exists today."

Slide 3 — "The Analogy": Corporate credit card visual. CEO holds vault, gives limited card to robot employee. Bullet: "You keep the keys." "Agent gets a budget." "Aegis is the compliance department."

Slide 4 — "The Tech Stack": Clean 5-row table. ERC-4337 (Safe), ERC-7579 (AegisModule), ERC-7715 (Session Keys), CRE (WASM Oracle), ConfidentialHTTPClient (Privacy). No bullets, just the table.

Slide 5 — "How a Trade Works": Simplified 6-step flow. Agent signs → Bundler relays → AegisModule emits AuditRequested → CRE runs dual-LLM → Oracle delivers verdict → Swap or Revert.

Slide 6 — "The AI Firewall": Two cute robot brains analyzing source code in parallel. GPT-4o (blue) and Llama-3 (magenta). Bullet: "Union of Fears — if either flags risk, bit is set." "8-bit risk matrix." "Owner configures which bits matter."

Slide 7 — "Privacy First": ConfidentialHTTPClient padlocks on 5 API calls. Bullet: "API keys never leave DON enclave." "Source code encrypted in transit." "Node operators see nothing."

Slide 8 — "Session Keys": Person holds master key, robot holds limited session card. Bullet: "Owner key never used for trades." "Agent scoped to requestAudit + triggerSwap." "Revocable at any time."

Slide 9 — "Live on Base Sepolia": BaseScan screenshots (stylized). Bullet: "AegisModule verified on-chain." "Session key UserOp tx verified." "MockHoneypot correctly blocked."

Slide 10 — "What's Next": Roadmap visual. Bullet: "Rhinestone attestation → Safe module installation." "CRE DON deployment → automated oracle." "Mainnet with real DEX liquidity." A cute robot looking toward the horizon.
```

---

## Presentation 2 — "Deep Dive: CRE Oracle Pipeline"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "Inside the Aegis CRE Oracle." Subtitle: "How Chainlink CRE powers the AI firewall." Chainlink logo + CRE badge. A cute robot inside a WASM container.

Slide 2 — "The Trigger": AuditRequested event on-chain. Shows a block on Base Sepolia emitting an event. Bullet: "requestAudit(tokenAddress)" "Emitted on-chain" "CRE DON intercepts"

Slide 3 — "Phase 1 — GoPlus": Security API magnifying glass examining a token. Bullet: "Honeypot detection" "Sell restriction check" "Proxy contract flag"

Slide 4 — "Phase 2 — Source Code": BaseScan document with padlock. Bullet: "ConfidentialHTTPClient fetches source" "API key sealed in DON vault" "52,963 chars for BRETT"

Slide 5 — "Phase 3 — AI Consensus": Two cute robot brains side by side reading code. Bullet: "GPT-4o (temp=0) — forensic" "Llama-3 (temp=0) — independent" "Same prompt, combined output"

Slide 6 — "Union of Fears": Binary OR gate diagram. True + False = True. Bullet: "If EITHER model flags risk → bit is set" "Maximizes sensitivity" "Appropriate for a security firewall"

Slide 7 — "The 8-Bit Risk Code": 8 toggle switches. Bits 0-3 gold (GoPlus), Bits 4-7 teal (AI). Bullet: "Each bit = one risk category" "Owner configures via setFirewallConfig()" "Example: 36 = honeypot + privilege escalation"

Slide 8 — "WASM Sandbox": Docker container with Javy compiler icon. Bullet: "TypeScript compiled to WASM" "Runs inside DON sandbox" "Deterministic execution"

Slide 9 — "ConfidentialHTTPClient": 5 API calls shown with padlocks. Bullet: "GoPlus, BaseScan, OpenAI, Groq" "Secrets referenced by ID, not value" "Request + response encrypted"

Slide 10 — "Live Demo Output": Stylized terminal showing CRE simulation output. Yellow (GoPlus), Cyan (GPT-4o), Magenta (Llama-3). Final verdict: "Risk Code: 36 → BLOCKED." Cute robot with a stop sign.
```

---

## Presentation 3 — "Smart Account Architecture"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "Zero-Custody Smart Accounts." Subtitle: "ERC-4337 + ERC-7579 + ERC-7715." A Safe vault with three ERC badges floating around it.

Slide 2 — "The Old Model": A person handing keys to a bot. Red warnings. Bullet: "Full key handover" "No spending limits" "No revocation"

Slide 3 — "ERC-4337: Account Abstraction": A bundler truck carrying UserOps to an EntryPoint. Bullet: "UserOps replace raw transactions" "Pimlico bundler handles relay" "Gas sponsored — $0.00 for agent"

Slide 4 — "ERC-7579: Module System": AegisModule as a plug-in icon connecting to a Safe vault. Bullet: "Type-2 Executor Module" "onInstall, onUninstall, isModuleType" "Verified on BaseScan"

Slide 5 — "ERC-7715: Session Keys": A cute robot holding a small scoped card. Bullet: "SmartSessions validator on Safe" "Scoped to requestAudit + triggerSwap" "Owner key never touches trade ops"

Slide 6 — "UserOp Flow": Step diagram — Bot signs → Bundler → EntryPoint → SmartSessions validates → Safe executes → AegisModule receives. Clean arrows.

Slide 7 — "Budget Enforcement": A gauge/meter showing 0.05 ETH budget with 0.04 remaining after a swap. Bullet: "subscribeAgent(addr, 0.05 ETH)" "Each swap deducts from budget" "Exceeding budget = revert"

Slide 8 — "Kill Switch": A big red button labeled "revokeAgent()." Bullet: "Budget zeroed instantly" "Agent locked out" "Owner retains full control"

Slide 9 — "What's Standalone (Demo) vs Installed (Production)": Two-column comparison. Bullet: "Demo: AegisModule called directly" "Production: installModule on Safe" "Gap: Rhinestone Registry attestation"

Slide 10 — "The Trust Model": Layered diagram — Owner at top, Safe in middle, Agent at bottom with session key tether. Bullet: "Owner: custody + config + kill switch" "Safe: holds all capital" "Agent: scoped session key + budget"
```

---

## Presentation 4 — "Privacy Track: ConfidentialHTTPClient"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "Privacy-Preserving AI Oracle Design." Subtitle: "Every API call encrypted inside the DON." Padlock + WASM icon.

Slide 2 — "The Problem with Plain HTTP": Node operators as cute robots with binoculars watching API traffic. Bullet: "API keys visible to operators" "Token addresses leaked before trade" "Front-running risk"

Slide 3 — "ConfidentialHTTPClient": A sealed envelope going through a tunnel. Bullet: "Request built inside WASM sandbox" "Encrypted channel to API" "Response decrypted only in sandbox"

Slide 4 — "Secret Management": A vault icon labeled "DON Vault" with key IDs (AEGIS_OPENAI_SECRET, AEGIS_GROQ_SECRET). Bullet: "Registered once via CRE CLI" "Referenced by ID, never in source" "Injected at WASM runtime"

Slide 5 — "API Call 1: GoPlus Auth": Gold shield + padlock. Bullet: "JWT credentials sealed" "Token security query protected" "Rate limits managed by DON"

Slide 6 — "API Call 2: BaseScan Source": Teal document + padlock. Bullet: "Contract address encrypted" "Full Solidity source protected" "52,963 chars of BRETT never exposed"

Slide 7 — "API Calls 3-4: AI Models": Two cute robot brains + padlocks. Bullet: "GPT-4o and Llama-3 via encrypted channel" "Full source code in request body" "AI reasoning never leaves sandbox"

Slide 8 — "What Node Operators See": A cute robot operator with a blank screen. Bullet: "Cannot read request URL" "Cannot read response body" "Cannot extract API key"

Slide 9 — "Comparison Table": Split screen — "Plain HTTP" (red) vs "ConfidentialHTTPClient" (green). 5 rows comparing key visibility, request logging, response access, token leakage, secret storage.

Slide 10 — "The Guarantee": A shield icon labeled "Aegis uses ConfidentialHTTPClient exclusively." Bullet: "No plain HTTP code path" "Every external call is encrypted" "Privacy by design, not afterthought"
```

---

## Presentation 5 — "Autonomous Agents Track"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "BYOA: Bring Your Own Agent." Subtitle: "Any AI agent can subscribe to Aegis protection." A lineup of different cute robots in different colors.

Slide 2 — "Agent Subscription": The owner calling subscribeAgent(). Bullet: "Any ETH address can be subscribed" "Budget set per-agent" "On-chain, verifiable"

Slide 3 — "Session Key Issuance": A cute robot receiving a small key card from the Safe. Bullet: "SmartSessions (ERC-7715)" "Scoped to AegisModule functions" "No access to owner funds"

Slide 4 — "Agent Signs UserOp": A cute robot writing on a digital document with a key icon. Bullet: "Session key, not owner key" "requestAudit(tokenAddress)" "Pimlico bundles and relays"

Slide 5 — "The Audit Cycle": Circular flow — Agent requests → CRE audits → Verdict delivered → Agent swaps (or blocked). A cute robot waiting patiently during audit.

Slide 6 — "NOVA and CIPHER": Two cute robots with different personalities. NOVA (blue, 0.05 ETH budget) and CIPHER (green, 0.008 ETH). Bullet: "Multiple agents, independent budgets" "Each gets scoped session key" "Owner manages all"

Slide 7 — "Budget After Swap": A progress bar showing budget deduction. Before: 0.05 ETH. After: 0.04 ETH. Bullet: "Mathematically deducted on-chain" "Verifiable via agentAllowances()" "Cannot exceed limit"

Slide 8 — "Kill Switch Demo": Subscribe REX → Revoke REX → REX tries to trade → REVERT. A cute robot named REX looking confused behind a locked gate.

Slide 9 — "On-Chain Evidence": BaseScan transaction card showing session key UserOp. Bullet: "Tx hash verified on BaseScan" "Sender = session key address" "Owner key not in signature"

Slide 10 — "The BYOA Vision": An open marketplace where cute robots of all types line up to subscribe. Bullet: "DeFi arbitrage bots" "Yield farming agents" "Risk management AI" "All protected by Aegis"
```

---

## Presentation 6 — "Risk & Compliance Track"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "The 8-Bit AI Firewall." Subtitle: "Owner-configurable risk matrix powered by dual-LLM consensus." Shield with 8 small lights.

Slide 2 — "Automated Risk Monitoring": Pipeline from AuditRequested event to risk verdict. Bullet: "Every trade intent audited" "No manual review needed" "Results in seconds, not hours"

Slide 3 — "GoPlus Layer (Bits 0-3)": Four risk categories with gold icons. Bullet: "Unverified source" "Sell restriction" "Honeypot" "Proxy contract"

Slide 4 — "AI Layer (Bits 4-7)": Four risk categories with teal icons. Bullet: "Obfuscated tax" "Privilege escalation" "External call risk" "Logic bomb"

Slide 5 — "Owner Firewall Config": 8 toggle switches in a control panel. A person adjusting toggles. Bullet: "setFirewallConfig() on-chain" "Each bit independently configurable" "Different risk tolerance per vault"

Slide 6 — "Protocol Safeguards": Three safety mechanisms as icons. Bullet: "TokenNotCleared() revert" "ClearanceDenied event" "revokeAgent() kill switch"

Slide 7 — "Live Example: BRETT Token": Green path showing BRETT analyzed → Risk Code 0 → CLEARED. Happy cute robot executes swap.

Slide 8 — "Live Example: MockHoneypot": Red path showing MockHoneypot analyzed → Risk Code 36 → BLOCKED. Sad cute robot behind barrier. Bullet: "Bit 2: Honeypot (GoPlus)" "Bit 5: Privilege Escalation (AI)" "triggerSwap() REVERTED"

Slide 9 — "Defense in Depth": Two independent detection layers stacked. GoPlus (data-driven) + AI (code analysis). Bullet: "Both must MISS for risk to pass" "Independent analysis paths" "No single point of failure"

Slide 10 — "Compliance Summary": Checklist with green checkmarks. Bullet: "Automated monitoring ✓" "Configurable safeguards ✓" "On-chain enforcement ✓" "Verifiable audit trail ✓"
```

---

## Presentation 7 — "DeFi & Tokenization Track"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "The AI-Gated Smart Treasury." Subtitle: "A new DeFi primitive: per-trade AI clearance." Safe vault with brain icon.

Slide 2 — "What's New in DeFi": Traditional vaults vs Aegis. Bullet: "Traditional: approve and forget" "Aegis: per-trade AI gate" "Every swap requires clearance"

Slide 3 — "The Treasury Model": AegisModule as a vault with ETH inside. Person deposits, robot requests access. Bullet: "depositETH() to fund" "Budget allocated per-agent" "Clearance required per-trade"

Slide 4 — "CRE as DeFi Orchestration": Chainlink oracle as a traffic controller. Bullet: "Multi-model AI audit" "Governs per-token clearance" "On-chain callback controls execution"

Slide 5 — "Budget Enforcement": Gauge showing budget depletion. Bullet: "On-chain budget tracking" "Deducted with each swap" "Mathematically verifiable"

Slide 6 — "Clearance Consumption (CEI)": Flow diagram showing isApproved being set to true, then consumed in triggerSwap. Bullet: "Checks-Effects-Interactions pattern" "Clearance consumed atomically" "Cannot reuse a clearance"

Slide 7 — "The Swap Path": Token flow diagram — Agent requests → Cleared → triggerSwap → Budget deducted → SwapExecuted event. Green flow.

Slide 8 — "The Block Path": Same flow but blocked — Agent requests → Blocked → triggerSwap reverts → TokenNotCleared() → Zero capital lost. Red flow.

Slide 9 — "Testnet vs Mainnet": Side-by-side. Bullet: "Testnet: SwapExecuted event (simulated)" "Mainnet: Uniswap V3 exactInputSingle" "Budget + clearance = real today"

Slide 10 — "The DeFi Primitive": A cute robot trading safely behind a force field labeled Aegis. Bullet: "Per-trade AI clearance" "Budget-enforced execution" "Novel DeFi building block"
```

---

## Presentation 8 — "Heimdall: The Bytecode Fallback"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "When Source Code Doesn't Exist." Subtitle: "Heimdall: bytecode decompilation for unverified contracts." A mysterious dark contract with question marks.

Slide 2 — "The Gap": Most firewalls require verified source code. What about unverified contracts? Bullet: "Malicious actors skip verification" "Traditional tools go blind" "Bit 0 flags it — but no one knows WHY"

Slide 3 — "The Pipeline": Horizontal flow — eth_getCode → Heimdall Docker → GPT-4o → Risk Code. Four connected boxes with icons.

Slide 4 — "Step 1: eth_getCode": RPC antenna pulling raw hex from Base Sepolia. Bullet: "19,666 hex characters" "Raw EVM bytecode" "No readability"

Slide 5 — "Step 2: Heimdall-rs": Docker container with gears. Bullet: "Symbolic execution" "Reconstructs function signatures" "15,000 chars Solidity-like output"

Slide 6 — "Step 3: GPT-4o Analysis": Cute robot brain reading decompiled pseudocode. Bullet: "Specialized reverse-engineering prompt" "Chain-of-thought analysis" "Hunts 5 vulnerability patterns"

Slide 7 — "What It Hunts": 5 icons for vulnerability patterns. Bullet: "Honeypot sell blocks" "Hidden minting" "Fee manipulation" "Blocklisting" "Unauthorized selfdestruct"

Slide 8 — "Live Result: MaliciousRugToken": Red verdict card. Bullet: "5 embedded vulnerabilities" "95% hidden tax detected" "is_malicious: TRUE"

Slide 9 — "Key Advantage": Comparison table — Heimdall (local, no API keys, no rate limits, confidential) vs Third-party APIs (external, auth required, rate limited).

Slide 10 — "Status & Future": Dashed arrow from Heimdall to CRE pipeline. Bullet: "Currently standalone demo" "Future: auto-fallback when BaseScan empty" "Extends Aegis to ALL contracts"
```

---

## Presentation 9 — "The Frontend Dashboard"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "The Aegis Command Center." Subtitle: "Real-time treasury management with AI chat and live oracle feed." Dashboard wireframe silhouette.

Slide 2 — "3-Panel Layout": Left sidebar (agents), center (chat), right (oracle feed). Clean wireframe showing the layout.

Slide 3 — "Agent Management": List of cute robots with names and budgets. Bullet: "Subscribe new agents" "View remaining allowances" "One-click revoke (kill switch)"

Slide 4 — "8-Bit Firewall Toggles": 8 toggle switches in a panel. Bullet: "Each toggle = one risk bit" "Synced with on-chain config" "Real setFirewallConfig() tx"

Slide 5 — "AI Chat Interface": Chat bubble with AEGIS responding. Bullet: "GPT-4o with live chain data" "Knows all agents and balances" "Speaks as AEGIS, not generic AI"

Slide 6 — "Oracle Feed (SSE)": Live streaming output — green "BRETT APPROVED" and red "HoneypotCoin BLOCKED." Bullet: "Server-Sent Events" "Real-time CRE output" "Color-coded by phase"

Slide 7 — "Trade Simulation Modal": Token picker dropdown + amount slider. Cute robot about to submit a trade. Bullet: "Select any tracked token" "Set trade amount" "Triggers full CRE audit"

Slide 8 — "Kill Switch UI": Red PROTOCOL LOCKED banner across the top. Bullet: "Instantaneous" "All agents frozen" "Owner-only action"

Slide 9 — "Bot Marketplace": 5 bot cards — BLUECHIP (blue), YIELD (green), DEGEN (orange), SAFE (teal), HEIMDALL (purple). Each is a cute robot with a personality.

Slide 10 — "Real Transactions": Every button sends a real Base Sepolia transaction. Bullet: "Not a mockup — live on-chain" "SSE oracle shows real CRE output" "Verifiable on BaseScan"
```

---

## Presentation 10 — "Lessons Learned: Building Aegis"

```
VISUAL THEME FOR ALL 10 SLIDES: Landscape 16:9. Soft blues, teals, greens, warm grays. Avoid clutter — white space is your friend. Every visual element must earn its place. Minimal text — maximum 3 short bullet points per slide. AI agents are cute robots, not humans or abstract shapes. Balance hardcore tech with friendly consumer aesthetics.

Generate 10 presentation slides:

Slide 1 — Title: "Building Aegis: What We Learned." Subtitle: "Engineering decisions, platform gaps, and honest disclosures." A cute robot with a notebook.

Slide 2 — "Rhinestone Registry": A module trying to plug into Safe but being rejected. Bullet: "installModule reverts: GS000" "All modules need registry attestation" "Solution: deploy standalone for demo"

Slide 3 — "CRE Simulate vs Deploy": A cute robot running code locally vs running on a DON network. Bullet: "Same WASM binary" "Same ConfidentialHTTPClient" "Difference: local vs decentralized"

Slide 4 — "LLM Nondeterminism": Two cute robot brains giving slightly different answers. Bullet: "GPT-4o + Llama-3 may disagree" "ConsensusAggregationByFields" "Per-field median absorbs variance"

Slide 5 — "Union of Fears": Why OR instead of AND for risk bits. Bullet: "Security firewall = maximize sensitivity" "False positive > false negative" "One model flags = bit is set"

Slide 6 — "No Testnet Liquidity": A DEX with an "EMPTY" sign. A cute robot shrugging. Bullet: "No real swap on Base Sepolia" "Emit-only triggerSwap" "Uniswap V3 code included, commented"

Slide 7 — "Event Indexing Shifts": CRE DON intercepting events. Bullet: "Session key UserOps land at log index 3" "Must parse correct event slot" "Discovered through live debugging"

Slide 8 — "Doc Drift": A messy pile of documents vs a clean organized stack. Bullet: "Incremental changes create lies" "Stale test counts (21→18 forge)" "Fix: truth audit before submission"

Slide 9 — "AI Development Workflow": Google Antigravity + Gemini + Claude icons. Bullet: "Protocol AI: GPT-4o + Llama-3" "Development: Antigravity, Gemini, Claude" "Media: NotebookLM, Veo 3"

Slide 10 — "Closing": The Aegis shield with all the cute robot agents around it. Bullet: "Judges deserve honesty" "Simulated ≠ fake" "The code is production-ready"
```
