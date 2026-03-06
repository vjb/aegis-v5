// @ts-nocheck
/**
 * V5 Audit UserOp — Submit requestAudit via ERC-7579 Session Key
 *
 * The agent signs this UserOp with its SESSION KEY — the owner's private key
 * is NOT used. SmartSessionsValidator validates the permission scope.
 *
 * Usage:
 *   pnpm ts-node --transpile-only scripts/v5_audit_userop.ts <tokenAddress>
 *
 * Output: Prints tx hash to stdout for PowerShell capture.
 */

import { getAddress, encodeFunctionData, parseEther, type Address, type Hex } from "viem";
import { createSessionClients, sendSessionKeyUserOp } from "./v5_session_utils";
import * as dotenv from "dotenv";

dotenv.config();

const AEGIS_MODULE_ABI = [
    {
        name: "requestAudit", type: "function", stateMutability: "nonpayable",
        inputs: [{ name: "_token", type: "address" }], outputs: []
    },
    {
        name: "subscribeAgent", type: "function", stateMutability: "nonpayable",
        inputs: [
            { name: "_agent", type: "address" },
            { name: "_budget", type: "uint256" },
        ], outputs: []
    },
] as const;

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error("Usage: v5_audit_userop.ts <tokenAddress>");
        process.exit(1);
    }

    const tokenAddress = getAddress(args[0]) as Address;
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    const agentPk = process.env.AGENT_PRIVATE_KEY as Hex;
    const moduleAddress = getAddress(process.env.AEGIS_MODULE_ADDRESS!) as Address;

    if (!ownerPk || !agentPk || !moduleAddress || !process.env.PIMLICO_API_KEY) {
        console.error("ERR: Missing PRIVATE_KEY, AGENT_PRIVATE_KEY, AEGIS_MODULE_ADDRESS, or PIMLICO_API_KEY");
        process.exit(1);
    }

    const clients = await createSessionClients(ownerPk, agentPk, moduleAddress);
    const { safeAccount, publicClient, walletClient, pimlicoClient } = clients;

    console.error(`SESSION_KEY: Agent ${clients.agent.address} signing via SmartSessions`);
    console.error(`SAFE: ${safeAccount.address}`);

    // Deploy Safe if needed
    const code = await publicClient.getCode({ address: safeAccount.address });
    if (!code || code === "0x") {
        console.error(`DEPLOY: Safe not yet deployed, deploying with SmartSessions...`);
        const deployHash = await clients.smartAccountClient.sendUserOperation({
            calls: [{ to: safeAccount.address, data: "0x" as Hex, value: 0n }],
        });
        await pimlicoClient.waitForUserOperationReceipt({ hash: deployHash });
        console.error(`DEPLOY: Safe deployed with SmartSessions pre-installed`);
    }

    // Check agent allowance — subscribe if needed
    const allowance = await publicClient.readContract({
        address: moduleAddress,
        abi: [{
            name: "agentAllowances", type: "function", stateMutability: "view",
            inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }]
        }] as const,
        functionName: "agentAllowances",
        args: [safeAccount.address],
    });

    if (allowance < BigInt("10000000000000000")) {
        console.error(`SUBSCRIBE: Safe allowance is ${allowance}, subscribing with 0.05 ETH budget...`);
        const subHash = await walletClient.writeContract({
            address: moduleAddress,
            abi: AEGIS_MODULE_ABI,
            functionName: "subscribeAgent",
            args: [safeAccount.address, BigInt("50000000000000000")],
        });
        await publicClient.waitForTransactionReceipt({ hash: subHash });
        console.error(`SUBSCRIBE: Safe subscribed as agent (0.05 ETH budget)`);
    } else {
        console.error(`AGENT: Allowance ${allowance} wei — OK`);
    }

    // Submit requestAudit via SESSION KEY
    const auditData = encodeFunctionData({
        abi: AEGIS_MODULE_ABI,
        functionName: "requestAudit",
        args: [tokenAddress],
    });

    console.error(`AUDIT: Submitting requestAudit(${tokenAddress}) via session key...`);
    const txHash = await sendSessionKeyUserOp(auditData, moduleAddress, clients);

    // Print ONLY the tx hash to stdout (PowerShell captures this)
    console.log(txHash);
    process.exit(0);
}

main().catch((err) => {
    console.error(`ERR: ${err.message}`);
    process.exit(1);
});
