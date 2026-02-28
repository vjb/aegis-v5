/**
 * ═══════════════════════════════════════════════════════════════
 * V5 Phase 2 — Safe Smart Account + AegisModule Provisioner
 * ═══════════════════════════════════════════════════════════════
 *
 * Deploys a Safe (v1.4.1) Smart Account and installs AegisModule as
 * an ERC-7579 Executor using Rhinestone's module-sdk and permissionless.js.
 *
 * Flow:
 *   1. Create Owner account from private key
 *   2. Compute counterfactual Safe address (no tx needed)
 *   3. Fund Safe via direct RPC (Tenderly impersonation for local dev)
 *   4. Install AegisModule via SmartAccountClient.sendUserOperation()
 *   5. Verify isModuleInstalled() returns true
 *
 * Usage:
 *   pnpm ts-node scripts/v5_setup_safe.ts
 *
 * Output:  SAFE_ADDRESS env var value to add to .env
 */

import {
    createPublicClient,
    http,
    parseEther,
    defineChain,
    getAddress,
    type Address,
    type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import {
    installModule,
    isModuleInstalled,
    getAccount,
    type Module,
} from "@rhinestone/module-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Public constants (exported for tests) ────────────────────────────────
export const ENTRYPOINT_V07 = entryPoint07Address as Address;
export const AEGIS_MODULE_TYPE = "executor" as const;

// ─── Config Builders (pure — exported for unit tests) ─────────────────────

/**
 * Builds the Safe account configuration for permissionless toSafeSmartAccount().
 * Pure function — no network calls.
 */
export function buildSafeConfig(ownerAddress: Address) {
    return {
        owners: [ownerAddress],
        threshold: 1,
        version: "1.4.1" as const,
        entryPoint: {
            address: ENTRYPOINT_V07,
            version: "0.7" as const,
        },
        // Unique salt per deployment — use timestamp for non-collision in tests
        saltNonce: BigInt(Math.floor(Date.now() / 1000)),
    };
}

/**
 * Builds the AegisModule install config for Rhinestone installModule().
 * Pure function — no network calls.
 *
 * Rhinestone Module shape (v0.4.0):
 *   address + module = same address (both required)
 *   additionalContext = "0x" for most modules
 */
export function buildAegisModuleConfig(moduleAddress: Address): Module {
    const addr = getAddress(moduleAddress);
    return {
        address: addr,
        module: addr,
        type: AEGIS_MODULE_TYPE,
        // AegisModule.onInstall() accepts empty bytes — no init required
        initData: "0x" as Hex,
        deInitData: "0x" as Hex,
        additionalContext: "0x" as Hex,
    };
}

// ─── Tenderly Base Fork chain definition ──────────────────────────────────
function buildTenderlyChain(rpcUrl: string, chainId = 73578453) {
    return defineChain({
        id: chainId,
        name: "Aegis Tenderly VNet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
        testnet: true,
    });
}

// ─── Main Deployment Function ──────────────────────────────────────────────

/**
 * Deploys a Safe Smart Account and installs AegisModule as an ERC-7579 Executor.
 *
 * @param ownerPk     Owner's private key (hex)
 * @param moduleAddress  Deployed AegisModule address
 * @param rpcUrl      Tenderly VNet RPC URL
 * @param bundlerUrl  Alto bundler URL (default: http://localhost:4337)
 * @returns safeAddress and install txHash
 */
export async function deploySafeWithAegisModule(
    ownerPk: Hex,
    moduleAddress: Address,
    rpcUrl: string,
    bundlerUrl = process.env.BUNDLER_RPC_URL || "http://localhost:4337"
): Promise<{ safeAddress: Address; txHash: Hex }> {
    const chain = buildTenderlyChain(rpcUrl);
    const owner = privateKeyToAccount(ownerPk);

    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
    });

    console.log(`\n[V5 SETUP] Owner:     ${owner.address}`);
    console.log(`[V5 SETUP] Module:    ${moduleAddress}`);
    console.log(`[V5 SETUP] Bundler:   ${bundlerUrl}`);

    // ── Step 1: Compute counterfactual Safe address ──────────────────────
    const safeConfig = buildSafeConfig(owner.address);
    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: safeConfig.version,
        entryPoint: safeConfig.entryPoint,
        saltNonce: safeConfig.saltNonce,
    });

    const safeAddress = safeAccount.address;
    console.log(`[V5 SETUP] Safe (counterfactual): ${safeAddress}`);

    // ── Step 2: Fund Safe (Tenderly dev RPC supports eth_sendTransaction) ──
    const ownerBalance = await publicClient.getBalance({ address: owner.address });
    console.log(`[V5 SETUP] Owner balance: ${ownerBalance} wei`);

    // ── Step 3: Create Smart Account Client via bundler ──────────────────
    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain,
        bundlerTransport: http(bundlerUrl),
        userOperation: {
            estimateFeesPerGas: async () => {
                const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
                return { maxFeePerGas, maxPriorityFeePerGas };
            },
        },
    });

    // ── Step 4: Install AegisModule as ERC-7579 Executor ─────────────────
    const moduleConfig = buildAegisModuleConfig(moduleAddress);

    const account = getAccount({
        address: safeAddress,
        type: "safe",
    });

    // installModule returns Execution[] — submit them as a UserOp batch
    // Note: publicClient cast to any because rhinestone expects its own ClientType
    const executions = await installModule({
        client: publicClient as unknown as any,
        account,
        module: moduleConfig,
    });

    console.log(`[V5 SETUP] Submitting install UserOperation (${executions.length} execution(s))...`);

    // permissionless 0.3.x SmartAccountClient uses sendTransaction for execution
    // (sendUserOperation API differs by account type — Safe uses execute pattern)
    const smartClient = smartAccountClient as unknown as any;
    const userOpHash = await smartClient.sendUserOperation({
        userOperation: {
            callData: await (safeAccount as any).encodeCallData(
                executions.map((exec: any) => ({
                    to: exec.target as Address,
                    value: exec.value ?? BigInt(0),
                    data: exec.callData as Hex,
                }))
            ),
        },
    });

    console.log(`[V5 SETUP] ✅ UserOp hash: ${userOpHash}`);

    const receipt = await smartClient.waitForUserOperationReceipt({ hash: userOpHash });
    const txHash = receipt.receipt.transactionHash;

    // ── Step 5: Verify installation ──────────────────────────────────────
    const installed = await isModuleInstalled({
        client: publicClient as any,
        account,
        module: moduleConfig,
    });

    if (!installed) {
        throw new Error("Module install tx succeeded but isModuleInstalled returned false");
    }

    console.log(`[V5 SETUP] ✅ isModuleInstalled = true`);
    console.log(`\n[V5 SETUP] ══════════════════════════════════════════`);
    console.log(`[V5 SETUP]  Add to .env:`);
    console.log(`[V5 SETUP]  SAFE_ADDRESS=${safeAddress}`);
    console.log(`[V5 SETUP] ══════════════════════════════════════════\n`);

    return { safeAddress, txHash: txHash as Hex };
}

// ─── CLI Entrypoint ───────────────────────────────────────────────────────
if (require.main === module) {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    const moduleAddr = process.env.AEGIS_MODULE_ADDRESS as Address;
    const rpcUrl = process.env.TENDERLY_RPC_URL!;

    if (!ownerPk || !moduleAddr || !rpcUrl) {
        console.error("[V5 SETUP] ❌ Missing PRIVATE_KEY, AEGIS_MODULE_ADDRESS, or TENDERLY_RPC_URL");
        process.exit(1);
    }

    deploySafeWithAegisModule(ownerPk, moduleAddr, rpcUrl)
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("[V5 SETUP] 💥 Fatal:", err.message);
            process.exit(1);
        });
}
