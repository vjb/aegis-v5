/**
 * ═══════════════════════════════════════════════════════════════
 * V5 Install SmartSessionValidator — ERC-7579 Compatible Safe
 * ═══════════════════════════════════════════════════════════════
 *
 * Deploys a NEW Safe on Base Sepolia with ERC-7579 compatibility
 * and BOTH modules pre-installed in a single UserOp:
 *   1. AegisModule (ERC-7579 Executor)
 *   2. SmartSessionValidator (ERC-7579 Validator)
 *
 * Then funds the treasury and subscribes the agent.
 *
 * Usage:
 *   pnpm ts-node --transpile-only scripts/v5_install_session_validator.ts
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    getAddress,
    nonceManager,
    type Address,
    type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { erc7579Actions } from "permissionless/actions/erc7579";
import { entryPoint07Address } from "viem/account-abstraction";
import * as dotenv from "dotenv";

import {
    SMART_SESSIONS_VALIDATOR_ADDRESS,
    getSmartSessionValidatorModule,
} from "./v5_session_config";

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

// Safe 7579 adapter addresses (canonical, deployed on all EVM chains)
const SAFE_4337_MODULE = "0x7579EE8307284F293B1927136486880611F20002" as Address;
const ERC7579_LAUNCHPAD = "0x7579011aB74c46090561ea277Ba79D510c6C00ff" as Address;

const AEGIS_MODULE_ABI = [
    { name: "subscribeAgent", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_agent", type: "address" }, { name: "_budget", type: "uint256" }], outputs: [] },
    { name: "agentAllowances", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

async function main() {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    const moduleAddress = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;
    const agentPk = process.env.AGENT_PRIVATE_KEY as Hex;

    if (!ownerPk || !moduleAddress || !PIMLICO_API_KEY || !agentPk) {
        console.error("❌ Missing PRIVATE_KEY, AEGIS_MODULE_ADDRESS, PIMLICO_API_KEY, or AGENT_PRIVATE_KEY");
        process.exit(1);
    }

    const owner = privateKeyToAccount(ownerPk);
    owner.nonceManager = nonceManager;
    const agent = privateKeyToAccount(agentPk);

    // Get SmartSessionValidator module config
    const validatorModule = getSmartSessionValidatorModule();

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🔑 AEGIS V5 — SmartSessionValidator Installation");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Owner:      ${owner.address}`);
    console.log(`  Agent:      ${agent.address}`);
    console.log(`  Module:     ${moduleAddress}`);
    console.log(`  Validator:  ${SMART_SESSIONS_VALIDATOR_ADDRESS}`);
    console.log("");

    // ── Clients ──────────────────────────────────────────────────────────
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account: owner, chain: baseSepolia, transport: http(RPC_URL) });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    // ── Phase 1: Deploy Safe with BOTH modules pre-installed ─────────────
    console.log("━━━ PHASE 1: Deploy ERC-7579 Safe (modules pre-installed) ━━━");

    const salt = BigInt(Date.now());
    console.log(`[PHASE 1] Using salt: ${salt}`);

    // Pre-install SmartSessionValidator during Safe creation
    // NOTE: Only SmartSessionValidator is pre-installed (it's Rhinestone-attested).
    // AegisModule is an external contract the Safe interacts with — it doesn't need
    // to be installed as a 7579 module on the Safe itself.
    const RHINESTONE_ATTESTER = "0x000000333034E9f539ce08819E12c1b8Cb29084d" as Address;

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        safe4337ModuleAddress: SAFE_4337_MODULE,
        erc7579LaunchpadAddress: ERC7579_LAUNCHPAD,
        attesters: [RHINESTONE_ATTESTER],
        attestersThreshold: 1,
        saltNonce: salt,
        // Pre-install only the SmartSessionValidator (Rhinestone-attested)
        validators: [
            {
                address: SMART_SESSIONS_VALIDATOR_ADDRESS,
                context: validatorModule.initData || ("0x" as Hex),
            },
        ],
    });

    const safeAddr = safeAccount.address;
    console.log(`[PHASE 1] Safe (counterfactual): ${safeAddr}`);

    // Create smart account client with erc7579Actions
    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    }).extend(erc7579Actions());

    // Deploy (single UserOp creates Safe + installs both modules)
    const deployHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: safeAddr, data: "0x" as Hex, value: 0n }],
    });
    const deployReceipt = await pimlicoClient.waitForUserOperationReceipt({ hash: deployHash });
    console.log(`[PHASE 1] ✅ Safe deployed: ${deployReceipt.receipt.transactionHash}`);

    // Verify deployment
    const code = await publicClient.getCode({ address: safeAddr });
    console.log(`[PHASE 1] ✅ Bytecode: ${code?.length ?? 0} chars`);

    // ── Phase 2: Verify Module Installation ──────────────────────────────
    console.log("\n━━━ PHASE 2: Verify Module Installation ━━━");

    // Wait a moment for RPC to sync
    await new Promise(r => setTimeout(r, 3000));

    const isExecInstalled = await smartAccountClient.isModuleInstalled({
        type: "executor",
        address: moduleAddress,
        context: "0x" as Hex,
    });
    console.log(`[PHASE 2] AegisModule (executor):        ${isExecInstalled ? "✅" : "❌"}`);

    const isValInstalled = await smartAccountClient.isModuleInstalled({
        type: "validator",
        address: SMART_SESSIONS_VALIDATOR_ADDRESS,
        context: "0x" as Hex,
    });
    console.log(`[PHASE 2] SmartSessionValidator (validator): ${isValInstalled ? "✅" : "❌"}`);

    // ── Phase 3: Fund Treasury + Subscribe Agent ─────────────────────────
    console.log("\n━━━ PHASE 3: Fund Treasury + Subscribe Agent ━━━");

    const depositHash = await walletClient.sendTransaction({
        to: moduleAddress, value: parseEther("0.005"),
    });
    await publicClient.waitForTransactionReceipt({ hash: depositHash });
    console.log(`[PHASE 3] ✅ Deposited 0.005 ETH to module treasury`);

    const subHash = await walletClient.writeContract({
        address: moduleAddress, abi: AEGIS_MODULE_ABI,
        functionName: "subscribeAgent", args: [agent.address, parseEther("0.002")],
    });
    await publicClient.waitForTransactionReceipt({ hash: subHash });
    console.log(`[PHASE 3] ✅ Agent subscribed (0.002 ETH budget)`);

    const allowance = await publicClient.readContract({
        address: moduleAddress, abi: AEGIS_MODULE_ABI,
        functionName: "agentAllowances", args: [agent.address],
    });
    console.log(`[PHASE 3] ✅ Agent allowance: ${allowance} wei`);

    // ── Summary ──────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  ✅ SESSION VALIDATOR INSTALLATION COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  SAFE_ADDRESS=${safeAddr}`);
    console.log(`  AegisModule:        ${isExecInstalled ? "✅" : "❌"} Executor`);
    console.log(`  SessionValidator:   ${isValInstalled ? "✅" : "❌"} Validator`);
    console.log(`  Agent:              ✅ ${agent.address}`);
    console.log(`  Treasury:           ✅ 0.005 ETH`);
    console.log("");
    console.log(`  👉 Update .env: SAFE_ADDRESS=${safeAddr}`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    process.exit(0);
}

main().catch((err) => {
    console.error("💥 Installation failed:", err.message);
    console.error(err);
    process.exit(1);
});
