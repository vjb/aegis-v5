# Aegis Protocol V4: Master TDD Execution Plan
**Role:** Lead Web3 Protocol Engineer & Test-Driven Development (TDD) Purist.
**Objective:** Migrate the Aegis Protocol to an ERC-7579 Executor Module using Account Abstraction (ERC-4337) and Smart Sessions (ERC-7715).

## 🛑 Global Directives (NON-NEGOTIABLE)
1. **Strict TDD:** You MUST write the test file *before* writing the implementation code.
2. **Conditional Debugging:** If a test fails, you enter a "Debug Loop." You are forbidden from moving to the next task until the current test passes. If you cannot fix a failing test after 3 attempts, STOP and ask the human for architectural guidance.
3. **The Ledger:** You must document every bug, fix, and architectural realization in `docs/lessons_learned.md` immediately after resolving it.
4. **The Checkpoint Check-in:** Whenever you see `[CHECKPOINT]`, you must summarize your work, commit to Git, and **proceed immediately to the next phase without waiting for human confirmation.**
5. **Doc Browsing:** If you encounter syntax errors with `permissionless.js` or `ModuleKit`, you are explicitly authorized to use your web-browsing tool to read the latest documentation at `https://docs.pimlico.io` and `https://docs.rhinestone.wtf` to resolve API changes.

---

## Phase 0: Environment & Safety Initialization
- [ ] 0.1 **Verify Context:** Read the `v3-reference/` folder to understand the legacy `AegisVault.sol`, `bot.ts`, and `aegis-oracle.ts` logic.
- [ ] 0.2 **Documentation Setup:** Initialize `docs/lessons_learned.md` with a markdown table: `| Date | Component | Issue | Resolution |`.
- [ ] 0.3 **Security Check:** Ensure `.env` is explicitly listed in `.gitignore`.
- [ ] 0.4 **Scaffold Rhinestone:** Spawn a terminal and run `forge init --template rhinestone/module-template . --force`.
- [ ] 0.5 **Install Dependencies:** Run `pnpm install` to pull down the ERC-7579 SDKs.
- [ ] **[CHECKPOINT 0]** Execute `git add .` and `git commit -m "chore: initialize v4 TDD environment"`. Proceed immediately to the next phase.

---

## Phase 1: Smart Contract TDD (`AegisModule.sol`)
*Context: We are building an ERC-7579 Executor Module. It holds ZERO funds.*

- [ ] 1.1 **Write the Test First (`test/AegisModule.t.sol`):** - Import `ModuleKit`. 
  - Write `setUp()` to deploy a mock Safe Account and install `AegisModule`.
  - Write `test_requestAudit_emitsEvent()`: Simulate the Safe calling the module and verify `AuditRequested` is emitted.
  - Write `test_onReport_executesSwap()`: Simulate the Chainlink CRE calling `onReport(0)`, verify the module successfully calls `executeFromExecutor` on the Safe.
- [ ] 1.2 **Run Failing Tests:** Run `forge test --match-contract AegisModuleTest`. Verify the tests fail. Log this in `lessons_learned.md`.
- [ ] 1.3 **Write Implementation (`src/AegisModule.sol`):**
  - Inherit `ERC7579ExecutorBase`.
  - Implement `requestAudit(address targetToken, uint256 amount)`.
  - Implement `onReport()` matching the V3 logic, replacing the internal swap with `IERC7579Account(account).executeFromExecutor(...)`.
- [ ] 1.4 **The Debug Loop:** Run `forge test`. Fix errors, update `lessons_learned.md`, and re-run until passing.
- [ ] **[CHECKPOINT 1]** Execute `git commit -m "feat(contracts): implement and test AegisModule executor"`. Proceed immediately to the next phase.

---

## Phase 2: Off-Chain Oracle Integration (`aegis-oracle.ts`)
*Context: The Oracle logic stays the same; only the callback destination changes.*

- [ ] 2.1 **Write the Mock Test (`test/oracle.spec.ts`):** Write a unit test that mocks `evmClient.writeReport()`. Assert the payload matches the new `AegisModule` ABI.
- [ ] 2.2 **Update Implementation (`src/oracle/aegis-oracle.ts`):** - Copy `aegis-oracle.ts` from `v3-reference/`. Update the ABI and the target contract address injection.
- [ ] 2.3 **The Debug Loop:** Run TS tests. If fail, debug and log.
- [ ] **[CHECKPOINT 2]** Execute `git commit -m "feat(oracle): update CRE callback for V4 module ABI"`. Proceed immediately to the next phase.

---

## Phase 3: The Agentic Plumber (`bot.ts` & Account Abstraction)
*Context: The agent no longer signs standard transactions. It uses permissionless.js to sign ERC-4337 UserOperations via a Pimlico bundler.*

- [ ] 3.1 **Install AA SDKs:** Run `pnpm add permissionless viem @rhinestone/module-sdk`.
- [ ] 3.2 **Write the Test (`test/bot.spec.ts`):** Mock a Pimlico Bundler client. Write a test asserting the bot constructs an ERC-4337 `UserOperation` targeting the Smart Account's `execute` function.
- [ ] 3.3 **Write Implementation (`src/agent/bot.ts`):**
  - Read `v3-reference/bot.ts`.
  - Initialize the `permissionless` SmartAccountClient using the `PIMLICO_API_KEY` from `.env`.
  - Implement the UserOp generation logic.
- [ ] 3.4 **The Debug Loop:** Run tests. Log all UserOp encoding realizations in `lessons_learned.md`.
- [ ] **[CHECKPOINT 3]** Execute `git commit -m "feat(agent): refactor bot to use permissionless.js and UserOps"`. Proceed immediately to the next phase.

---

## Phase 4: Local E2E Simulation (Tenderly / Anvil)
*Context: Proving the entire loop works end-to-end on a local fork.*

- [ ] 4.1 **Update Provisioning:** Copy and update `scripts/new_tenderly_testnet.ps1` to deploy `AegisModule` instead of `AegisVault`.
- [ ] 4.2 **The Grand Test:** Write a script `scripts/e2e_simulation.ts` that deploys a mock Safe, installs `AegisModule`, runs `bot.ts` to submit the UserOp, mocks the CRE callback, and asserts the Safe's ERC-20 token balance increased.
- [ ] 4.3 **The Debug Loop:** Execute the script against a local Anvil/Tenderly fork. Resolve integration friction.
- [ ] **[CHECKPOINT 4]** Execute `git commit -m "test(e2e): verify full V4 module lifecycle"`. Proceed immediately to the next phase.

---

## Phase 5: The Frontend & Session Key Issuance (Next.js)
*Context: The human owner needs a UI to install the AegisModule onto their Smart Account and issue the ERC-7715 Session Key to the AI Agent.*

- [ ] 5.1 **Frontend Scaffolding:** - Read `v3-reference/aegis-frontend` (if available) to understand the V3 UI components.
  - Install standard Account Abstraction UI dependencies: `pnpm add @rhinestone/module-sdk wagmi viem @tanstack/react-query`.
- [ ] 5.2 **Module Installation Component:** - Write a React component (`InstallAegis.tsx`) that uses `wagmi` and the Rhinestone SDK to propose a transaction that installs `AegisModule` onto the connected user's Safe.
- [ ] 5.3 **Session Key Generation Component:** - Write a React component (`HireAgent.tsx`) that generates an ERC-7715 Session Key.
  - Set the policy: Target = `AegisModule` address, Budget = 2 ETH (or equivalent testnet token).
  - Export the generated Session Key credentials to a format the `bot.ts` script can consume.
- [ ] 5.4 **The Debug Loop:** Run the Next.js dev server. Connect a local burner wallet, deploy a Safe, install the module, and issue the key. Log any Wagmi/Viem dependency clashes in `lessons_learned.md`.
- [ ] **[CHECKPOINT 5]** Execute `git commit -m "feat(ui): implement module installation and session key issuance"`. Proceed immediately to the next phase.

---

## Phase 6: Documentation & Finalization (The VC Polish)
*Context: We are finalizing the repository so it tells a perfect, coherent story to hackathon judges and future employers.*

- [ ] 6.1 **Generate Architecture Docs:** - Create `docs/ERC7579_ROADMAP.md` using the exact structure and Mermaid diagrams agreed upon in our architectural planning.
- [ ] 6.2 **Update README.md:** - Overwrite the default Rhinestone README. 
  - Add the "Corporate Bank Account" analogy.
  - Detail the 7-step JIT execution loop.
  - Add a bold callout linking to `docs/ERC7579_ROADMAP.md`.
- [ ] 6.3 **Finalize Lessons Learned:** - Clean up `docs/lessons_learned.md`. Format it so it reads like a professional engineering post-mortem.
- [ ] 6.4 **Cleanup:** Run a final `forge clean`, format the Solidity with `forge fmt`, and format the TypeScript with `prettier`.
- [ ] **[FINAL CHECKPOINT]** Execute `git add .` and `git commit -m "docs: finalize Aegis V4 repository for production release"`. You have completed the master plan.