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
- [x] 0.1 **Verify Context:** Read the `v3-reference/` folder to understand the legacy `AegisVault.sol`, `bot.ts`, and `aegis-oracle.ts` logic.
- [x] 0.2 **Documentation Setup:** Initialize `docs/lessons_learned.md` with a markdown table: `| Date | Component | Issue | Resolution |`.
- [x] 0.3 **Security Check:** Ensure `.env` is explicitly listed in `.gitignore`.
- [x] 0.4 **Scaffold Rhinestone:** Spawn a terminal and run `forge init --template rhinestone/module-template . --force`.
- [x] 0.5 **Install Dependencies:** Run `pnpm install` to pull down the ERC-7579 SDKs.
- [x] **[CHECKPOINT 0]** Execute `git add .` and `git commit -m "chore: initialize v4 TDD environment"`. Proceed immediately to the next phase.

---

## Phase 1: Smart Contract TDD (`AegisModule.sol`)
*Context: We are building an ERC-7579 Executor Module. It holds ZERO funds.*

- [x] 1.1 **Write the Test First (`test/AegisModule.t.sol`):** - Import `ModuleKit`. 
  - Write `setUp()` to deploy a mock Safe Account and install `AegisModule`.
  - Write `test_requestAudit_emitsEvent()`: Simulate the Safe calling the module and verify `AuditRequested` is emitted.
  - Write `test_onReport_executesSwap()`: Simulate the Chainlink CRE calling `onReport(0)`, verify the module successfully calls `executeFromExecutor` on the Safe.
- [x] 1.2 **Run Failing Tests:** Run `forge test --match-contract AegisModuleTest`. Verify the tests fail. Log this in `lessons_learned.md`.
- [x] 1.3 **Write Implementation (`src/AegisModule.sol`):**
  - Inherit `ERC7579ExecutorBase`.
  - Implement `requestAudit(address targetToken, uint256 amount)`.
  - Implement `onReport()` matching the V3 logic, replacing the internal swap with `IERC7579Account(account).executeFromExecutor(...)`.
- [x] 1.4 **The Debug Loop:** Run `forge test`. Fix errors, update `lessons_learned.md`, and re-run until passing.
- [x] **[CHECKPOINT 1]** Execute `git commit -m "feat(contracts): implement and test AegisModule executor"`. Proceed immediately to the next phase.

---

## Phase 2: Off-Chain Oracle Integration (`aegis-oracle.ts`)
*Context: The Oracle logic stays the same; only the callback destination changes.*

- [x] 2.1 **Write the Mock Test (`test/oracle.spec.ts`):** Write a unit test that mocks `evmClient.writeReport()`. Assert the payload matches the new `AegisModule` ABI.
- [x] 2.2 **Update Implementation (`src/oracle/aegis-oracle.ts`):** - Copy `aegis-oracle.ts` from `v3-reference/`. Update the ABI and the target contract address injection.
- [x] 2.3 **The Debug Loop:** Run TS tests. If fail, debug and log.
- [x] **[CHECKPOINT 2]** Execute `git commit -m "feat(oracle): update CRE callback for V4 module ABI"`. Proceed immediately to the next phase.

---

## Phase 3: The Agentic Plumber (`bot.ts` & Account Abstraction)
*Context: The agent no longer signs standard transactions. It uses permissionless.js to sign ERC-4337 UserOperations via a Pimlico bundler.*

- [x] 3.1 **Install AA SDKs:** Run `pnpm add permissionless viem @rhinestone/module-sdk`.
- [x] 3.2 **Write the Test (`test/bot.spec.ts`):** Mock a Pimlico Bundler client. Write a test asserting the bot constructs an ERC-4337 `UserOperation` targeting the Smart Account's `execute` function.
- [x] 3.3 **Write Implementation (`src/agent/bot.ts`):**
  - Read `v3-reference/bot.ts`.
  - Initialize the `permissionless` SmartAccountClient using the `PIMLICO_API_KEY` from `.env`.
  - Implement the UserOp generation logic.
- [x] 3.4 **The Debug Loop:** Run tests. Log all UserOp encoding realizations in `lessons_learned.md`.
- [x] **[CHECKPOINT 3]** Execute `git commit -m "feat(agent): refactor bot to use permissionless.js and UserOps"`. Proceed immediately to the next phase.

---

## Phase 4: Local E2E Simulation (Mocked Oracle)
*Context: Proving the AA loop works end-to-end on a local fork before involving Docker.*

- [/] 4.1 **Update Provisioning:** Copy and update `scripts/new_tenderly_testnet.ps1` to deploy `AegisModule` instead of `AegisVault`.
- [ ] 4.2 **The Mock Test:** Write a script `scripts/e2e_mock_simulation.ts` that deploys a mock Safe, installs `AegisModule`, runs `bot.ts` to submit the UserOp, forcefully mocks the CRE callback, and asserts the Safe's ERC-20 token balance increased.
- [ ] 4.3 **The Debug Loop:** Execute the script against a local Anvil/Tenderly fork. Resolve integration friction.
- [ ] **[CHECKPOINT 4]** Execute `git commit -m "test(e2e): verify full V4 module lifecycle with mocked oracle"`. Proceed immediately to the next phase.

---

## Phase 5: The Real Chainlink CRE Integration (Live E2E)
*Context: We proved the smart contract works. Now we remove the training wheels and use the actual off-chain Chainlink CRE node to process the event and submit the transaction.*

- [ ] 5.1 **Oracle Configuration:** Ensure the `v3-reference/.env` or CRE node config points its RPC URL to the local Anvil/Tenderly testnet instance.
- [ ] 5.2 **Node Initialization:** Write a script `scripts/start_oracle.ps1` that spins up the Chainlink CRE environment using the existing `docker-compose.yaml` and connects it to the local fork.
- [ ] 5.3 **The Live E2E Test:** Write `scripts/live_e2e.ts`. It must:
  - Deploy the mock Safe and install `AegisModule`.
  - Trigger `bot.ts` to send the UserOp.
  - **Wait.** Do NOT mock the callback. Monitor the network until the Dockerized Chainlink CRE node picks up the `AuditRequested` event, runs the consensus, and natively calls `onReport` back on-chain.
- [ ] 5.4 **The Debug Loop:** Execute the live E2E test. Monitor the Docker logs for the CRE node. Fix any ABI mismatches, RPC failures, or event-listening bugs.
- [ ] **[CHECKPOINT 5]** Execute `git commit -m "test(e2e): verify live Chainlink CRE node integration"`. Proceed immediately to the next phase.

---

## Phase 6: The Frontend & Session Key Issuance (Next.js)
*Context: The human owner needs a UI to install the AegisModule onto their Smart Account and issue the ERC-7715 Session Key to the AI Agent.*

- [ ] 6.1 **Frontend Scaffolding:** - Read `v3-reference/aegis-frontend` (if available) to understand the V3 UI components. Install standard AA UI dependencies: `pnpm add @rhinestone/module-sdk wagmi viem @tanstack/react-query`.
- [ ] 6.2 **Module Installation Component:** Write a React component (`InstallAegis.tsx`) that uses Wagmi to install `AegisModule` onto the connected user's Safe.
- [ ] 6.3 **Session Key Generation Component:** Write a React component (`HireAgent.tsx`) that generates an ERC-7715 Session Key (Target = `AegisModule` address, Budget = 2 ETH) and exports the credentials.
- [ ] 6.4 **The Debug Loop:** Run the Next.js dev server. Test module installation and key issuance. 
- [ ] **[CHECKPOINT 6]** Execute `git commit -m "feat(ui): implement module installation and session key issuance"`. Proceed immediately to the next phase.

---

## Phase 7: Documentation & Finalization (The VC Polish)
*Context: We are finalizing the repository so it tells a perfect, coherent story to hackathon judges and future employers.*

- [ ] 7.1 **Generate Architecture Docs:** Create `docs/ERC7579_ROADMAP.md` using the exact structure and Mermaid diagrams agreed upon in our architectural planning.
- [ ] 7.2 **Update README.md:** Overwrite the default README. Add the "Corporate Bank Account" analogy, detail the 7-step JIT execution loop, and link to `docs/ERC7579_ROADMAP.md`.
- [ ] 7.3 **Finalize Lessons Learned:** Clean up `docs/lessons_learned.md`. Format it so it reads like a professional engineering post-mortem.
- [ ] 7.4 **Cleanup:** Run a final `forge clean`, format the Solidity with `forge fmt`, and format the TypeScript with `prettier`.
- [ ] **[FINAL CHECKPOINT]** Execute `git add .` and `git commit -m "docs: finalize Aegis V4 repository for production release"`. You have completed the master plan.