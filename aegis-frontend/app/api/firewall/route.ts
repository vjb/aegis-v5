import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPublicClient, createWalletClient, http, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export const dynamic = 'force-dynamic';

const FIREWALL_ABI = [
    {
        type: 'function', name: 'firewallConfig',
        inputs: [], outputs: [{ type: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function', name: 'setFirewallConfig',
        inputs: [{ type: 'string', name: '_config' }], outputs: [],
        stateMutability: 'nonpayable',
    },
] as const;

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '../.env');
    const env: Record<string, string> = {};
    if (!fs.existsSync(envPath)) return env;
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [k, ...rest] = line.split('=');
        if (k && rest.length) env[k.trim()] = rest.join('=').trim();
    });
    return env;
}

function getRpc(env: Record<string, string>): string | undefined {
    return env.BASE_SEPOLIA_RPC_URL;
}

// GET — read current on-chain firewallConfig
export async function GET() {
    try {
        const env = loadEnv();
        const rpc = getRpc(env);
        const moduleAddrRaw = env.AEGIS_MODULE_ADDRESS;
        if (!rpc || !moduleAddrRaw) {
            return NextResponse.json({ error: 'RPC URL or AEGIS_MODULE_ADDRESS not set in .env' }, { status: 500 });
        }
        const moduleAddr = getAddress(moduleAddrRaw);
        const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });

        const raw = await publicClient.readContract({
            address: moduleAddr,
            abi: FIREWALL_ABI,
            functionName: 'firewallConfig',
        }) as string;

        let config: Record<string, unknown> = {};
        try { config = JSON.parse(raw); } catch { /* malformed JSON, return raw */ }

        return NextResponse.json({ raw, config });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST — call setFirewallConfig() on-chain
export async function POST(req: NextRequest) {
    try {
        const { config } = await req.json();
        if (!config || typeof config !== 'object') {
            return NextResponse.json({ error: 'config object required' }, { status: 400 });
        }

        const env = loadEnv();
        const rpc = getRpc(env);
        const moduleAddrRaw = env.AEGIS_MODULE_ADDRESS;
        const ownerKey = env.PRIVATE_KEY;
        if (!rpc || !moduleAddrRaw || !ownerKey) {
            return NextResponse.json({ error: 'RPC URL, AEGIS_MODULE_ADDRESS or PRIVATE_KEY missing in .env' }, { status: 500 });
        }

        const moduleAddr = getAddress(moduleAddrRaw);
        const account = privateKeyToAccount(ownerKey as `0x${string}`);
        const walletClient = createWalletClient({ chain: baseSepolia, transport: http(rpc), account });

        const configJson = JSON.stringify(config);
        const hash = await walletClient.writeContract({
            address: moduleAddr,
            abi: FIREWALL_ABI,
            functionName: 'setFirewallConfig',
            args: [configJson],
        });

        const explorerUrl = `https://sepolia.basescan.org/tx/${hash}`;

        return NextResponse.json({ hash, explorerUrl, configJson });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
