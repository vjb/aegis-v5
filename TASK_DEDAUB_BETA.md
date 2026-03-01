TASK_DEDAUB_BETA.md: Experimental Bytecode Decompilation Branch
🤖 Agent Directives (CRITICAL INSTRUCTIONS)
Read these rules before writing a single line of code. You are operating autonomously on an experimental beta branch.

Strict TDD (Red-Green-Refactor): You must write the test first. Run it. Watch it fail. Only then may you write the implementation code.

No Mocking in Integration: Unit tests may mock the HTTP boundaries, but the final integration script must execute the real end-to-end pipeline using live API keys.

Break Problems Down: If an API call fails or a WASM constraint is hit, do not attempt to fix the entire pipeline at once. Isolate the failing function, write a localized test for it, and solve the micro-problem.

Think Freshly: If you attempt a solution three times and it continues to fail, discard the approach. Step back, re-read the Dedaub API documentation or Chainlink CRE constraints, and conceptualize a new path.

Logging: Implement verbose logging ([DEDAUB_BETA]) at every HTTP boundary so the human operator can trace the exact point of failure upon review.

Phase 1: Environment & TDD Setup
Goal: Initialize the beta branch, configure the environment, and establish the testing baseline.

[ ] Create and checkout a new branch: feature/dedaub-bytecode-decompilation.

[ ] Verify DEDAUB_API_KEY is loaded into the test environment and the .env parsing logic.

[ ] Create a new test file: test/cre/DedaubService.test.ts (or equivalent for your testing framework).

Phase 2: Dedaub API Integration via Confidential HTTP
Goal: Securely send raw bytecode to the Dedaub API and retrieve the decompiled source code from within the Chainlink CRE.

[ ] Write a failing test: test_Dedaub_SubmitBytecode_ReturnsDecompiledString().

[ ] Write a failing test: test_Dedaub_HandlesApiErrors_Gracefully().

[ ] Implement DedaubClient.ts. It must use the Chainlink ConfidentialHTTPClient (or your local equivalent for testing) to securely pass the DEDAUB_API_KEY in the headers.

[ ] Implement the HTTP POST request to submit 0x prefixed EVM bytecode to Dedaub's decompilation endpoint.

[ ] Implement the polling/retrieval logic if Dedaub processes decompilation asynchronously.

[ ] Run tests and refactor until green.

Phase 3: The Pipeline Pivot (Fallback Logic)
Goal: Modify the existing CRE workflow to use Dedaub when BaseScan fails to provide verified source code.

[ ] Write a failing test: test_Pipeline_UsesBaseScan_IfContractIsVerified().

[ ] Write a failing test: test_Pipeline_FallsBackToDedaub_IfContractIsUnverified().

[ ] Implement a bytecode fetcher using a standard RPC call (eth_getCode) for the target address.

[ ] Update the CRE entrypoint workflow:

Attempt BaseScan source code retrieval.

If result is "Unverified", fetch raw bytecode via RPC.

Pass raw bytecode to DedaubClient.

Return the decompiled Solidity-like output.

[ ] Run tests and refactor until green.

Phase 4: LLM Prompt Engineering for Decompiled Code
Goal: Ensure GPT-4o and Llama-3 can accurately parse Dedaub's specific decompiled syntax.

[ ] Write a failing test: test_LLM_ParsesDecompiledLogicBomb_Successfully().

[ ] Update the system prompts for both LLMs. Decompiled code lacks original variable names and comments. Instruct the LLMs to look for specific EVM opcode patterns, suspicious CALL structures, or hardcoded timestamp locks standard in decompiled output.

[ ] Feed a known malicious decompiled payload into the dual-LLM pipeline and assert that the "Union of Fears" consensus accurately flags the risk.

[ ] Run tests and refactor until green.

Phase 5: The Live End-to-End Demo Script
Goal: Create a standalone script to prove the entire experimental pipeline works live on Base Sepolia.

[ ] Create a new script: scripts/demo_v5_dedaub_experimental.ts (or .ps1).

[ ] The script must target a known unverified smart contract on Base Sepolia (deploy a simple unverified honeypot if necessary).

[ ] The script must execute the full Chainlink CRE pipeline, outputting the live logs to the terminal.

[ ] Assert the terminal outputs: [BaseScan] Unverified Contract Detected.

[ ] Assert the terminal outputs: [Dedaub] Decompiling Bytecode....

[ ] Assert the terminal outputs: [LLM Consensus] Evaluating Decompiled Source....


[ ] Assert the final 8-bit risk code is successfully returned and formatted.