🤖 AGENT DIRECTIVES (CRITICAL - READ FIRST)
You are operating autonomously on an experimental beta branch. You must adhere strictly to the following execution rules:

LIVE TESTING ONLY (ZERO MOCKING): You are strictly forbidden from using mocks, stubs, or simulated network responses in any test. Every single test must execute a live RPC call to the Base Sepolia testnet or a live HTTP request to the local API. If a test passes, it must be because it succeeded on real infrastructure.

VERSION CONTROL PROTOCOL: You are strictly forbidden from executing git merge or opening a pull request. Your sole version control capability is to git commit your passing code and git push to the origin beta branch. The human operator will handle all code reviews and merges.

STRICT TDD: Write the live test first. Watch it fail against the live network. Write the implementation. Watch it pass.

Phase 1: Environment & Branch Setup
Goal: Initialize the sandboxed environment and establish the testing baseline.


[ ] Install the Heimdall EVM toolkit locally (e.g., via heimdall-rs CLI or heimdall-py bindings).

[ ] Initialize a lightweight local web server framework (e.g., Express.js or FastAPI) in a new services/decompiler directory.

[ ] Create the primary test file: test/cre/HeimdallLive.test.ts (or equivalent).

Phase 2: The Local Heimdall Microservice
Goal: Build a local API endpoint that accepts raw EVM bytecode, runs Heimdall natively, and returns decompiled Solidity logic.

[ ] Write a failing test: test_LiveHeimdall_Endpoint_ReturnsDecompiledLogic_ForKnownBytecode().

[ ] Implement a local POST endpoint (e.g., http://localhost:8080/decompile).

[ ] Implement the server logic to receive a 0x prefixed bytecode payload.

[ ] Execute Heimdall as a subprocess or via bindings to decompile the received bytecode.

[ ] Format Heimdall's output (AST/Solidity-like code) into a clean JSON response.

[ ] Run the test against the live local server until green.

Phase 3: The Live Base Sepolia Pipeline
Goal: Integrate the local Heimdall microservice into the Chainlink CRE fallback workflow using live RPC calls.

[ ] Write a failing test: test_LivePipeline_FetchesBytecodeFromBaseSepolia_AndDecompiles().

[ ] Hardcode a known unverified smart contract address on Base Sepolia into the test environment.

[ ] Implement logic in the CRE entrypoint to query the BaseScan API for source code verification status.

[ ] If unverified, implement a live eth_getCode RPC call to Base Sepolia to fetch the raw contract bytecode.

[ ] Route that live bytecode to your local http://localhost:8080/decompile endpoint via Confidential HTTP.

[ ] Assert that the returned payload contains readable decompiled logic.

[ ] Run the test against the live testnet until green.

Phase 4: LLM Consensus Integration
Goal: Prove the LLMs can accurately parse Heimdall's specific decompiled output structure to detect vulnerabilities.

[ ] Write a failing test: test_LiveLLM_DetectsLogicBomb_InHeimdallOutput().

[ ] Update the GPT-4o and Llama-3 system prompts to optimize for Heimdall's syntax (e.g., lack of original variable names, specific CALL opcode structures).

[ ] Execute the full pipeline: Fetch live unverified honeypot bytecode -> Heimdall decompilation -> Dual-LLM analysis.

[ ] Assert that the final consensus returns the correct 8-bit risk mask (flagging the contract as malicious).

[ ] Run the live integration test until green.

Phase 5: Commit and Push (No Merging)
Goal: Securely push the verified, passing experimental code back to the repository.

[ ] Verify 100% of the live tests pass.

[ ] Stage all modified and new files.

[ ] Execute git commit -m "feat: complete live Heimdall decompilation microservice with TDD".

[ ] Execute git push 

[ ] Log a success message to the terminal and gracefully exit the agent loop.
