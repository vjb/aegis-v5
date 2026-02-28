/**
 * ═══════════════════════════════════════════════════════════════
 * V5 E2E Mock Test — Full UserOp Flow via Pimlico on Base Sepolia
 * ═══════════════════════════════════════════════════════════════
 *
 * Exercises the complete AEGIS V5 architecture:
 *   1. Deploy Safe via Pimlico (auto-initCode)
 *   2. Fund module treasury + subscribe Safe as agent
 *   3. requestAudit via UserOp
 *   4. Mock oracle callback (owner calls onReportDirect)
 *   5. triggerSwap via UserOp
 *
 * Usage:
 *   pnpm ts-node --transpile-only scripts/v5_e2e_mock.ts
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    getAddress,
    encodeFunctionData,
    nonceManager,
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

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const AEGIS_MODULE_ABI = [
    {
        name: "requestAudit", type: "function", stateMutability: "nonpayable",
        inputs: [{ name: "_token", type: "address" }],
        outputs: [{ name: "tradeId", type: "uint256" }]
    },
    {
        name: "triggerSwap", type: "function", stateMutability: "nonpayable",
        inputs: [
            { name: "_token", type: "address" },
            { name: "_amountIn", type: "uint256" },
            { name: "_amountOutMinimum", type: "uint256" },
        ], outputs: []
    },
    {
        name: "subscribeAgent", type: "function", stateMutability: "nonpayable",
        inputs: [
            { name: "_agent", type: "address" },
            { name: "_budget", type: "uint256" },
        ], outputs: []
    },
    {
        name: "onReportDirect", type: "function", stateMutability: "nonpayable",
        inputs: [
            { name: "tradeId", type: "uint256" },
            { name: "riskScore", type: "uint256" },
        ], outputs: []
    },
    {
        name: "isApproved", type: "function", stateMutability: "view",
        inputs: [{ name: "token", type: "address" }],
        outputs: [{ name: "", type: "bool" }]
    },
    {
        name: "getTreasuryBalance", type: "function", stateMutability: "view",
        inputs: [], outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "agentAllowances", type: "function", stateMutability: "view",
        inputs: [{ name: "agent", type: "address" }],
        outputs: [{ name: "", type: "uint256" }]
    },
] as const;

const AUDIT_REQUESTED_EVENT = {
    type: "event" as const,
    name: "AuditRequested",
    inputs: [
        { name: "tradeId", type: "uint256", indexed: true },
        { name: "user", type: "address", indexed: true },
        { name: "targetToken", type: "address", indexed: true },
        { name: "firewallConfig", type: "string", indexed: false },
    ],
};

// ─── Constants ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

async function main() {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    const moduleAddress = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;
    const TARGET_TOKEN = getAddress(process.env.TARGET_TOKEN_ADDRESS!) as Address;

    if (!ownerPk || !moduleAddress || !TARGET_TOKEN || !PIMLICO_API_KEY) {
        console.error("❌ Missing env vars: PRIVATE_KEY, AEGIS_MODULE_ADDRESS, TARGET_TOKEN_ADDRESS, PIMLICO_API_KEY");
        process.exit(1);
    }

    const owner = privateKeyToAccount(ownerPk);
    // Add nonceManager to prevent nonce race conditions on real testnets
    owner.nonceManager = nonceManager;
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account: owner, chain: baseSepolia, transport: http(RPC_URL) });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🧪 AEGIS V5 E2E MOCK — Pimlico on Base Sepolia");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Owner:  ${owner.address}`);
    console.log(`  Module: ${moduleAddress}`);
    console.log(`  Token:  ${TARGET_TOKEN}`);
    console.log("");

    // ── Phase 1: Deploy Safe ─────────────────────────────────────────────
    console.log("━━━ PHASE 1: Deploy Safe Smart Account ━━━");

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        saltNonce: BigInt(Date.now()),
    });

    console.log(`[PHASE 1] Safe: ${safeAccount.address}`);

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    // Deploy via first UserOp (Pimlico handles initCode automatically)
    const deployHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: moduleAddress, data: "0x", value: 0n }],
    });
    const deployReceipt = await pimlicoClient.waitForUserOperationReceipt({ hash: deployHash });
    console.log(`[PHASE 1] ✅ Safe deployed: ${deployReceipt.receipt.transactionHash}`);

    // ── Phase 2: Fund module + subscribe agent ───────────────────────────
    console.log("\n━━━ PHASE 2: Treasury Setup ━━━");

    const depositHash = await walletClient.sendTransaction({
        to: moduleAddress, value: parseEther("0.005"),
    });
    await publicClient.waitForTransactionReceipt({ hash: depositHash });
    console.log(`[PHASE 2] ✅ Deposited 0.005 ETH`);

    const subscribeHash = await walletClient.writeContract({
        address: moduleAddress,
        abi: AEGIS_MODULE_ABI,
        functionName: "subscribeAgent",
        args: [safeAccount.address, parseEther("0.002")],
    });
    await publicClient.waitForTransactionReceipt({ hash: subscribeHash });
    console.log(`[PHASE 2] ✅ Safe subscribed as agent (0.002 ETH budget)`);

    // ── Phase 3: requestAudit (owner EOA call) ────────────────────────────
    console.log("\n━━━ PHASE 3: requestAudit (owner EOA) ━━━");

    // Note: requestAudit works via UserOp too, but for the demo we use the owner
    // EOA to keep it simple. The critical AA path is triggerSwap in Phase 5.
    const auditHash = await walletClient.writeContract({
        address: moduleAddress,
        abi: AEGIS_MODULE_ABI,
        functionName: "requestAudit",
        args: [TARGET_TOKEN],
    });
    const auditReceipt = await publicClient.waitForTransactionReceipt({ hash: auditHash });
    console.log(`[PHASE 3] ✅ requestAudit tx: ${auditReceipt.transactionHash}`);

    // Extract tradeId from receipt logs (topic[1] = indexed tradeId)
    const auditLog = auditReceipt.logs.find(
        (log) => log.address.toLowerCase() === moduleAddress.toLowerCase()
    );
    const tradeId = auditLog ? BigInt(auditLog.topics[1]!) : undefined;
    console.log(`[PHASE 3] 📡 tradeId: ${tradeId}`);

    if (tradeId === undefined) {
        console.error("[PHASE 3] ❌ No AuditRequested event");
        process.exit(1);
    }

    // ── Phase 4: Mock Oracle ─────────────────────────────────────────────
    console.log("\n━━━ PHASE 4: Mock Oracle (onReportDirect) ━━━");

    const reportHash = await walletClient.writeContract({
        address: moduleAddress,
        abi: AEGIS_MODULE_ABI,
        functionName: "onReportDirect",
        args: [tradeId, 0n],
    });
    await publicClient.waitForTransactionReceipt({ hash: reportHash });
    console.log(`[PHASE 4] ✅ Oracle: riskScore=0 → APPROVED`);

    // Poll isApproved until true (Base Sepolia public RPC has state propagation lag)
    let cleared = false;
    for (let i = 0; i < 10; i++) {
        cleared = await publicClient.readContract({
            address: moduleAddress,
            abi: AEGIS_MODULE_ABI,
            functionName: "isApproved",
            args: [TARGET_TOKEN],
        }) as boolean;
        if (cleared) break;
        console.log(`[PHASE 4] ⏳ Waiting for state propagation (${i + 1}/10)...`);
        await new Promise((r) => setTimeout(r, 3000));
    }
    console.log(`[PHASE 4] 🔓 isApproved: ${cleared}`);

    if (!cleared) {
        console.error("[PHASE 4] ❌ Token not cleared — oracle callback may have failed");
        process.exit(1);
    }

    // ── Phase 5: triggerSwap via UserOp ───────────────────────────────────
    console.log("\n━━━ PHASE 5: triggerSwap via UserOp ━━━");

    const swapData = encodeFunctionData({
        abi: AEGIS_MODULE_ABI,
        functionName: "triggerSwap",
        args: [TARGET_TOKEN, parseEther("0.001"), 1n],
    });

    const swapHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: moduleAddress, data: swapData, value: 0n }],
    });
    const swapReceipt = await pimlicoClient.waitForUserOperationReceipt({ hash: swapHash });
    console.log(`[PHASE 5] 🎉 Swap tx: ${swapReceipt.receipt.transactionHash}`);

    // ── Summary ──────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  ✅ V5 E2E MOCK TEST COMPLETE — Pimlico Cloud Bundler");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Safe:           ${safeAccount.address}`);
    console.log(`  requestAudit:   ✅ (tradeId: ${tradeId})`);
    console.log(`  Oracle mock:    ✅ (riskScore: 0 → APPROVED)`);
    console.log(`  triggerSwap:    ✅ (via Pimlico UserOp)`);
    console.log(`  ERC-4337:       ✅ (live on Base Sepolia)`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    process.exit(0);
}

main().catch((err) => {
    console.error("💥 E2E fatal:", err.message);
    process.exit(1);
});
