/**
 * ═══════════════════════════════════════════════════════════════
 * AEGIS V5 Agent Bot — ERC-4337 via Pimlico Cloud Bundler
 * ═══════════════════════════════════════════════════════════════
 *
 * Uses `smartAccountClient.sendUserOperation` to submit operations
 * through Pimlico's hosted bundler on Base Sepolia.
 *
 * All manual handleOps / PackedUserOperation encoding is GONE.
 * Pimlico handles gas estimation, signature validation, and
 * EntryPoint submission automatically.
 */

import {
    createPublicClient,
    http,
    getAddress,
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

import {
    buildV5RequestAuditCall,
    buildV5TriggerSwapCall,
} from "../../scripts/v5_bot_config";

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_BUNDLER_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

async function main() {
    // ── Environment ──────────────────────────────────────────────────────
    const agentPk = process.env.AGENT_PRIVATE_KEY as Hex;
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    const moduleAddress = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;
    const targetToken = getAddress(process.env.TARGET_TOKEN_ADDRESS!) as Address;
    const safeAddress = process.env.SAFE_ADDRESS ? getAddress(process.env.SAFE_ADDRESS) : undefined;

    if (!agentPk || !ownerPk || !moduleAddress || !targetToken) {
        console.error("❌ Missing required env vars: AGENT_PRIVATE_KEY, PRIVATE_KEY, AEGIS_MODULE_ADDRESS, TARGET_TOKEN_ADDRESS");
        process.exit(1);
    }
    if (!PIMLICO_API_KEY) {
        console.error("❌ Missing PIMLICO_API_KEY");
        process.exit(1);
    }

    // ── Clients ──────────────────────────────────────────────────────────
    const owner = privateKeyToAccount(ownerPk);
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_BUNDLER_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    // ── Safe Smart Account ───────────────────────────────────────────────
    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        ...(safeAddress ? { address: safeAddress as Address } : {}),
    });

    console.log(`🛡️  Safe Account: ${safeAccount.address}`);

    // ── Smart Account Client (Pimlico bundler) ───────────────────────────
    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_BUNDLER_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    console.log(`🤖 Agent bot initialized on Base Sepolia`);
    console.log(`   Module: ${moduleAddress}`);
    console.log(`   Token:  ${targetToken}`);

    // ══════════════════════════════════════════════════════════════════════
    //  STEP 1: Request Audit via UserOp
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n━━━ STEP 1: requestAudit via UserOp ━━━");

    const auditCall = buildV5RequestAuditCall(moduleAddress, targetToken);
    const auditHash = await smartAccountClient.sendUserOperation({
        calls: [auditCall],
    });
    console.log(`[STEP 1] ✅ UserOp submitted: ${auditHash}`);

    const auditReceipt = await pimlicoClient.waitForUserOperationReceipt({
        hash: auditHash,
    });
    console.log(`[STEP 1] ✅ Mined in block ${auditReceipt.receipt.blockNumber}`);
    console.log(`[STEP 1] 📡 AuditRequested event emitted — waiting for oracle clearance...`);

    // ══════════════════════════════════════════════════════════════════════
    //  STEP 2: Wait for Oracle Clearance
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n━━━ STEP 2: Polling for oracle clearance ━━━");

    const MODULE_ABI = [{
        name: "isApproved",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "token", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    }] as const;

    let cleared = false;
    for (let i = 0; i < 60; i++) {
        cleared = await publicClient.readContract({
            address: moduleAddress,
            abi: MODULE_ABI,
            functionName: "isApproved",
            args: [targetToken],
        });
        if (cleared) break;
        console.log(`[STEP 2] ⏳ Poll ${i + 1}/60 — not cleared yet...`);
        await new Promise((r) => setTimeout(r, 5000)); // 5s intervals
    }

    if (!cleared) {
        console.error("[STEP 2] ❌ Oracle did not clear token within 5 minutes");
        process.exit(1);
    }
    console.log(`[STEP 2] 🔓 Token CLEARED by oracle!`);

    // ══════════════════════════════════════════════════════════════════════
    //  STEP 3: Trigger Swap via UserOp
    // ══════════════════════════════════════════════════════════════════════
    console.log("\n━━━ STEP 3: triggerSwap via UserOp ━━━");

    const swapCall = buildV5TriggerSwapCall(
        moduleAddress,
        targetToken,
        BigInt(10000000000000000), // 0.01 ETH
    );

    const swapHash = await smartAccountClient.sendUserOperation({
        calls: [swapCall],
    });
    console.log(`[STEP 3] ✅ UserOp submitted: ${swapHash}`);

    const swapReceipt = await pimlicoClient.waitForUserOperationReceipt({
        hash: swapHash,
    });
    console.log(`[STEP 3] 🎉 Swap executed in block ${swapReceipt.receipt.blockNumber}`);

    // ── Done ─────────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  ✅ AEGIS V5 AGENT BOT — COMPLETE");
    console.log("  All operations submitted via Pimlico Cloud Bundler");
    console.log("  Full ERC-4337 compliance on Base Sepolia");
    console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
    console.error("💥 Bot fatal:", err.message);
    process.exit(1);
});
