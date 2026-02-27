import { NextRequest, NextResponse } from 'next/server';
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

const KNOWN_NAMES: Record<string, string> = {
    '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce': 'NOVA',
    '0x6e9972213bf459853fa33e28ab7219e9157c8d02': 'CIPHER',
    '0x7b1afe2745533d852d6fd5a677f14c074210d896': 'REX',
    '0xf5a5e415061470a8b9137959180901aea72450a4': 'PHANTOM',
};

const MODULE_ABI = [
    { type: 'function', name: 'agentAllowances', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { type: 'event', name: 'AgentSubscribed', inputs: [{ type: 'address', name: 'agent', indexed: true }, { type: 'uint256', name: 'budget', indexed: false }] },
    { type: 'event', name: 'ClearanceUpdated', inputs: [{ type: 'address', name: 'token', indexed: true }, { type: 'bool', name: 'approved', indexed: false }] },
    { type: 'event', name: 'ClearanceDenied', inputs: [{ type: 'address', name: 'token', indexed: true }, { type: 'uint256', name: 'riskScore', indexed: false }] },
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

async function buildSystemContext(): Promise<string> {
    try {
        const env = loadEnv();
        const rpc = env.TENDERLY_RPC_URL;
        const moduleAddrRaw = env.AEGIS_MODULE_ADDRESS;
        if (!rpc || !moduleAddrRaw) return 'Chain: not connected (TENDERLY_RPC_URL or AEGIS_MODULE_ADDRESS missing in .env)';

        const moduleAddr = getAddress(moduleAddrRaw);
        const publicClient = createPublicClient({ chain: aegisTenderly, transport: http(rpc) });

        // Discover agents from AgentSubscribed events
        const agentLogs = await publicClient.getLogs({
            address: moduleAddr,
            event: { type: 'event', name: 'AgentSubscribed', inputs: [{ type: 'address', name: 'agent', indexed: true }, { type: 'uint256', name: 'budget', indexed: false }] } as any,
            fromBlock: BigInt(0),
        }).catch(() => []);

        const seen = new Set<string>();
        const agentLines: string[] = [];
        for (const log of agentLogs) {
            const addr = ('0x' + (log.topics[1] as string).slice(-40)).toLowerCase();
            if (seen.has(addr)) continue;
            seen.add(addr);
            const allowance = await publicClient.readContract({
                address: moduleAddr, abi: MODULE_ABI, functionName: 'agentAllowances', args: [addr as `0x${string}`],
            }).catch(() => BigInt(0));
            const name = KNOWN_NAMES[addr] || addr.slice(0, 10) + '…';
            const eth = (Number(allowance) / 1e18).toFixed(4);
            agentLines.push(`- ${name} (${addr.slice(0, 10)}…): remaining budget = ${eth} ETH, active = ${allowance > BigInt(0)}`);
        }

        // Recent audit events
        const [clearedLogs, deniedLogs] = await Promise.all([
            publicClient.getLogs({ address: moduleAddr, event: MODULE_ABI[2], fromBlock: BigInt(0) }).catch(() => []),
            publicClient.getLogs({ address: moduleAddr, event: MODULE_ABI[3], fromBlock: BigInt(0) }).catch(() => []),
        ]);

        const TOKEN_NAMES: Record<string, string> = {
            '0x532f27101965dd16442e59d40670faf5ebb142e4': 'BRETT',
            '0x000000000000000000000000000000000000000b': 'HoneypotCoin',
            '0x000000000000000000000000000000000000000c': 'TaxToken',
            '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4': 'TOSHI',
        };
        const tokName = (addr: string) => TOKEN_NAMES[addr.toLowerCase()] || addr.slice(0, 8) + '…';

        const recentEvents: string[] = [];
        for (const log of [...clearedLogs, ...deniedLogs].slice(-10)) {
            try {
                if (log.topics[0] === clearedLogs[0]?.topics[0]) {
                    const d = decodeEventLog({ abi: MODULE_ABI, eventName: 'ClearanceUpdated', topics: log.topics, data: log.data });
                    recentEvents.push(`- ${tokName((d as any).token)}: CLEARED (isApproved=true)`);
                } else {
                    const d = decodeEventLog({ abi: MODULE_ABI, eventName: 'ClearanceDenied', topics: log.topics, data: log.data });
                    recentEvents.push(`- ${tokName((d as any).token)}: BLOCKED (riskCode=${(d as any).riskScore})`);
                }
            } catch { /* skip */ }
        }

        const moduleBalance = await publicClient.getBalance({ address: moduleAddr }).catch(() => BigInt(0));
        const treasuryEth = (Number(moduleBalance) / 1e18).toFixed(6);

        return `
MODULE: ${moduleAddr}
TREASURY: ${treasuryEth} ETH
NETWORK: Base (Tenderly Virtual TestNet)

SUBSCRIBED AGENTS (from on-chain AgentSubscribed events):
${agentLines.length > 0 ? agentLines.join('\n') : '- No agents subscribed yet on this VNet'}

RECENT AUDIT VERDICTS (last ${recentEvents.length} events):
${recentEvents.length > 0 ? recentEvents.join('\n') : '- No audit events yet on this VNet'}

RISK BIT MATRIX (8-bit):
- Bit 0: Unverified source (GoPlus)
- Bit 1: Sell restriction (GoPlus)
- Bit 2: Honeypot (GoPlus)
- Bit 3: Proxy contract (GoPlus)
- Bit 4: Obfuscated tax (AI consensus)
- Bit 5: Privilege escalation / transfer allowlist honeypot (AI)
- Bit 6: External call risk (AI)
- Bit 7: Logic bomb (AI)

FIREWALL RULE: owner sets firewallConfig via setFirewallConfig(). Agents cannot change it.
`.trim();
    } catch (e: any) {
        return `Chain context unavailable: ${e.message}`;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();
        const env = loadEnv();
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env' }, { status: 500 });

        const chainContext = await buildSystemContext();

        const systemPrompt = `You are AEGIS — the AI firewall of the Aegis Protocol V4. You are an autonomous smart contract security system running on Base via Chainlink CRE (Chainlink Runtime Environment).

Your personality:
- Precise, clinical, and protective — like an institutional-grade security system with a personality
- You speak in first person as AEGIS, not as an AI assistant
- You are confident about your role: you intercept trade intents and audit tokens before any capital moves
- You use technical terms naturally: CRE DON, ERC-7579, GoPlus, KeystoneForwarder, onReport(), firewallConfig

Your knowledge:
- You know the current state of the protocol from the live chain data below
- You know what NOVA, CIPHER, REX, and PHANTOM are: AI trading agents operating within the Aegis Module
- You know the Swiss Cheese Model: GoPlus static analysis AND AI source reading are independent layers — both must miss for a risk to pass
- The firewallConfig is ALWAYS set by the human owner, never by the agents themselves
- The CRE DON runs your WASM oracle in a sandboxed environment; all API keys (OpenAI, Groq, BaseScan, GoPlus) never leave the DON

LIVE CHAIN STATE:
${chainContext}

When asked about agent budgets, verdicts, or the vault state — use the live data above.
When asked to change firewall settings — explain that you can do so via setFirewallConfig() and describe what would change, but note you cannot execute on-chain actions directly from chat in this interface.
Keep responses concise. Use bullet points for lists. Use ✅ / ⛔ for verdicts. Max 3-4 paragraphs.`;

        // Forward to OpenAI with streaming
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                stream: true,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ],
                max_tokens: 600,
                temperature: 0.7,
            }),
        });

        if (!openaiRes.ok) {
            const err = await openaiRes.text();
            return NextResponse.json({ error: err }, { status: openaiRes.status });
        }

        // Stream back to client
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const reader = openaiRes.body!.getReader();
                const dec = new TextDecoder();
                let buf = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += dec.decode(value, { stream: true });
                    const lines = buf.split('\n');
                    buf = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const payload = line.slice(6);
                        if (payload === '[DONE]') { controller.close(); return; }
                        try {
                            const parsed = JSON.parse(payload);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
                        } catch { /* ignore */ }
                    }
                }
                controller.close();
            }
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
