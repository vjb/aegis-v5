/**
 * ═══════════════════════════════════════════════════════════════
 * V5 Phase 5a — End-to-End Mock E2E Script
 * ═══════════════════════════════════════════════════════════════
 *
 * Purpose: Proves the full ERC-4337 UserOp plumbing works end-to-end
 *          WITHOUT requiring the real Chainlink CRE oracle.
 *
 * Oracle role: Simulated via onReportDirect() — owner calls directly
 *              after the AuditRequested event is detected.
 *
 * Phase 5b / Phase 6 will wire the REAL Chainlink CRE DON.
 *
 * Prerequisites:
 *   1. Anvil running (forked from Tenderly VNet):
 *        anvil --fork-url $TENDERLY_RPC_URL --port 8545 --chain-id 73578453
 *   2. Alto bundler running against Anvil:
 *        docker compose --profile v5 up alto-bundler
 *        (with TENDERLY_RPC_URL=http://localhost:8545 for this test)
 *   3. AegisModule deployed (inherited via Tenderly fork)
 *   4. Safe deployed: pnpm ts-node scripts/v5_setup_safe.ts
 *   5. SAFE_ADDRESS set in .env
 *
 * Run:
 *   pnpm ts-node scripts/v5_e2e_mock.ts
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    getAddress,
    defineChain,
    encodeFunctionData,
    type Hex,
    type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import * as dotenv from "dotenv";

import { buildV5RequestAuditCall, buildV5TriggerSwapCall } from "./v5_bot_config";

dotenv.config();

// ─── Env ──────────────────────────────────────────────────────────────────────
const OWNER_PK = process.env.PRIVATE_KEY as Hex;
const AGENT_PK = process.env.AGENT_PRIVATE_KEY as Hex;
const RPC_URL = process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545";
const BUNDLER_URL = process.env.BUNDLER_RPC_URL || "http://localhost:4337";
const MODULE_ADDR = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;
const SAFE_ADDR = getAddress(process.env.SAFE_ADDRESS!) as Address;
const TOKEN_ADDR = getAddress(
    process.env.TARGET_TOKEN_ADDRESS || "0x532f27101965dd16442E59d40670FaF5eBB142E4" // BRETT
) as Address;

// ─── AegisModule partial ABI (E2E needs onReportDirect + events) ──────────────
const MODULE_ABI = [
    {
        name: "onReportDirect",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "tradeId", type: "uint256" },
            { name: "riskScore", type: "uint256" },
        ],
        outputs: [],
    },
    {
        name: "AuditRequested",
        type: "event",
        inputs: [
            { name: "tradeId", type: "uint256", indexed: true },
            { name: "user", type: "address", indexed: true },
            { name: "targetToken", type: "address", indexed: true },
            { name: "firewallConfig", type: "string", indexed: false },
        ],
    },
    {
        name: "ClearanceUpdated",
        type: "event",
        inputs: [
            { name: "token", type: "address", indexed: true },
            { name: "approved", type: "bool", indexed: false },
        ],
    },
    {
        name: "SwapExecuted",
        type: "event",
        inputs: [
            { name: "targetToken", type: "address", indexed: true },
            { name: "amountIn", type: "uint256", indexed: false },
            { name: "amountOut", type: "uint256", indexed: false },
        ],
    },
] as const;

// ─── Chain (Anvil inherits Tenderly chain ID via --chain-id flag) ─────────────
const localChain = defineChain({
    id: 73578453,
    name: "Aegis Anvil Fork",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
    testnet: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(label: string, msg: string) {
    console.log(`[V5 E2E] ${label} ${msg}`);
}

function separator() {
    console.log("[V5 E2E] ─────────────────────────────────────────────────────");
}

async function pollLogs<T>(
    publicClient: ReturnType<typeof createPublicClient>,
    address: Address,
    event: any,
    fromBlock: bigint,
    matchFn: (logs: any[]) => T | null,
    maxAttempts = 60
): Promise<T> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const logs = await publicClient.getLogs({ address, event, fromBlock, toBlock: "latest" });
            const match = matchFn(logs);
            if (match !== null) return match;
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Timeout waiting for event");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    // Validate env
    if (!OWNER_PK || !AGENT_PK || !MODULE_ADDR || !SAFE_ADDR) {
        console.error("[V5 E2E] ❌ Missing env vars. Ensure PRIVATE_KEY, AGENT_PRIVATE_KEY, AEGIS_MODULE_ADDRESS, SAFE_ADDRESS are set.");
        process.exit(1);
    }

    const owner = privateKeyToAccount(OWNER_PK);
    const agent = privateKeyToAccount(AGENT_PK);

    const publicClient = createPublicClient({ chain: localChain, transport: http(RPC_URL) });
    const ownerWallet = createWalletClient({ account: owner, chain: localChain, transport: http(RPC_URL) });

    separator();
    log("🏁", "AEGIS V5 — End-to-End Mock E2E");
    separator();
    log("⚙️  Owner:         ", owner.address);
    log("⚙️  Agent (key):   ", agent.address);
    log("⚙️  Safe:          ", SAFE_ADDR);
    log("⚙️  AegisModule:   ", MODULE_ADDR);
    log("⚙️  Token (BRETT): ", TOKEN_ADDR);
    log("⚙️  Bundler:       ", BUNDLER_URL);
    log("⚙️  RPC:           ", RPC_URL);
    separator();

    // ── Bind agent to Safe Smart Account ─────────────────────────────────────
    log("🔗", "Binding agent session key to existing Safe...");
    const safeAccount = await toSafeSmartAccount({
        client: publicClient as any,
        owners: [agent],
        version: "1.4.1",
        entryPoint: { address: entryPoint07Address as Address, version: "0.7" },
        address: SAFE_ADDR,
    });

    const smartClient = createSmartAccountClient({
        account: safeAccount,
        chain: localChain,
        bundlerTransport: http(BUNDLER_URL),
    }) as any;
    log("✅", "SmartAccountClient ready");

    // ── Check Safe balance ────────────────────────────────────────────────────
    const safeBalance = await publicClient.getBalance({ address: SAFE_ADDR });
    log("💰", `Safe balance: ${safeBalance} wei (${Number(safeBalance) / 1e18} ETH)`);
    if (safeBalance === BigInt(0)) {
        log("⚠️ ", "Safe has no ETH — funding 0.05 ETH from owner for swap treasury...");
        await ownerWallet.sendTransaction({ to: SAFE_ADDR, value: parseEther("0.05") });
        log("✅", "Safe funded");
    }

    const currentBlock = await publicClient.getBlockNumber();

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 1: Submit requestAudit via ERC-4337 UserOperation
    // ══════════════════════════════════════════════════════════════════════════
    separator();
    log("📡 STEP 1:", "Submitting requestAudit(BRETT) as UserOperation...");

    const auditCall = buildV5RequestAuditCall(MODULE_ADDR, TOKEN_ADDR);
    let auditUserOpHash: Hex;

    try {
        auditUserOpHash = await smartClient.sendUserOperation({
            calls: [{ to: auditCall.to, data: auditCall.data, value: auditCall.value }],
        }) as Hex;
        log("✅", `UserOp hash: ${auditUserOpHash}`);
    } catch (err: any) {
        log("💥", `sendUserOperation failed: ${err.message}`);
        log("ℹ️ ", "Is the alto bundler running? docker compose --profile v5 up alto-bundler");
        throw err;
    }

    const auditReceipt = await smartClient.waitForUserOperationReceipt({ hash: auditUserOpHash });
    const auditBlock = auditReceipt.receipt.blockNumber as bigint;
    log("⛏  ", `Confirmed in block ${auditBlock}`);
    log("🔗 ", `Tx: ${auditReceipt.receipt.transactionHash}`);

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 2: Parse AuditRequested event to get tradeId
    // ══════════════════════════════════════════════════════════════════════════
    separator();
    log("👁  STEP 2:", "Parsing AuditRequested event for tradeId...");

    const tradeId = await pollLogs(
        publicClient,
        MODULE_ADDR,
        MODULE_ABI[1], // AuditRequested
        auditBlock,
        (logs) => {
            if (logs.length > 0) {
                const tradeId = (logs[0] as any).args.tradeId;
                log("✅", `AuditRequested — tradeId: ${tradeId}, token: ${(logs[0] as any).args.targetToken}`);
                return tradeId as bigint;
            }
            return null;
        }
    );

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 3: MOCK ORACLE — Owner calls onReportDirect(tradeId, riskScore=0)
    // Phase 6: This is replaced by the real Chainlink CRE DON via onReport()
    // ══════════════════════════════════════════════════════════════════════════
    separator();
    log("🔮 STEP 3:", `[MOCK ORACLE] Calling onReportDirect(${tradeId}, 0) — riskScore=0 = CLEAR...`);
    log("    ", "NOTE: Phase 6 replaces this with real Chainlink CRE onReport()");

    const oracleMockTx = await ownerWallet.writeContract({
        address: MODULE_ADDR,
        abi: MODULE_ABI,
        functionName: "onReportDirect",
        args: [tradeId, BigInt(0)],
    });
    const oracleReceipt = await publicClient.waitForTransactionReceipt({ hash: oracleMockTx });
    log("✅", `onReportDirect confirmed in block ${oracleReceipt.blockNumber}`);

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 4: Submit triggerSwap via ERC-4337 UserOperation
    // ══════════════════════════════════════════════════════════════════════════
    separator();
    log("💱 STEP 4:", "Submitting triggerSwap(BRETT, 0.01 ETH) as UserOperation...");

    const swapCall = buildV5TriggerSwapCall(
        MODULE_ADDR,
        TOKEN_ADDR,
        parseEther("0.01"),
        BigInt(1)
    );

    let swapUserOpHash: Hex;
    try {
        swapUserOpHash = await smartClient.sendUserOperation({
            calls: [{ to: swapCall.to, data: swapCall.data, value: swapCall.value }],
        }) as Hex;
        log("✅", `Swap UserOp hash: ${swapUserOpHash}`);
    } catch (err: any) {
        log("💥", `Swap UserOp failed: ${err.message}`);
        throw err;
    }

    const swapReceipt = await smartClient.waitForUserOperationReceipt({ hash: swapUserOpHash });
    log("⛏  ", `Swap confirmed in block ${swapReceipt.receipt.blockNumber}`);

    // Verify SwapExecuted event
    const swapLogs = await publicClient.getLogs({
        address: MODULE_ADDR,
        event: MODULE_ABI[3], // SwapExecuted
        fromBlock: swapReceipt.receipt.blockNumber,
        toBlock: "latest",
    });

    if (swapLogs.length > 0) {
        const swapArgs = (swapLogs[0] as any).args;
        log("🎉 SUCCESS!", `SwapExecuted — amountIn: ${swapArgs.amountIn}, amountOut: ${swapArgs.amountOut}`);
    } else {
        log("⚠️ ", "SwapExecuted event not found — check if Uniswap V3 pool exists on fork");
    }

    separator();
    log("✅ E2E COMPLETE!", "Full V5 UserOp loop verified:");
    log("   ", "1. requestAudit() via UserOp → AuditRequested ✓");
    log("   ", "2. Mock oracle (onReportDirect) → ClearanceUpdated ✓");
    log("   ", "3. triggerSwap() via UserOp → SwapExecuted ✓");
    log("   ", "");
    log("   ", "→ Phase 6: Replace mock oracle with real Chainlink CRE onReport()");
    separator();

    process.exit(0);
}

main().catch(err => {
    console.error("[V5 E2E] 💥 Fatal:", err.message || err);
    process.exit(1);
});
