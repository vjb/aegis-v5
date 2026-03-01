# 🔄 PICKUP — Final QA Pass (Resume From Here)

> **Created:** 2026-03-01 12:25 EST — User rebooting machine due to memory pressure
> **Branch:** `main` at commit `0714b31` (16 commits this session, NOT pushed yet — there are additional uncommitted changes)
> **Last session ID:** `5cf1739d-a9eb-41b1-9a66-c1a1b85d9c5c`

---

## 📋 WHAT THE USER WANTS (verbatim)

> Run all end-to-end tests. Every test and every demo script needs to run. All output needs to be captured. Review all output and make sure it's expected — iterate. Catalog all hackathon proof points. Update all READMEs. Run all frontend UI tests. This is the final round of checks on the entire project. Commit but DO NOT push until I give the OK.

---

## ✅ WHAT IS ALREADY DONE THIS SESSION

### README Restructure (done, uncommitted)
- [x] Demoted Heimdall from prominent README section (was 30 lines) to 3-line "Experimental" mention with link to dedicated doc
- [x] Created `docs/HEIMDALL_PIPELINE.md` — comprehensive standalone doc (clearly labeled as experimental, not in live CRE oracle)
- [x] Fixed Security Loop Step 2 — removed Heimdall from bullet list (it's NOT in the live CRE flow)
- [x] Removed contradictory "Roadmap" paragraph that said Heimdall was upcoming when it was already built
- [x] Fixed marketplace count from 4→5 strategies
- [x] Removed Heimdall from Oracle Feed description in README
- [x] Updated `docs/README.md` index — added HEIMDALL_PIPELINE.md entry
- [x] Architecture diagram count reverted to 12 in README (13th diagram stays in ARCHITECTURE.md but not inflated in README claims)

### Language & Inclusivity Fixes (done, uncommitted)
- [x] Replaced "whitelisted wallets" → "approved wallets" in `aegis-frontend/app/api/chat/route.ts` (2 instances)
- [x] Replaced "Master Demo" → "End-to-End Showcase" in `scripts/demo_v5_master.ps1` header
- [x] Checked for: whitelist (3 hits — 2 fixed in chat, 1 is GoPlus API field name), blacklist (GoPlus API field names only), sanity check (none found)
- [x] Note: filename `demo_v5_master.ps1` kept as-is because renaming would break 25+ cross-references; the skill explicitly allows this

### Test Results (captured but output files may be incomplete due to cancelled commands)
- [x] **Forge:** 21/21 passing (18 AegisModule + 3 templates)
- [x] **Jest total:** 9 suites, 8 passed, 1 failed
  - ✅ `bot.spec.ts` — 6/6
  - ✅ `bot_v5.spec.ts` — passed
  - ✅ `oracle.spec.ts` — 10/10
  - ✅ `session_key.spec.ts` — passed
  - ✅ `session_install.spec.ts` — passed
  - ✅ `safe_setup.spec.ts` — 6/6 (1 skipped — needs live deploy)
  - ✅ `frontend.spec.ts` — 8/8
  - ✅ `cre/HeimdallLive.spec.ts` — 6/6 (ALL passed including Phase 4 live GPT-4o!)
  - ❌ `live_e2e.spec.ts` — 5 failures (RPC errors — needs Tenderly VNet provisioned)

### Previous Session Commits (16 commits, pushed to `main`)
These are already on remote — do NOT re-push:
```
0714b31 fix(chat): sync PHANTOM + UnverifiedDoge in demo fallback
fc840d9 feat(agents): add PHANTOM demo agent + fix branch ref
5a886f9 infra: decompiler in docker-compose + service README
3d4dc1c docs(arch): Heimdall Bytecode Fallback Pipeline diagram (#13)
cdf097b feat(auditlog): UnverifiedDoge demo event (riskCode=129)
a588bdc feat(firewall): Heimdall fallback on Bit 0
22ef6a9 feat(marketplace): HEIMDALL_BOT template
db3ef75 docs: mark all Heimdall phases complete
d4e024f style(oracle): purple Heimdall phase styling
f13cae4 feat(chat): Heimdall system prompt knowledge
3cb7e72 feat(chat): decompile intent + suggestions
1ae2cfd style: premium micro-animations (120 lines CSS)
2cd6266 docs: Frontend Dashboard + Security Loop
fe2b7a8 feat: Heimdall API + pipeline + OracleFeed
8a39361 feat: Heimdall header status
01ce616 docs: UI/UX test matrix (15/50)
```

---

## 🔲 WHAT REMAINS TO DO

### 1. Commit Uncommitted Changes
- All the README/language changes above are staged but NOT committed
- Commit message suggestion: `docs: demote Heimdall in README, create dedicated pipeline doc, fix language`

### 2. Re-run and Capture Test Output
- **Re-run `npx jest test/cre/HeimdallLive.spec.ts --verbose`** — user added OpenAI balance, Phase 4 should pass now
- **Re-run full `npx jest --verbose`** and save to `docs/sample_output/jest_tests.txt`
- **Re-run `forge test --summary`** and save to `docs/sample_output/forge_tests.txt`
- Review all output files in `docs/sample_output/` for accuracy

### 3. Upgrade the Heimdall LLM Prompt (NEW — user request)
The current LLM prompt in `scripts/demo_v5_heimdall.ps1` (line 329) and `test/cre/HeimdallLive.spec.ts` (line 183) is too generic. User wants it replaced with this specialized reverse-engineering prompt:

```
You are an elite Web3 Smart Contract Auditor and Reverse Engineer specializing in EVM bytecode analysis.
You will be provided with decompiled smart contract logic (generated via Heimdall or Dedaub).

Your objective is to determine if this contract is safe for an AI Agent to interact with, or if it contains malicious logic (Honeypot, Rug Pull, Trapped Liquidity, Hidden Mints).

CRITICAL CONSTRAINTS:
1. The code is decompiled. You will not see standard variable names (like `balanceOf` or `owner`). You will see raw storage slots (e.g., `storage[0x0]`), `CALL`, `DELEGATECALL`, and `REVERT` patterns. Do not complain about the lack of readability.
2. Focus strictly on control flow and state restrictions.
3. You must output your final analysis in STRICT JSON format. Do not include markdown formatting like ```json in your final output.

VULNERABILITY PATTERNS TO HUNT:
- Honeypot (Sell Block): Look for conditional `REVERT`s inside the `transfer` or `transferFrom` logic. Specifically, look for logic that allows transfers FROM a specific address (the deployer) but reverts transfers from normal users.
- Hidden Minting: Look for logic that increases the total supply or arbitrary user balances without a corresponding deposit, restricted only to a specific storage slot (the owner).
- Fee Manipulation: Look for math operations that deduct an extreme percentage (e.g., >90%) of a transfer amount and route it to a hardcoded address.
- Blacklisting: Look for mappings (nested storage slots) checked against `msg.sender` that trigger a `REVERT`.
- Unauthorized Self-Destruct / DelegateCall: Look for `SELFDESTRUCT` or `DELEGATECALL` operations controlled by a single restricted address.

ANALYSIS PROTOCOL (Chain of Thought):
1. Identify the likely `transfer` and `transferFrom` function equivalents.
2. Trace the conditional requirements (`if / revert` or `require` equivalents) within those functions.
3. Determine if a normal user (not the deployer) can successfully execute a transfer out after buying.
4. Assign a strict boolean verdict: `is_malicious`.

Analyze for malicious patterns and return ONLY valid JSON:
{
  "obfuscatedTax": boolean,
  "privilegeEscalation": boolean,
  "externalCallRisk": boolean,
  "logicBomb": boolean,
  "is_malicious": boolean,
  "reasoning": "one sentence"
}
```

**Files to update with this prompt:**
- `scripts/demo_v5_heimdall.ps1` — line ~329 (`$AIPrompt = @"...`)
- `test/cre/HeimdallLive.spec.ts` — line ~183 (`const prompt = ...`)
- `aegis-frontend/app/api/decompile/route.ts` — if there's an LLM call there
- `docs/HEIMDALL_PIPELINE.md` — mention this specialized prompt in the documentation

### 4. Run Demo Scripts (identify which can run without Docker/Tenderly)
- `demo_v5_heimdall.ps1` — REQUIRES Docker container `aegis-heimdall` on port 8080
- `demo_v5_master.ps1` — REQUIRES Tenderly VNet + Docker
- `demo_v5_setup.ps1` — REQUIRES Docker for CRE container rebuild
- `demo_v5_cre.ps1` — REQUIRES Docker for CRE workflow simulation

### 5. Frontend Browser UI Tests
- Browser was dead for 16 consecutive attempts (6+ hours) in the previous session
- Fresh session should fix this
- UI test matrix: `docs/UI_TEST_MATRIX.md` — 50 tests, 15 passed previously, 35 remaining
- Dev server: `cd aegis-frontend && npm run dev` (runs on localhost:3000)

### 6. Update README Badge Counts
- Current badge says "83 passing" for Jest — should be updated to reflect actual count
- Current badge says "21 passing" for Forge — correct ✅
- After all tests pass, update the badges in `README.md` lines 9-10

### 7. Catalog Hackathon Proof Points
Create a comprehensive list of all demonstrable proof points for judges:
- On-chain contracts (verified on BaseScan)
- Test suite results (forge + jest)
- Demo script outputs (captured in sample_output)
- Frontend dashboard screenshots
- Architecture diagrams (12 Mermaid + 1 experimental Heimdall)
- ERC standards compliance evidence

### 8. Final Commit (NO PUSH)
- Bundle all remaining changes into a clean commit
- DO NOT `git push` — user wants to review first

---

## 🏗️ PROJECT STRUCTURE QUICK REFERENCE

```
aegis-v4/
├── src/AegisModule.sol          # Main ERC-7579 Executor contract
├── test/                        # Forge (Solidity) + Jest (TypeScript) tests
│   ├── AegisModule.t.sol        # 18 Solidity tests
│   ├── bot.spec.ts              # 6 bot config tests
│   ├── bot_v5.spec.ts           # V5 bot structure tests
│   ├── oracle.spec.ts           # 10 oracle ABI encoding tests
│   ├── session_key.spec.ts      # Session key scope tests
│   ├── session_install.spec.ts  # Session validator install tests
│   ├── safe_setup.spec.ts       # Safe + module setup tests
│   ├── frontend.spec.ts         # 8 frontend component tests
│   ├── live_e2e.spec.ts         # Live E2E (needs Tenderly VNet)
│   └── cre/HeimdallLive.spec.ts # 6 live Heimdall pipeline tests
├── scripts/
│   ├── demo_v5_master.ps1       # 7-act E2E showcase
│   ├── demo_v5_setup.ps1        # Infrastructure boot
│   ├── demo_v5_cre.ps1          # CRE-only showcase
│   └── demo_v5_heimdall.ps1     # Heimdall decompilation demo
├── services/decompiler/         # Heimdall Docker microservice
│   ├── Dockerfile               # Multi-stage Rust → Node build
│   ├── server.js                # Express API (POST /decompile)
│   └── README.md                # Service docs
├── aegis-frontend/              # Next.js 3-panel dashboard
│   └── app/
│       ├── page.tsx             # Main layout
│       ├── components/          # AgentsTab, FirewallTab, AuditLogTab, MarketplaceTab, OracleFeed, AegisChat
│       └── api/                 # chat, audit, decompile, firewall, events routes
├── cre-node/                    # Chainlink CRE oracle (aegis-oracle.ts)
├── docs/                        # Architecture, ERC standards, demo guide, Heimdall pipeline
│   ├── HEIMDALL_PIPELINE.md     # NEW — dedicated Heimdall doc
│   └── sample_output/           # Captured test/demo output
├── docker-compose.yaml          # cre-node + decompiler + alto-bundler
├── README.md                    # Main README (just restructured)
└── .env                         # API keys (OPENAI, RPC, TENDERLY, etc.)
```

## 🐳 DOCKER SETUP (for demo scripts)

```bash
# Build and start Heimdall decompiler
docker build -t aegis-heimdall ./services/decompiler
docker run -d -p 8080:8080 --name aegis-heimdall aegis-heimdall

# Or use docker-compose
docker compose up decompiler -d

# Verify
curl http://localhost:8080/health
```

## 🖥️ FRONTEND DEV SERVER

```bash
cd aegis-frontend
npm run dev
# Runs on http://localhost:3000
```

## ⚠️ LANGUAGE SKILL REMINDER

Read `.agent/skills/readme-language/SKILL.md` before editing any docs. Key rules:
- No "master" as descriptor (filename refs OK)
- No "whitelist/blacklist" (use allowlist/blocklist) — GoPlus API field names are exceptions
- No "sanity check" (use validation check)
- "Kill switch" is acceptable in security contexts
- No prize dollar amounts in docs
