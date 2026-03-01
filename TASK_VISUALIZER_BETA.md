# 🧪 TASK_VISUALIZER_BETA.md: CRE Execution Node Visualizer

## 🤖 AGENT DIRECTIVES (CRITICAL)
* **TESTING:** All UI logic must be tested via React Testing Library and Jest. Connection endpoints must use live Server-Sent Events (SSE). No mocks for the data stream.
* **VERSION CONTROL:** You are strictly forbidden from executing `git merge`. Commit and push to `feature/react-flow-visualizer` only.
* **STRICT TDD:** Write the failing UI render test first. Implement the component. Watch it pass.

## Phase 1: Environment & Dependency Setup
* [ ] Checkout a new branch: `feature/react-flow-visualizer`.
* [ ] Install `@xyflow/react` (React Flow) and any required animation libraries (e.g., `framer-motion`).
* [ ] Create the primary test file: `__tests__/components/ConsensusVisualizer.test.tsx`.

## Phase 2: Static Node Architecture (React Flow)
*Goal: Build the visual map of the Account Abstraction to Chainlink pipeline.*
* [ ] Write a failing test: `test_Visualizer_RendersAllCoreNodes()`.
* [ ] Create a new Next.js client component: `components/ConsensusVisualizer.tsx`.
* [ ] Implement the React Flow canvas with custom nodes:
  * Node 1: User / Safe Smart Account (ERC-4337)
  * Node 2: Pimlico Bundler
  * Node 3: Chainlink DON (WASM Enclave)
  * Node 4A: GPT-4o
  * Node 4B: Llama-3
  * Node 5: AegisModule (ERC-7579 Firewall)
* [ ] Implement default animated edges connecting the nodes in sequential order.
* [ ] Run the Jest test until green.

## Phase 3: Live Event Streaming Integration
*Goal: Animate the edges based on live off-chain execution data.*
* [ ] Write a failing test: `test_Visualizer_AnimatesPath_OnLiveSSEEvent()`.
* [ ] Connect `ConsensusVisualizer.tsx` to the live SSE stream outputting from the CRE execution logs.
* [ ] Implement state updates: 
  * When `AuditRequested` fires, animate the edge from Node 1 -> Node 2 -> Node 3.
  * When CRE spins up the models, animate parallel edges from Node 3 to Nodes 4A and 4B.
  * When consensus is reached, color the final edge to Node 5 Green (Cleared) or Red (Blocked).
* [ ] Run the test against a live SSE trigger until green.

## Phase 4: Commit and Push
* [ ] Verify all UI tests pass.
* [ ] Execute `git commit -m "feat: build live React Flow CRE consensus visualizer"`.
* [ ] Execute `git push origin feature/react-flow-visualizer`.