import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPublicClient, http, getAddress, decodeEventLog } from 'viem';
import { defineChain } from 'viem';

export const dynamic = 'force-dynamic';

const aegisTenderly = defineChain({
    id: 73578453,
    name: 'Aegis Tenderly VNet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [] } },
});

const ABI = [
    { type: 'event', name: 'AuditRequested', inputs: [{ type: 'uint256', name: 'tradeId', indexed: true }, { type: 'address', name: 'user', indexed: true }, { type: 'address', name: 'targetToken', indexed: true }, { type: 'string', name: 'firewallConfig', indexed: false }] },
    { type: 'event', name: 'ClearanceUpdated', inputs: [{ type: 'address', name: 'token', indexed: true }, { type: 'bool', name: 'approved', indexed: false }] },
    { type: 'event', name: 'ClearanceDenied', inputs: [{ type: 'address', name: 'token', indexed: true }, { type: 'uint256', name: 'riskScore', indexed: false }] },
    { type: 'event', name: 'SwapExecuted', inputs: [{ type: 'address', name: 'targetToken', indexed: true }, { type: 'uint256', name: 'amountIn', indexed: false }, { type: 'uint256', name: 'amountOut', indexed: false }] },
] as const;

const TOKEN_NAMES: Record<string, string> = {
    '0x532f27101965dd16442e59d40670faf5ebb142e4': 'BRETT',
    '0x4200000000000000000000000000000000000006': 'WETH',
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
    '0x4ed4e862860bed51a9570b96d89af5e1b0efefed': 'DEGEN',
    '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4': 'TOSHI',
    '0x000000000000000000000000000000000000000b': 'HoneypotCoin',
    '0x000000000000000000000000000000000000000c': 'TaxToken',
    '0x0000000000000000000000000000000000000010': 'TimeBomb',
};

function tokenName(addr: string) {
    return TOKEN_NAMES[addr.toLowerCase()] || addr.slice(0, 8) + '…';
}

export async function GET() {
    try {
        const envPath = path.resolve(process.cwd(), '../.env');
        if (!fs.existsSync(envPath)) throw new Error('.env not found');
        const env: Record<string, string> = {};
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const [k, ...rest] = line.split('=');
            if (k && rest.length) env[k.trim()] = rest.join('=').trim();
        });

        const rpc = env.TENDERLY_RPC_URL;
        const moduleAddr = getAddress(env.AEGIS_MODULE_ADDRESS);
        const tenderlyId = env.TENDERLY_TESTNET_UUID || rpc.match(/\/([0-9a-f-]{36})$/i)?.[1] || '';
        const explorerBase = tenderlyId
            ? `https://dashboard.tenderly.co/aegis/project/testnet/${tenderlyId}/tx`
            : 'https://dashboard.tenderly.co/tx/base';

        const publicClient = createPublicClient({ chain: aegisTenderly, transport: http(rpc) });

        // Fetch all events from genesis of this VNet
        const fromBlock = BigInt(0);

        const [auditLogs, clearedLogs, deniedLogs, swapLogs] = await Promise.all([
            publicClient.getLogs({ address: moduleAddr, event: ABI[0], fromBlock }).catch(() => []),
            publicClient.getLogs({ address: moduleAddr, event: ABI[1], fromBlock }).catch(() => []),
            publicClient.getLogs({ address: moduleAddr, event: ABI[2], fromBlock }).catch(() => []),
            publicClient.getLogs({ address: moduleAddr, event: ABI[3], fromBlock }).catch(() => []),
        ]);

        type EventEntry = {
            txHash: string;
            blockNumber: string;
            type: string;
            token: string;
            agent?: string;
            riskCode?: number;
            approved?: boolean;
            status: 'Cleared' | 'Blocked' | 'Pending' | 'Swap';
            explorerUrl: string;
        };

        const events: EventEntry[] = [];

        for (const log of auditLogs) {
            try {
                const d = decodeEventLog({ abi: ABI, eventName: 'AuditRequested', topics: log.topics, data: log.data });
                events.push({
                    txHash: log.transactionHash || '',
                    blockNumber: log.blockNumber?.toString() || '0',
                    type: 'AuditRequested',
                    token: tokenName((d as any).targetToken),
                    agent: (d as any).user,
                    status: 'Pending',
                    explorerUrl: `${explorerBase}/${log.transactionHash}`,
                });
            } catch { /* skip decode errors */ }
        }

        for (const log of clearedLogs) {
            try {
                const d = decodeEventLog({ abi: ABI, eventName: 'ClearanceUpdated', topics: log.topics, data: log.data });
                events.push({
                    txHash: log.transactionHash || '',
                    blockNumber: log.blockNumber?.toString() || '0',
                    type: 'ClearanceUpdated',
                    token: tokenName((d as any).token),
                    approved: (d as any).approved,
                    status: (d as any).approved ? 'Cleared' : 'Blocked',
                    explorerUrl: `${explorerBase}/${log.transactionHash}`,
                });
            } catch { /* skip */ }
        }

        for (const log of deniedLogs) {
            try {
                const d = decodeEventLog({ abi: ABI, eventName: 'ClearanceDenied', topics: log.topics, data: log.data });
                events.push({
                    txHash: log.transactionHash || '',
                    blockNumber: log.blockNumber?.toString() || '0',
                    type: 'ClearanceDenied',
                    token: tokenName((d as any).token),
                    riskCode: Number((d as any).riskScore),
                    status: 'Blocked',
                    explorerUrl: `${explorerBase}/${log.transactionHash}`,
                });
            } catch { /* skip */ }
        }

        for (const log of swapLogs) {
            try {
                const d = decodeEventLog({ abi: ABI, eventName: 'SwapExecuted', topics: log.topics, data: log.data });
                events.push({
                    txHash: log.transactionHash || '',
                    blockNumber: log.blockNumber?.toString() || '0',
                    type: 'SwapExecuted',
                    token: tokenName((d as any).targetToken),
                    status: 'Swap' as any,
                    explorerUrl: `${explorerBase}/${log.transactionHash}`,
                });
            } catch { /* skip */ }
        }

        // Sort newest first by blockNumber
        events.sort((a, b) => parseInt(b.blockNumber) - parseInt(a.blockNumber));

        return NextResponse.json({ events: events.slice(0, 50) });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
