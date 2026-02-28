/**
 * ═══════════════════════════════════════════════════════════════
 * V5 Setup Safe — Deploy Safe + Install AegisModule (Pimlico)
 * ═══════════════════════════════════════════════════════════════
 *
 * Deploys a Safe Smart Account on Base Sepolia and installs
 * AegisModule as an ERC-7579 Executor module, using Pimlico's
 * hosted bundler for all UserOp handling.
 *
 * Usage:
 *   pnpm ts-node --transpile-only scripts/v5_setup_safe.ts
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    getAddress,
    encodeFunctionData,
    type Address,
    type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import {
    createPimlicoClient,
} from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_BUNDLER_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

async function main() {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    const moduleAddress = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;

    if (!ownerPk || !moduleAddress) {
        console.error("❌ Missing PRIVATE_KEY or AEGIS_MODULE_ADDRESS in .env");
        process.exit(1);
    }
    if (!PIMLICO_API_KEY) {
        console.error("❌ Missing PIMLICO_API_KEY in .env");
        process.exit(1);
    }

    const owner = privateKeyToAccount(ownerPk);

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  🛡️  AEGIS V5 — Safe Setup (Pimlico on Base Sepolia)");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Owner:  ${owner.address}`);
    console.log(`  Module: ${moduleAddress}`);
    console.log(`  RPC:    ${RPC_URL}`);
    console.log("");

    // ── Clients ──────────────────────────────────────────────────────────
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_BUNDLER_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    // ── Create Safe Smart Account ────────────────────────────────────────
    console.log("[SETUP] Creating Safe Smart Account...");

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        saltNonce: BigInt(Date.now()),
    });

    console.log(`[SETUP] Safe (counterfactual): ${safeAccount.address}`);

    // ── Smart Account Client (Pimlico handles everything) ────────────────
    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_BUNDLER_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    // ── Deploy Safe + call onInstall on AegisModule ──────────────────────
    console.log("[SETUP] Deploying Safe via first UserOp (initCode)...");

    // The first UserOp will include the Safe's initCode, deploying the proxy.
    // We call AegisModule.onInstall() as the initial action.
    const installCallData = encodeFunctionData({
        abi: [{ name: "onInstall", type: "function", inputs: [{ name: "data", type: "bytes" }], outputs: [], stateMutability: "nonpayable" }],
        functionName: "onInstall",
        args: ["0x"],
    });

    const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [{
            to: moduleAddress,
            data: installCallData,
            value: 0n,
        }],
    });

    console.log(`[SETUP] UserOp submitted: ${userOpHash}`);

    const receipt = await pimlicoClient.waitForUserOperationReceipt({
        hash: userOpHash,
    });

    console.log(`[SETUP] ✅ Safe deployed in block ${receipt.receipt.blockNumber}`);
    console.log(`[SETUP] ✅ Tx hash: ${receipt.receipt.transactionHash}`);

    // ── Verify ───────────────────────────────────────────────────────────
    const safeCode = await publicClient.getCode({ address: safeAccount.address });
    console.log(`[SETUP] Safe bytecode: ${safeCode?.length ?? 0} chars`);

    // ── Output ───────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  ✅ SAFE DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  SAFE_ADDRESS=${safeAccount.address}`);
    console.log(`  Add this to your .env file.`);
    console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
    console.error("💥 Setup failed:", err.message);
    process.exit(1);
});
