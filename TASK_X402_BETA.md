# 🧪 TASK_X402_BETA.md: Autonomous Agent Monetization (x402)

## 🤖 AGENT DIRECTIVES (CRITICAL)
* **LIVE TESTING ONLY:** Zero mocking allowed. Every test must execute a live HTTP request and a live gasless USDC transfer on Base Sepolia.
* **VERSION CONTROL:** You are strictly forbidden from executing `git merge` or opening a PR. Commit and push to `feature/x402-monetization` only. The human operator will handle the merge.
* **STRICT TDD:** Write the failing test against the live Base Sepolia network first. Watch it fail. Implement the code. Watch it pass.

## Phase 1: Environment & Dependency Setup
* [ ] Checkout a new branch: `feature/x402-monetization`.
* [ ] Install required x402 and Base SDKs (e.g., standard x402 server headers, viem).
* [ ] Create the primary test file: `test/x402/OracleMonetizationLive.test.ts`.

## Phase 2: The x402 Payment Handshake (Server-Side)
*Goal: Expose the Heimdall/CRE threat intelligence as a paid endpoint.*
* [ ] Write a failing test: `test_LiveEndpoint_ReturnsHTTP402_WithoutPayment()`.
* [ ] Implement a new Next.js API route: `app/api/oracle/audit/route.ts`.
* [ ] Configure the route to intercept incoming AI requests. If the request lacks an `X-PAYMENT` header, return an HTTP `402 Payment Required` status code.
* [ ] Include the payment payload in the 402 response: Price (`0.05 USDC`), supported network (`Base Sepolia`), and the facilitator endpoint.
* [ ] Run the live test against your local server until green.

## Phase 3: Facilitator Verification & Settlement
*Goal: Verify the on-chain payment before releasing the audit data.*
* [ ] Write a failing test: `test_LiveEndpoint_Returns200_WithValidSignedPayment()`.
* [ ] Implement the payment verification logic. When a request arrives with an `X-PAYMENT` header, send the signature payload to the x402 facilitator to confirm the USDC transfer on Base Sepolia.
* [ ] Once confirmed, programmatically trigger the Chainlink CRE pipeline (GPT-4o + Llama-3).
* [ ] Return the 8-bit risk mask and JSON analysis in a `200 OK` response.
* [ ] Assert that the USDC balance of the dev treasury increases on Base Sepolia. 
* [ ] Run the test until green.

## Phase 4: Commit and Push
* [ ] Verify 100% of live integration tests pass.
* [ ] Execute `git commit -m "feat: implement live x402 protocol for agent-to-agent CRE monetization"`.
* [ ] Execute `git push origin feature/x402-monetization`.