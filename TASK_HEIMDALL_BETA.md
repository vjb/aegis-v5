🤖 AGENT DIRECTIVES (CRITICAL - READ FIRST)
You are operating autonomously on an experimental beta branch. You must adhere strictly to the following execution rules:

LIVE TESTING ONLY (ZERO MOCKING): You are strictly forbidden from using mocks, stubs, or simulated network responses in any test. Every single test must execute a live RPC call to the Base Sepolia testnet or a live HTTP request to the local API. If a test passes, it must be because it succeeded on real infrastructure.

VERSION CONTROL PROTOCOL: You are strictly forbidden from executing git merge or opening a pull request. Your sole version control capability is to git commit your passing code and git push to the origin beta branch. The human operator will handle all code reviews and merges.

STRICT TDD: Write the live test first. Watch it fail against the live network. Write the implementation. Watch it pass.

Phase 1: Environment & Branch Setup ✅
Goal: Initialize the sandboxed environment and establish the testing baseline.

[x] Install the Heimdall EVM toolkit locally (e.g., via heimdall-rs CLI or heimdall-py bindings).
[x] Initialize a lightweight local web server framework (e.g., Express.js or FastAPI) in a new services/decompiler directory.
[x] Create the primary test file: test/cre/HeimdallLive.spec.ts (or equivalent).

Phase 2: The Local Heimdall Microservice ✅
Goal: Build a local API endpoint that accepts raw EVM bytecode, runs Heimdall natively, and returns decompiled Solidity logic.

[x] Write a failing test: test_LiveHeimdall_Endpoint_ReturnsDecompiledLogic_ForKnownBytecode().
[x] Implement a local POST endpoint (e.g., http://localhost:8080/decompile).
[x] Implement the server logic to receive a 0x prefixed bytecode payload.
[x] Execute Heimdall as a subprocess or via bindings to decompile the received bytecode.
[x] Format Heimdall's output (AST/Solidity-like code) into a clean JSON response.
[x] Run the test against the live local server until green.

Phase 3: The Live Base Sepolia Pipeline ✅
Goal: Integrate the local Heimdall microservice into the Chainlink CRE fallback workflow using live RPC calls.

[x] Write a failing test: test_LivePipeline_FetchesBytecodeFromBaseSepolia_AndDecompiles().
[x] Hardcode a known unverified smart contract address on Base Sepolia into the test environment.
[x] Implement logic in the CRE entrypoint to query the BaseScan API for source code verification status.
[x] If unverified, implement a live eth_getCode RPC call to Base Sepolia to fetch the raw contract bytecode.
[x] Route that live bytecode to your local http://localhost:8080/decompile endpoint via Confidential HTTP.
[x] Assert that the returned payload contains readable decompiled logic.
[x] Run the test against the live testnet until green.

Phase 4: LLM Consensus Integration ✅
Goal: Prove the LLMs can accurately parse Heimdall's specific decompiled output structure to detect vulnerabilities.

[x] Write a failing test: test_LiveLLM_DetectsLogicBomb_InHeimdallOutput().
[x] Update the GPT-4o and Llama-3 system prompts to optimize for Heimdall's syntax (e.g., lack of original variable names, specific CALL opcode structures).
[x] Execute the full pipeline: Fetch live unverified honeypot bytecode -> Heimdall decompilation -> Dual-LLM analysis.
[x] Assert that the final consensus returns the correct 8-bit risk mask (flagging the contract as malicious).
[x] Run the live integration test until green.

Phase 5: Commit and Push (No Merging) ✅
Goal: Securely push the verified, passing experimental code back to the repository.

[x] Verify 100% of the live tests pass.
[x] Stage all modified and new files.
[x] Execute git commit -m "feat: complete live Heimdall decompilation microservice with TDD".
[x] Execute git push 
[x] Log a success message to the terminal and gracefully exit the agent loop.

---

## Additional: Frontend Integration (Session 2026-03-01) ✅

[x] Heimdall status indicator in header (purple dot)
[x] /api/decompile API route for on-demand bytecode decompilation
[x] Heimdall phase detection in audit SSE pipeline ([Heimdall] log parsing)
[x] OracleFeed renders "Heimdall — Bytecode Decompilation" phase with purple styling
[x] AegisChat "decompile" intent detection + UnverifiedDoge suggestion chip
[x] Chat system prompt includes Heimdall pipeline knowledge
[x] Premium CSS: heimdall-glow animation, verdict-approved/blocked effects
[x] README: Frontend Dashboard section + Heimdall in Security Loop Step 2
