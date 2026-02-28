import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPublicClient, createWalletClient, http, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export const dynamic = 'force-dynamic';

const ABI = [
    { type: 'function', name: 'agentAllowances', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { type: 'function', name: 'subscribeAgent', inputs: [{ type: 'address', name: 'agent' }, { type: 'uint256', name: 'budget' }], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'unsubscribeAgent', inputs: [{ type: 'address', name: 'agent' }], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'getTreasuryBalance', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { type: 'event', name: 'AgentSubscribed', inputs: [{ type: 'address', name: 'agent', indexed: true }, { type: 'uint256', name: 'budget', indexed: false }] },
] as const;

// Agent name registry — matches the frontend AgentsTab.tsx KNOWN_NAMES
const KNOWN_NAMES: Record<string, string> = {
    '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce': 'NOVA',
    '0x6e9972213bf459853fa33e28ab7219e9157c8d02': 'CIPHER',
    '0x7b1afe2745533d852d6fd5a677f14c074210d896': 'REX',
    '0xf5a5e415061470a8b9137959180901aea72450a4': 'PHANTOM',
    '0x1111111111111111111111111111111111111111': 'ALPHA',
    '0x2222222222222222222222222222222222222222': 'SIGMA',
    '0x3333333333333333333333333333333333333333': 'OMEGA',
};

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '../.env');
    if (!fs.existsSync(envPath)) throw new Error('.env not found at ' + envPath);
    const env: Record<string, string> = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [k, ...rest] = line.split('=');
        if (k && rest.length) env[k.trim()] = rest.join('=').trim();
    });
    return env;
}

function getClients(env: Record<string, string>) {
    let pk = env.PRIVATE_KEY || '';
    if (!pk.startsWith('0x')) pk = `0x${pk}`;
    const rpc = env.BASE_SEPOLIA_RPC_URL || env.TENDERLY_RPC_URL || 'https://sepolia.base.org';
    const moduleAddr = env.AEGIS_MODULE_ADDRESS;
    const account = privateKeyToAccount(pk as `0x${string}`);
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
    const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpc) });
    return { publicClient, walletClient, account, moduleAddr: getAddress(moduleAddr) };
}

// ── GET /api/agents?addresses=0x1,0x2  → reads real agentAllowances ──────────
export async function GET(req: NextRequest) {
    try {
        const env = loadEnv();
        const { publicClient, moduleAddr } = getClients(env);

        // Progressive block range — try larger range first, fall back if RPC limits
        const currentBlock = await publicClient.getBlockNumber();
        let logs: any[] = [];
        const ranges = [BigInt(50000), BigInt(9000), BigInt(2000)];
        for (const range of ranges) {
            const fromBlock = currentBlock > range ? currentBlock - range : BigInt(0);
            try {
                logs = await publicClient.getLogs({
                    address: moduleAddr,
                    event: { type: 'event', name: 'AgentSubscribed', inputs: [{ type: 'address', name: 'agent', indexed: true }, { type: 'uint256', name: 'budget', indexed: false }] } as any,
                    fromBlock,
                });
                break; // success
            } catch (e: any) {
                if (e.message?.includes('413') || e.message?.includes('10,000')) continue; // try smaller range
                throw e;
            }
        }

        // Get unique agent addresses from events
        const seen = new Set<string>();
        const addresses: string[] = [];
        for (const log of logs) {
            const addr = (log.topics[1] as string);
            // Decode indexed address from topic (32 bytes → last 20 bytes)
            const decoded = '0x' + addr.slice(-40);
            if (!seen.has(decoded.toLowerCase())) { seen.add(decoded.toLowerCase()); addresses.push(decoded); }
        }

        // Fallback: also check known agent addresses from .env
        const knownAgents = [
            env.AGENT_WALLET_ADDRESS,
            env.DEV_WALLET_ADDRESS,
        ].filter(Boolean).map(a => a!.toLowerCase());
        for (const ka of knownAgents) {
            if (!seen.has(ka)) { seen.add(ka); addresses.push(ka); }
        }

        // Read allowances for each
        const agents = await Promise.all(addresses.map(async addr => {
            const allowance = await publicClient.readContract({
                address: moduleAddr, abi: ABI, functionName: 'agentAllowances', args: [addr as `0x${string}`]
            }).catch(() => BigInt(0));
            return {
                address: addr,
                name: KNOWN_NAMES[addr.toLowerCase()] || addr.slice(2, 8).toUpperCase(),
                allowance: allowance.toString(),
                allowanceEth: (Number(allowance) / 1e18).toFixed(6),
                active: allowance > BigInt(0),
            };
        }));

        // Filter out agents with zero allowance that were only found via fallback (not from events)
        const filteredAgents = agents.filter(a => a.active || logs.some((l: any) => ('0x' + (l.topics[1] as string).slice(-40)).toLowerCase() === a.address.toLowerCase()));

        // Also get treasury balance
        let treasury = '0';
        try {
            const bal = await publicClient.getBalance({ address: moduleAddr });
            treasury = (Number(bal) / 1e18).toFixed(6);
        } catch { /* module may not hold ETH directly */ }

        return NextResponse.json({ agents: filteredAgents, treasury, moduleAddress: moduleAddr });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── POST /api/agents → subscribeAgent or unsubscribeAgent ────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, agentAddress, budgetEth } = body;

        const env = loadEnv();
        const { walletClient, publicClient, moduleAddr } = getClients(env);

        let hash: string;

        if (action === 'subscribe') {
            const budgetWei = BigInt(Math.floor(parseFloat(budgetEth) * 1e18));
            hash = await walletClient.writeContract({
                address: moduleAddr, abi: ABI, functionName: 'subscribeAgent',
                args: [getAddress(agentAddress), budgetWei],
            });
        } else if (action === 'revoke') {
            hash = await walletClient.writeContract({
                address: moduleAddr, abi: ABI, functionName: 'unsubscribeAgent',
                args: [getAddress(agentAddress)],
            });
        } else {
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
        return NextResponse.json({ success: true, hash });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
