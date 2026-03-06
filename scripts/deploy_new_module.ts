/**
 * Deploy a NEW AegisModule (independent of existing setup)
 * for verifying ERC-7579 executor installation on a Safe.
 * 
 * Usage: pnpm ts-node --transpile-only scripts/deploy_new_module.ts
 */
// @ts-nocheck
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

async function main() {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    if (!ownerPk) { console.error("❌ Missing PRIVATE_KEY"); process.exit(1); }

    const owner = privateKeyToAccount(ownerPk);
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account: owner, chain: baseSepolia, transport: http(RPC_URL) });

    console.log(`\n🛡️  Deploying NEW AegisModule (independent of existing setup)`);
    console.log(`   Deployer: ${owner.address}`);

    // Read the compiled artifact
    const artifactPath = path.join(__dirname, "../out/AegisModule.sol/AegisModule.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const bytecode = artifact.bytecode.object as Hex;
    const abi = artifact.abi;

    // Deploy with keystoneForwarder = 0x0...001 (placeholder)
    const deployHash = await walletClient.deployContract({
        abi,
        bytecode,
        args: ["0x0000000000000000000000000000000000000001"],
    });

    console.log(`   Deploy tx: ${deployHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const newModuleAddress = receipt.contractAddress!;
    console.log(`   ✅ NEW AegisModule deployed at: ${newModuleAddress}`);

    // Save to a separate file (NOT .env)
    const outFile = path.join(__dirname, "../NEW_MODULE_ADDRESS.txt");
    fs.writeFileSync(outFile, `NEW_AEGIS_MODULE=${newModuleAddress}\n`);
    console.log(`   Saved to: NEW_MODULE_ADDRESS.txt`);

    // Verify owner
    const currentOwner = await publicClient.readContract({
        address: newModuleAddress as Address,
        abi,
        functionName: "owner",
    });
    console.log(`   Owner (from constructor): ${currentOwner}`);
    console.log(`   ✅ Owner matches deployer: ${(currentOwner as string).toLowerCase() === owner.address.toLowerCase()}`);
}

main().catch(err => { console.error("💥", err.message); process.exit(1); });
