// @ts-nocheck
/**
 * Shared session key utilities for agent UserOp signing.
 * 
 * All agent UserOp scripts import from here to get consistent
 * Safe + SmartSessions configuration.
 */
import {
    createPublicClient,
    createWalletClient,
    http,
    getAddress,
    encodeFunctionData,
    toHex,
    toBytes,
    type Address,
    type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
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

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;
const SAFE_4337_MODULE = "0x7579EE8307284F293B1927136486880611F20002" as Address;
const ERC7579_LAUNCHPAD = "0x7579011aB74c46090561ea277Ba79D510c6C00ff" as Address;

// Deterministic salt for the session-key-enabled Safe
const SESSION_SAFE_SALT = BigInt("7579000002");

// Function selectors (verified via cast sig)
const SELECTOR_REQUEST_AUDIT = "0xe34eac65" as Hex; // requestAudit(address)
const SELECTOR_TRIGGER_SWAP = "0x684bceb0" as Hex;  // triggerSwap(address,uint256,uint256)

/**
 * Build the session definition for an agent.
 * Permits: requestAudit + triggerSwap on AegisModule.
 */
export function buildSession(agentAddress: Address, moduleAddress: Address): Session {
    return {
        sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
        sessionValidatorInitData: encodeValidationData({
            threshold: 1,
            owners: [agentAddress],
        }),
        salt: toHex(toBytes("0", { size: 32 })),
        userOpPolicies: [getSudoPolicy()],
        erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
        actions: [
            {
                actionTarget: getAddress(moduleAddress),
                actionTargetSelector: SELECTOR_REQUEST_AUDIT,
                actionPolicies: [getSudoPolicy()],
            },
            {
                actionTarget: getAddress(moduleAddress),
                actionTargetSelector: SELECTOR_TRIGGER_SWAP,
                actionPolicies: [getSudoPolicy()],
            },
        ],
        chainId: BigInt(baseSepolia.id),
        permitERC4337Paymaster: true,
    };
}

/**
 * Create all clients and the Safe account with SmartSessions pre-installed.
 * Returns everything needed for session-key-signed UserOps.
 */
export async function createSessionClients(ownerPk: Hex, agentPk: Hex, moduleAddress: Address) {
    const owner = privateKeyToAccount(ownerPk);
    const agent = privateKeyToAccount(agentPk);

    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account: owner, chain: baseSepolia, transport: http(RPC_URL) });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    const ownableValidator = getOwnableValidator({
        owners: [owner.address],
        threshold: 1,
    });

    const session = buildSession(agent.address as Address, moduleAddress);
    const smartSessions = getSmartSessionsValidator({ sessions: [session] });

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        safe4337ModuleAddress: SAFE_4337_MODULE,
        erc7579LaunchpadAddress: ERC7579_LAUNCHPAD,
        attesters: [RHINESTONE_ATTESTER_ADDRESS],
        attestersThreshold: 1,
        saltNonce: SESSION_SAFE_SALT,
        validators: [
            { address: ownableValidator.address, context: ownableValidator.initData },
            { address: smartSessions.address, context: smartSessions.initData! },
        ],
    });

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    }).extend(erc7579Actions());

    return {
        owner, agent, publicClient, walletClient, pimlicoClient,
        safeAccount, smartAccountClient, session, smartSessions,
    };
}

/**
 * Send a UserOp signed by the agent's session key.
 * 
 * @param callData - The encoded function call (e.g., requestAudit or triggerSwap)
 * @param target - The contract to call (AegisModule address)
 * @param clients - The clients from createSessionClients
 * @returns The transaction hash
 */
export async function sendSessionKeyUserOp(
    callData: Hex,
    target: Address,
    clients: Awaited<ReturnType<typeof createSessionClients>>,
): Promise<string> {
    const { agent, publicClient, pimlicoClient, safeAccount, smartAccountClient, session, smartSessions } = clients;

    const permissionId = getPermissionId({ session });

    const nonce = await getAccountNonce(publicClient, {
        address: safeAccount.address,
        entryPointAddress: entryPoint07Address,
        key: encodeValidatorNonce({
            account: getAccount({ address: safeAccount.address, type: "safe" }),
            validator: smartSessions,
        }),
    });

    const sessionDetails = {
        mode: SmartSessionMode.USE as any,
        permissionId,
        signature: getOwnableValidatorMockSignature({ threshold: 1 }),
    };

    // Build UserOp with manual gas limits (estimation fails with mock session sig)
    const { pad, concat } = await import("viem");
    const execMode = pad("0x00", { size: 32 }) as Hex;
    const executionCalldata = concat([
        target as Hex,
        pad("0x00", { size: 32 }) as Hex,
        callData,
    ]);

    const safeCallData = encodeFunctionData({
        abi: [{
            name: "execute", type: "function",
            inputs: [{ name: "mode", type: "bytes32" }, { name: "executionCalldata", type: "bytes" }],
            outputs: [], stateMutability: "payable",
        }],
        functionName: "execute",
        args: [execMode, executionCalldata],
    });

    // Get gas prices
    const gasPrices = await pimlicoClient.getUserOperationGasPrice();

    const userOperation: any = {
        sender: safeAccount.address,
        nonce,
        callData: safeCallData,
        callGasLimit: 200000n,
        verificationGasLimit: 500000n,
        preVerificationGas: 100000n,
        maxFeePerGas: gasPrices.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.fast.maxPriorityFeePerGas,
        signature: encodeSmartSessionSignature(sessionDetails),
    };

    // Sponsor via Pimlico Paymaster (pm_sponsorUserOperation)
    const sponsorResult = await pimlicoClient.request({
        method: "pm_sponsorUserOperation" as any,
        params: [{
            sender: userOperation.sender,
            nonce: toHex(userOperation.nonce),
            callData: userOperation.callData,
            callGasLimit: toHex(userOperation.callGasLimit),
            verificationGasLimit: toHex(userOperation.verificationGasLimit),
            preVerificationGas: toHex(userOperation.preVerificationGas),
            maxFeePerGas: toHex(userOperation.maxFeePerGas),
            maxPriorityFeePerGas: toHex(userOperation.maxPriorityFeePerGas),
            signature: userOperation.signature,
        }, { entryPoint: entryPoint07Address }],
    }) as any;

    userOperation.paymaster = sponsorResult.paymaster;
    userOperation.paymasterData = sponsorResult.paymasterData;
    userOperation.paymasterVerificationGasLimit = BigInt(sponsorResult.paymasterVerificationGasLimit || "0x10000");
    userOperation.paymasterPostOpGasLimit = BigInt(sponsorResult.paymasterPostOpGasLimit || "0x10000");
    // Use gas estimates from sponsor if provided
    if (sponsorResult.callGasLimit) userOperation.callGasLimit = BigInt(sponsorResult.callGasLimit);
    if (sponsorResult.verificationGasLimit) userOperation.verificationGasLimit = BigInt(sponsorResult.verificationGasLimit);
    if (sponsorResult.preVerificationGas) userOperation.preVerificationGas = BigInt(sponsorResult.preVerificationGas);

    // Sign with session key (after paymaster fields are set — they affect the UserOp hash)
    const userOpHashToSign = getUserOperationHash({
        chainId: baseSepolia.id,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        userOperation,
    });

    sessionDetails.signature = await agent.signMessage({
        message: { raw: userOpHashToSign },
    });
    userOperation.signature = encodeSmartSessionSignature(sessionDetails);

    // Submit to bundler
    const bundlerClient = createPublicClient({
        chain: baseSepolia,
        transport: http(PIMLICO_URL),
    });

    const userOpHash = await bundlerClient.request({
        method: "eth_sendUserOperation" as any,
        params: [{
            sender: userOperation.sender,
            nonce: toHex(userOperation.nonce),
            callData: userOperation.callData,
            callGasLimit: toHex(userOperation.callGasLimit),
            verificationGasLimit: toHex(userOperation.verificationGasLimit),
            preVerificationGas: toHex(userOperation.preVerificationGas),
            maxFeePerGas: toHex(userOperation.maxFeePerGas),
            maxPriorityFeePerGas: toHex(userOperation.maxPriorityFeePerGas),
            signature: userOperation.signature,
            paymaster: userOperation.paymaster,
            paymasterData: userOperation.paymasterData,
            paymasterVerificationGasLimit: toHex(userOperation.paymasterVerificationGasLimit),
            paymasterPostOpGasLimit: toHex(userOperation.paymasterPostOpGasLimit),
        }, entryPoint07Address],
    }) as Hex;

    const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
    return receipt.receipt.transactionHash;
}

export { ENTRYPOINT_V07, RPC_URL, PIMLICO_URL, SESSION_SAFE_SALT };
