/**
 * V5 Swap UserOp — Submit triggerSwap as ERC-4337 UserOperation via Pimlico
 *
 * Called by demo_v5_master.ps1 to prove real ERC-4337 usage in the flagship demo.
 * Reuses the Safe deployed by v5_e2e_mock.ts pattern.
 *
 * Usage:
 *   pnpm ts-node --transpile-only scripts/v5_swap_userop.ts <tokenAddress> <amountInWei> <amountOutMin>
 *
 * Output: Prints tx hash to stdout for PowerShell capture.
 */

import {
    createPublicClient,
    createWalletClient,
    http,
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
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";
import * as dotenv from "dotenv";

dotenv.config();

const AEGIS_MODULE_ABI = [
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
] as const;

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

// Use a fixed salt so the Safe address is deterministic across runs
const SAFE_SALT = BigInt("7579000001");

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error("Usage: v5_swap_userop.ts <tokenAddress> <amountInWei> <amountOutMin>");
        process.exit(1);
    }

    const tokenAddress = getAddress(args[0]) as Address;
    const amountIn = BigInt(args[1]);
    const amountOutMin = BigInt(args[2]);

    const ownerPk = process.env.PRIVATE_KEY as Hex;
    const moduleAddress = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;

    if (!ownerPk || !moduleAddress || !PIMLICO_API_KEY) {
        console.error("ERR: Missing PRIVATE_KEY, AEGIS_MODULE_ADDRESS, or PIMLICO_API_KEY");
        process.exit(1);
    }

    const owner = privateKeyToAccount(ownerPk);
    owner.nonceManager = nonceManager;

    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account: owner, chain: baseSepolia, transport: http(RPC_URL) });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    // Create Safe with deterministic salt
    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        saltNonce: SAFE_SALT,
    });

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    // Check if Safe is deployed, deploy if not
    const code = await publicClient.getCode({ address: safeAccount.address });
    if (!code || code === "0x") {
        console.error(`DEPLOY: Safe ${safeAccount.address} not yet deployed, deploying...`);
        const deployHash = await smartAccountClient.sendUserOperation({
            calls: [{ to: safeAccount.address, data: "0x" as Hex, value: 0n }],
        });
        await pimlicoClient.waitForUserOperationReceipt({ hash: deployHash });
        console.error(`DEPLOY: Safe deployed`);

        // Subscribe Safe as agent on AegisModule
        const subHash = await walletClient.writeContract({
            address: moduleAddress,
            abi: AEGIS_MODULE_ABI,
            functionName: "subscribeAgent",
            args: [safeAccount.address, BigInt("50000000000000000")], // 0.05 ETH budget
        });
        await publicClient.waitForTransactionReceipt({ hash: subHash });
        console.error(`DEPLOY: Safe subscribed as agent (0.05 ETH budget)`);
    }

    // Submit triggerSwap as UserOperation
    const swapData = encodeFunctionData({
        abi: AEGIS_MODULE_ABI,
        functionName: "triggerSwap",
        args: [tokenAddress, amountIn, amountOutMin],
    });

    const swapHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: moduleAddress, data: swapData, value: 0n }],
    });
    const swapReceipt = await pimlicoClient.waitForUserOperationReceipt({ hash: swapHash });

    // Print ONLY the tx hash to stdout (PowerShell captures this)
    console.log(swapReceipt.receipt.transactionHash);

    process.exit(0);
}

main().catch((err) => {
    console.error(`ERR: ${err.message}`);
    process.exit(1);
});
