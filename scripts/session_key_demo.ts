/**
 * ═══════════════════════════════════════════════════════════════
 * Session Key Demo — Agent submits UserOps with scoped session key
 * ═══════════════════════════════════════════════════════════════
 *
 * Proves: An AI agent can submit requestAudit() UserOps using ONLY
 * a session key — the owner's private key is NOT required.
 *
 * Flow:
 *   1. Deploy NEW Safe with SmartSessionsValidator + session for agent
 *   2. Agent uses session key to submit requestAudit() UserOp
 *   3. Verify the audit was submitted on-chain
 *
 * INDEPENDENT of existing Safe at 0xC006...
 *
 * Usage: pnpm ts-node --transpile-only scripts/session_key_demo.ts
 */
// @ts-nocheck
import {
    createPublicClient,
    createWalletClient,
    http,
    getAddress,
    encodeFunctionData,
    parseEther,
    type Address,
    type Hex,
    toHex,
    toBytes,
} from "viem";
import { baseSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { erc7579Actions } from "permissionless/actions/erc7579";
import {
    entryPoint07Address,
    getUserOperationHash,
} from "viem/account-abstraction";
import { getAccountNonce } from "permissionless/actions";
import {
    getSmartSessionsValidator,
    OWNABLE_VALIDATOR_ADDRESS,
    getSudoPolicy,
    encodeSmartSessionSignature,
    getOwnableValidatorMockSignature,
    RHINESTONE_ATTESTER_ADDRESS,
    encodeValidatorNonce,
    getAccount,
    getOwnableValidator,
    encodeValidationData,
    SmartSessionMode,
    getPermissionId,
    type Session,
} from "@rhinestone/module-sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

// Safe 7579 adapter addresses
const SAFE_4337_MODULE = "0x7579EE8307284F293B1927136486880611F20002" as Address;
const ERC7579_LAUNCHPAD = "0x7579011aB74c46090561ea277Ba79D510c6C00ff" as Address;

// Use existing AegisModule (the one already deployed and verified)
const AEGIS_MODULE = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;

// AegisModule ABI (minimal — just what we need)
const AEGIS_ABI = [
    {
        name: "requestAudit", type: "function", stateMutability: "nonpayable",
        inputs: [{ name: "_token", type: "address" }],
        outputs: [{ name: "tradeId", type: "uint256" }]
    },
    {
        name: "subscribeAgent", type: "function", stateMutability: "nonpayable",
        inputs: [{ name: "_agent", type: "address" }, { name: "_budget", type: "uint256" }],
        outputs: []
    },
] as const;

// Target token for the demo audit
const MOCK_BRETT = "0x532f27101965dd16442E59d40670FaF5eBB142E4" as Address; // BRETT on Base

async function main() {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    if (!ownerPk) { console.error("❌ Missing PRIVATE_KEY"); process.exit(1); }
    if (!PIMLICO_API_KEY) { console.error("❌ Missing PIMLICO_API_KEY"); process.exit(1); }

    const owner = privateKeyToAccount(ownerPk);

    // Generate a fresh session key for the agent
    const sessionKeyPk = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionKeyPk);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🔑 SESSION KEY DEMO — Agent Autonomy via ERC-7715");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Owner:       ${owner.address}`);
    console.log(`  Session Key: ${sessionKeyAccount.address}`);
    console.log(`  Module:      ${AEGIS_MODULE}`);
    console.log(`  Target:      BRETT (${MOCK_BRETT})`);
    console.log("");

    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    // ── Phase 1: Deploy Safe with SmartSessions + session for agent ──────
    console.log("━━━ PHASE 1: Deploy Safe with session key pre-configured ━━━");

    const ownableValidator = getOwnableValidator({
        owners: [owner.address],
        threshold: 1,
    });

    // Define the session: agent can call requestAudit on AegisModule
    const session: Session = {
        sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
        sessionValidatorInitData: encodeValidationData({
            threshold: 1,
            owners: [sessionKeyAccount.address],
        }),
        salt: toHex(toBytes("0", { size: 32 })),
        userOpPolicies: [getSudoPolicy()],
        erc7739Policies: {
            allowedERC7739Content: [],
            erc1271Policies: [],
        },
        actions: [
            {
                // Agent can call requestAudit(address) on AegisModule
                actionTarget: AEGIS_MODULE,
                actionTargetSelector: "0xe34eac65" as Hex, // requestAudit(address) — verified via cast sig
                actionPolicies: [getSudoPolicy()],
            },
        ],
        chainId: BigInt(baseSepolia.id),
        permitERC4337Paymaster: true,
    };

    const smartSessions = getSmartSessionsValidator({
        sessions: [session],
    });

    const salt = BigInt(Date.now());
    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        safe4337ModuleAddress: SAFE_4337_MODULE,
        erc7579LaunchpadAddress: ERC7579_LAUNCHPAD,
        attesters: [RHINESTONE_ATTESTER_ADDRESS],
        attestersThreshold: 1,
        saltNonce: salt,
        // Pre-install BOTH validators during Safe creation
        validators: [
            {
                address: ownableValidator.address,
                context: ownableValidator.initData,
            },
            {
                address: smartSessions.address,
                context: smartSessions.initData!,
            },
        ],
    });

    console.log(`  Safe (counterfactual): ${safeAccount.address}`);

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    }).extend(erc7579Actions());

    // Deploy Safe with both validators pre-installed (single UserOp)
    console.log("  Deploying Safe with SmartSessions pre-installed...");
    const deployHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: safeAccount.address, data: "0x" as Hex, value: 0n }],
    });
    const deployReceipt = await pimlicoClient.waitForUserOperationReceipt({ hash: deployHash });
    console.log(`  ✅ Safe deployed: ${deployReceipt.receipt.transactionHash}`);

    // Subscribe the Safe as an agent on AegisModule (owner calls subscribeAgent)
    console.log("  Subscribing Safe as agent on AegisModule...");
    const walletClient = createWalletClient({ account: owner, chain: baseSepolia, transport: http(RPC_URL) });
    const subHash = await walletClient.writeContract({
        address: AEGIS_MODULE,
        abi: AEGIS_ABI,
        functionName: "subscribeAgent",
        args: [safeAccount.address, parseEther("0.001")],
    });
    await publicClient.waitForTransactionReceipt({ hash: subHash });
    console.log(`  ✅ Safe subscribed as agent (0.001 ETH budget)`);

    // ── Phase 2: Agent uses session key to submit requestAudit ───────────
    console.log("\n━━━ PHASE 2: Agent submits requestAudit via session key ━━━");

    // Wait for RPC sync
    await new Promise(r => setTimeout(r, 3000));

    const permissionId = getPermissionId({ session });
    console.log(`  Permission ID: ${permissionId}`);

    // Build the requestAudit call
    const auditCallData = encodeFunctionData({
        abi: AEGIS_ABI,
        functionName: "requestAudit",
        args: [MOCK_BRETT],
    });

    // Get the session-keyed nonce
    const nonce = await getAccountNonce(publicClient, {
        address: safeAccount.address,
        entryPointAddress: entryPoint07Address,
        key: encodeValidatorNonce({
            account: getAccount({
                address: safeAccount.address,
                type: "safe",
            }),
            validator: smartSessions,
        }),
    });

    console.log(`  Nonce: ${nonce}`);

    // Prepare the session signature details
    const sessionDetails = {
        mode: SmartSessionMode.USE as any,
        permissionId,
        signature: getOwnableValidatorMockSignature({ threshold: 1 }),
    };

    // Prepare the UserOp with explicit gas limits (skip estimation that fails with mock sig)
    console.log("  Building UserOp with manual gas limits...");

    // Use prepareUserOperation to build the callData correctly
    // But we need to handle the simulation failure by catching it and using manual gas
    let userOperation: any;
    try {
        userOperation = await smartAccountClient.prepareUserOperation({
            account: safeAccount,
            calls: [
                {
                    to: AEGIS_MODULE,
                    value: 0n,
                    data: auditCallData,
                },
            ],
            nonce,
            signature: encodeSmartSessionSignature(sessionDetails),
        });
    } catch (e: any) {
        console.log("  ⚠️  Estimation failed (expected with mock sig), using manual gas limits...");

        // Build the execution callData manually using the Safe7579 execute format
        const { encodePacked, pad, concat } = await import("viem");

        // ERC-7579 single execution mode
        const execMode = pad("0x00", { size: 32 }) as Hex;

        // Encode executionCalldata: packed(target, value, calldata)
        const executionCalldata = concat([
            AEGIS_MODULE as Hex,
            pad("0x00", { size: 32 }) as Hex, // value = 0
            auditCallData,
        ]);

        // Safe7579 execute(bytes32 mode, bytes calldata executionCalldata)
        const safeCallData = encodeFunctionData({
            abi: [{
                name: "execute",
                type: "function",
                inputs: [
                    { name: "mode", type: "bytes32" },
                    { name: "executionCalldata", type: "bytes" },
                ],
                outputs: [],
                stateMutability: "payable",
            }],
            functionName: "execute",
            args: [execMode, executionCalldata],
        });

        userOperation = {
            sender: safeAccount.address,
            nonce,
            callData: safeCallData,
            callGasLimit: 200000n,
            verificationGasLimit: 500000n,
            preVerificationGas: 100000n,
            maxFeePerGas: 7700000n,
            maxPriorityFeePerGas: 1100000n,
            signature: encodeSmartSessionSignature(sessionDetails),
        };
    }

    // Sign with the session key (NOT the owner key!)
    const userOpHashToSign = getUserOperationHash({
        chainId: baseSepolia.id,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        userOperation,
    });

    console.log("  🔑 Signing with SESSION KEY (not owner!)...");
    sessionDetails.signature = await sessionKeyAccount.signMessage({
        message: { raw: userOpHashToSign },
    });

    userOperation.signature = encodeSmartSessionSignature(sessionDetails);

    // Send!
    console.log("  📤 Sending UserOp...");
    const userOpHash = await smartAccountClient.sendUserOperation(userOperation);
    console.log(`  UserOp: ${userOpHash}`);

    const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log(`  ✅ Tx: ${receipt.receipt.transactionHash}`);

    // ── Results ──────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🎉 SESSION KEY DEMO COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  The agent submitted requestAudit() using ONLY a session key.`);
    console.log(`  The owner's private key was NOT used for the audit UserOp.`);
    console.log(`  Safe:        ${safeAccount.address}`);
    console.log(`  Session Key: ${sessionKeyAccount.address}`);
    console.log(`  Tx:          ${receipt.receipt.transactionHash}`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Save results
    const resultFile = path.join(__dirname, "../SESSION_KEY_RESULTS.txt");
    fs.writeFileSync(resultFile, [
        `SAFE=${safeAccount.address}`,
        `SESSION_KEY=${sessionKeyAccount.address}`,
        `TX=${receipt.receipt.transactionHash}`,
        `STATUS=SUCCESS`,
    ].join("\n") + "\n");
    console.log("  Saved to: SESSION_KEY_RESULTS.txt");
}

main().catch(err => {
    console.error("💥", err.message || err);
    if (err.details) console.error("Details:", err.details);
    process.exit(1);
});
