# Local Pimlico/Alto Bundler Deployment Issues

This document summarizes the exact EVM execution and validation roadblocks encountered when attempting to use a local Docker instance of the Pimlico `alto` bundler (ERC-4337) to provision a Safe Smart Account on a Tenderly Virtual TestNet.

## 1. Aggressive Simulation Rejection (`AA21 didn't pay prefund`)
The most persistent issue is the bundler instantly rejecting UserOperations with the `AA21 didn't pay prefund` error during the `eth_estimateUserOperationGas` simulation phase. 

- **Root Cause:** When the bundler simulates the UserOp to estimate gas, it uses a dummy signature. The `Safe4337Module` explicitly bails out of `validateUserOp` if the signature is invalid, skipping the required EntryPoint prefund payment.
- **Why it's a problem:** `alto` enforces extremely strict simulation rules. Because the prefund isn't paid during estimation, the node rejects the simulation outright instead of mapping the gas usage.
- **Attempted Fixes:** We tried injecting massive dummy gas limits (`callGasLimit: 2M`, `verificationGasLimit: 4M`) directly into the `viem` smart account properties to bypass the bundler's estimation RPC call. While the client sent the UserOp, the bundler still rejected it on arrival during its own mandatory pre-flight validation.

## 2. ECDSA Domain Separator Mismatch
The `permissionless.js` client generates ECDSA signatures based on the EIP-712 domain separator, which relies heavily on the `chainId`.

- **Root Cause:** Tenderly VNets generate randomized chain IDs (e.g., `73578453`) to prevent replay attacks. However, our scripts and `.env` initially assumed the Base Sepolia chain ID (`84532`) because the VNet was forked from it.
- **Why it's a problem:** The client signed the UserOp payload with chain ID `84532`. When the transaction reached the Tenderly EVM (chain ID `73578453`), the `Safe4337Module` recovered the wrong signer from the hash and instantly reverted. This was completely swallowed by the bundler's generic `AA21` error until we traced it manually.

## 3. Factory Initialization Gas Starvation (`AA13 initCode failed or OOG`)
To bypass the bundler's obfuscated errors, we wrote a manual script (`debug_manual_bundler.ts`) to act as the bundler and submit the `EntryPoint.handleOps()` transaction directly to the chain. 

- **Root Cause:** Upon successful signature decoding, the EntryPoint attempted to deploy the Safe proxy using the provided `initCode` (the proxy factory data). This execution reverted with `AA13 initCode failed or OOG`.
- **Why it's a problem:** Deploying a Safe 1.4.1 proxy and simultaneously installing ERC-7579 executor modules requires a complex "Launchpad" registry setup. The factory proxy initialization executes this heavy fallback handler mapping within its constructor. The default `verificationGasLimit` provided by `permissionless` (and even our manual 10,000,000 gas overrides) was insufficient for the `alto` node's simulation boundaries for factory instantiation, resulting in an Out-of-Gas revert before the module could be installed.

## 4. FINAL ROOT CAUSE: Tenderly VNets Don't Support `debug_traceCall` (Required by Alto)

After fixing all of the above issues (correct addresses, chain ID, gas estimation, prefunding), the deployment fails at the **RPC protocol level**. 

- **Root Cause:** When Alto's `eth_sendUserOperation` receives a UserOp, it performs ERC-4337 opcode banning validation by calling `debug_traceCall` against the connected RPC node with a custom JavaScript tracer script. Tenderly Virtual TestNets do **not** support the `debug_traceCall` RPC method, returning `"not supported"`.
- **Why it's a problem:** This is not a bypassable configuration issue. The `debug_traceCall` with custom JS tracer is how Alto enforces the ERC-4337 simulation rules (storage access restrictions, banned opcodes like `SELFDESTRUCT`, etc.). Without it, Alto cannot validate UserOperations at all.
- **Implication:** Alto bundler is **fundamentally incompatible** with Tenderly Virtual TestNets. This is an infrastructure-level limitation.

## Conclusion

The combination of:
1. **Wrong Safe addresses** — Our script overrode `safeSingletonAddress` with SafeL2 (`0x29fcB43b`) instead of letting `permissionless.js` use its correct default (`0x41675C09`). All 6 default addresses were confirmed present on the VNet.
2. **Randomized chain IDs** — Tenderly VNets generate random chain IDs (`73578453`) causing EIP-712 signature domain separator mismatches.
3. **`debug_traceCall` not supported** — Alto requires `debug_traceCall` with a JavaScript tracer for opcode banning checks, which Tenderly VNets do not expose.

Issues 1 and 2 have been fixed. Issue 3 is **unfixable** — it's an infrastructure incompatibility between Alto and Tenderly.

### Recommended Path Forward

- **Option A:** Deploy on **Base Sepolia** using Pimlico's hosted bundler (all infrastructure already exists).
- **Option B:** Use `anvil` (local Foundry node) instead of Tenderly for the ERC-4337 flow. Anvil supports `debug_traceCall`.
- **Option C:** Skip the bundler entirely and submit `handleOps()` directly to the EntryPoint using a standard transaction from the owner wallet (lose ERC-4337 compliance but functional for demo).
