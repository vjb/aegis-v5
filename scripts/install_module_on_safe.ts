/**
 * Deploy a NEW Safe and install the new AegisModule as an ERC-7579 Executor.
 * 
 * This is independent of the existing Safe at 0xC006...
 * The new module address is read from NEW_MODULE_ADDRESS.txt.
 * 
 * Usage: pnpm ts-node --transpile-only scripts/install_module_on_safe.ts
 */
// @ts-nocheck
import {
    createPublicClient,
    createWalletClient,
    http,
    getAddress,
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
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_BUNDLER_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

async function main() {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    if (!ownerPk) { console.error("❌ Missing PRIVATE_KEY"); process.exit(1); }
    if (!PIMLICO_API_KEY) { console.error("❌ Missing PIMLICO_API_KEY"); process.exit(1); }

    // Read new module address
    const addrFile = path.join(__dirname, "../NEW_MODULE_ADDRESS.txt");
    const addrContent = fs.readFileSync(addrFile, "utf-8");
    const match = addrContent.match(/NEW_AEGIS_MODULE=(0x[a-fA-F0-9]+)/);
    if (!match) { console.error("❌ Could not find NEW_AEGIS_MODULE in NEW_MODULE_ADDRESS.txt"); process.exit(1); }
    const newModuleAddress = getAddress(match[1]) as Address;

    const owner = privateKeyToAccount(ownerPk);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🛡️  Install AegisModule as ERC-7579 Executor on NEW Safe");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Owner:      ${owner.address}`);
    console.log(`  New Module: ${newModuleAddress}`);
    console.log("");

    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_BUNDLER_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    // Create Safe with a unique salt (so it's a new Safe)
    const saltNonce = BigInt(Date.now());
    console.log(`[1/4] Creating Safe Smart Account (salt: ${saltNonce})...`);

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        saltNonce,
    });

    console.log(`  Safe (counterfactual): ${safeAccount.address}`);

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_BUNDLER_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    // Step 1: Deploy the Safe (first UserOp deploys the proxy)
    // Step 2: Install AegisModule as TYPE_EXECUTOR (type=2 for executor in ERC-7579)
    console.log(`[2/4] Deploying Safe + installing AegisModule as executor...`);

    // ERC-7579: installModule(uint256 moduleTypeId, address module, bytes calldata initData)
    // TYPE_EXECUTOR = 2
    const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [{
            to: safeAccount.address,
            data: encodeFunctionData_installModule(2, newModuleAddress, "0x"),
            value: 0n,
        }],
    });

    console.log(`  UserOp: ${userOpHash}`);

    const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log(`  ✅ Safe deployed in block ${receipt.receipt.blockNumber}`);
    console.log(`  Tx: ${receipt.receipt.transactionHash}`);

    // Step 3: Verify module is installed
    console.log(`[3/4] Verifying module installation...`);

    // Check if AegisModule.owner() is now the Safe
    const moduleOwner = await publicClient.readContract({
        address: newModuleAddress,
        abi: [{ name: "owner", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }],
        functionName: "owner",
    });
    console.log(`  AegisModule.owner() = ${moduleOwner}`);
    console.log(`  Safe address         = ${safeAccount.address}`);

    // Check if onInstall set the owner to the Safe
    const ownerMatchesSafe = (moduleOwner as string).toLowerCase() === safeAccount.address.toLowerCase();

    // Step 4: Report
    console.log(`\n[4/4] Results:`);
    if (ownerMatchesSafe) {
        console.log(`  ✅ SUCCESS — AegisModule.owner() == Safe address`);
        console.log(`  The module is properly installed as an ERC-7579 executor.`);
    } else {
        console.log(`  ⚠️  AegisModule.owner() is ${moduleOwner} (not the Safe)`);
        console.log(`  This means onInstall() was not called by the Safe, or owner was already set by constructor.`);
    }

    // Save results
    const resultFile = path.join(__dirname, "../NEW_SAFE_ADDRESS.txt");
    fs.writeFileSync(resultFile, `NEW_SAFE=${safeAccount.address}\nNEW_MODULE=${newModuleAddress}\nOWNER_MATCHES_SAFE=${ownerMatchesSafe}\n`);
    console.log(`\n  Saved to: NEW_SAFE_ADDRESS.txt`);
    console.log("═══════════════════════════════════════════════════════════════\n");
}

// Manual ABI encoding for installModule(uint256, address, bytes)
function encodeFunctionData_installModule(moduleType: number, module: Address, initData: Hex): Hex {
    // Function selector: installModule(uint256,address,bytes)
    // keccak256("installModule(uint256,address,bytes)") = 0x...
    const { encodeFunctionData } = require("viem");
    return encodeFunctionData({
        abi: [{
            name: "installModule",
            type: "function",
            inputs: [
                { name: "moduleTypeId", type: "uint256" },
                { name: "module", type: "address" },
                { name: "initData", type: "bytes" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
        }],
        functionName: "installModule",
        args: [BigInt(moduleType), module, initData],
    });
}

main().catch(err => { console.error("💥", err.message || err); process.exit(1); });
