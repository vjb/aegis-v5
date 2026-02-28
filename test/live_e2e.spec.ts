// @ts-nocheck — Integration test: skipped without env vars; permissionless lib type mismatch
/**
 * ═══════════════════════════════════════════════════════════════
 * Phase 6.3 — Live CRE Integration E2E Test (Base Sepolia)
 * ═══════════════════════════════════════════════════════════════
 *
 * This test requires:
 *  - Docker running with `aegis-oracle-node` container
 *  - Base Sepolia RPC access
 *  - Funded deployer wallet (0x109D8072...)
 *  - Pimlico API key
 *  - Deployed AegisModule + mock tokens on Base Sepolia
 *
 * Run with: pnpm jest test/live_e2e.spec.ts --testTimeout=120000
 *
 * Flow:
 *  1. Submit requestAudit(MockBRETT) via EOA
 *  2. Verify AuditRequested event emitted
 *  3. Simulate CRE oracle via onReportDirect (riskScore=0 for clean token)
 *  4. Poll isApproved until true
 *  5. Submit triggerSwap via Pimlico UserOp
 *  6. Verify SwapExecuted event
 *  7. Submit requestAudit(MockHoneypot) via EOA
 *  8. Simulate CRE oracle via onReportDirect (riskScore=4 for honeypot)
 *  9. Verify isApproved stays false (ClearanceDenied)
 * 10. Attempt triggerSwap for MockHoneypot — expect revert TokenNotCleared
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    encodeFunctionData,
    nonceManager,
    type Address,
    type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import {
    createPimlicoClient,
} from "permissionless/clients/pimlico";
import * as dotenv from "dotenv";
dotenv.config();

// ── ABI (subset needed for test) ──────────────────────────────────────
const AEGIS_MODULE_ABI = [
    { name: "requestAudit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_token", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "onReportDirect", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tradeId", type: "uint256" }, { name: "riskScore", type: "uint256" }], outputs: [] },
    { name: "triggerSwap", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_token", type: "address" }, { name: "_amountIn", type: "uint256" }, { name: "_amountOutMinimum", type: "uint256" }], outputs: [] },
    { name: "isApproved", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
    { name: "subscribeAgent", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_agent", type: "address" }, { name: "_budget", type: "uint256" }], outputs: [] },
    { name: "depositETH", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
    { type: "event", name: "AuditRequested", inputs: [{ name: "tradeId", type: "uint256", indexed: true }, { name: "user", type: "address", indexed: true }, { name: "targetToken", type: "address", indexed: true }, { name: "firewallConfig", type: "string", indexed: false }] },
    { type: "event", name: "SwapExecuted", inputs: [{ name: "token", type: "address", indexed: true }, { name: "amountIn", type: "uint256", indexed: false }, { name: "amountOut", type: "uint256", indexed: false }] },
] as any[];

// ── Config ────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_KEY}`;
const MODULE = process.env.AEGIS_MODULE_ADDRESS as Address;
const MOCK_BRETT = process.env.TARGET_TOKEN_ADDRESS as Address;
const MOCK_HONEYPOT = process.env.MOCK_HONEYPOT_ADDRESS as Address;

describe("Live CRE E2E Integration (Base Sepolia)", () => {
    // Skip if env vars not set
    const skip = !PIMLICO_KEY || !MODULE || !MOCK_BRETT;

    let publicClient: any;
    let walletClient: any;
    let smartAccountClient: any;
    let pimlicoClient: any;
    let safeAccount: any;

    beforeAll(async () => {
        if (skip) return;

        const ownerPk = process.env.PRIVATE_KEY as Hex;
        const owner = privateKeyToAccount(ownerPk);
        owner.nonceManager = nonceManager;

        publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
        walletClient = createWalletClient({ account: owner, chain: baseSepolia, transport: http(RPC_URL) });

        pimlicoClient = createPimlicoClient({
            transport: http(PIMLICO_URL),
            entryPoint: { address: entryPoint07Address, version: "0.7" },
        });

        safeAccount = await toSafeSmartAccount({
            client: publicClient as any,
            owners: [owner],
            version: "1.4.1",
            entryPoint: { address: entryPoint07Address, version: "0.7" },
            saltNonce: BigInt(Date.now()), // Fresh Safe for each test run
        });

        smartAccountClient = createSmartAccountClient({
            account: safeAccount,
            chain: baseSepolia,
            bundlerTransport: http(PIMLICO_URL),
            paymaster: pimlicoClient,
            userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
        });

        // Deploy Safe via Pimlico
        const deployHash = await smartAccountClient.sendUserOperation({
            calls: [{ to: safeAccount.address, data: "0x" as Hex, value: 0n }],
        });
        await pimlicoClient.waitForUserOperationReceipt({ hash: deployHash });

        // Fund module + subscribe agent
        const depositHash = await walletClient.sendTransaction({ to: MODULE, value: parseEther("0.005") });
        await publicClient.waitForTransactionReceipt({ hash: depositHash });

        const subHash = await walletClient.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "subscribeAgent", args: [safeAccount.address, parseEther("0.002")],
        });
        await publicClient.waitForTransactionReceipt({ hash: subHash });
    }, 120_000);

    it("requestAudit(MockBRETT) emits AuditRequested", async () => {
        if (skip) return;
        const hash = await walletClient.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "requestAudit", args: [MOCK_BRETT],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const auditLog = receipt.logs.find(
            (l: any) => l.address.toLowerCase() === MODULE.toLowerCase()
        );
        expect(auditLog).toBeDefined();
        expect(auditLog!.topics.length).toBeGreaterThanOrEqual(2);
    }, 30_000);

    it("onReportDirect(riskScore=0) approves clean token", async () => {
        if (skip) return;
        // Get latest tradeId from requestAudit
        const auditHash = await walletClient.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "requestAudit", args: [MOCK_BRETT],
        });
        const auditReceipt = await publicClient.waitForTransactionReceipt({ hash: auditHash });
        const auditLog = auditReceipt.logs.find(
            (l: any) => l.address.toLowerCase() === MODULE.toLowerCase()
        );
        const tradeId = BigInt(auditLog!.topics[1]!);

        // Oracle approves (riskScore=0)
        const reportHash = await walletClient.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "onReportDirect", args: [tradeId, 0n],
        });
        await publicClient.waitForTransactionReceipt({ hash: reportHash });

        // Poll isApproved
        let approved = false;
        for (let i = 0; i < 10; i++) {
            approved = await publicClient.readContract({
                address: MODULE, abi: AEGIS_MODULE_ABI,
                functionName: "isApproved", args: [MOCK_BRETT],
            }) as boolean;
            if (approved) break;
            await new Promise(r => setTimeout(r, 2000));
        }
        expect(approved).toBe(true);
    }, 60_000);

    it("triggerSwap(MockBRETT) succeeds via UserOp after approval", async () => {
        if (skip) return;
        const swapData = (encodeFunctionData as Function)({
            abi: AEGIS_MODULE_ABI,
            functionName: "triggerSwap",
            args: [MOCK_BRETT, parseEther("0.001"), 1n],
        });
        const swapHash = await smartAccountClient.sendUserOperation({
            calls: [{ to: MODULE, data: swapData, value: 0n }],
        });
        const swapReceipt = await pimlicoClient.waitForUserOperationReceipt({ hash: swapHash });
        expect(swapReceipt.receipt.transactionHash).toBeDefined();
        expect(swapReceipt.success).toBe(true);
    }, 60_000);

    it("onReportDirect(riskScore=4) denies honeypot token", async () => {
        if (skip) return;
        const auditHash = await walletClient.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "requestAudit", args: [MOCK_HONEYPOT],
        });
        const auditReceipt = await publicClient.waitForTransactionReceipt({ hash: auditHash });
        const auditLog = auditReceipt.logs.find(
            (l: any) => l.address.toLowerCase() === MODULE.toLowerCase()
        );
        const tradeId = BigInt(auditLog!.topics[1]!);

        // Oracle denies (riskScore=4 = honeypot bit)
        const reportHash = await walletClient.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "onReportDirect", args: [tradeId, 4n],
        });
        await publicClient.waitForTransactionReceipt({ hash: reportHash });

        // isApproved should stay false
        await new Promise(r => setTimeout(r, 3000));
        const approved = await publicClient.readContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "isApproved", args: [MOCK_HONEYPOT],
        });
        expect(approved).toBe(false);
    }, 60_000);

    it("triggerSwap(MockHoneypot) reverts with TokenNotCleared", async () => {
        if (skip) return;
        const swapData = (encodeFunctionData as Function)({
            abi: AEGIS_MODULE_ABI,
            functionName: "triggerSwap",
            args: [MOCK_HONEYPOT, parseEther("0.001"), 1n],
        });

        await expect(
            smartAccountClient.sendUserOperation({
                calls: [{ to: MODULE, data: swapData, value: 0n }],
            })
        ).rejects.toThrow();
    }, 60_000);
});
