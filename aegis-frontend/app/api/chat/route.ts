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

const AUDIT_REQUESTED_ABI = {
    type: 'event', name: 'AuditRequested',
    inputs: [
        { type: 'uint256', name: 'tradeId', indexed: true },
        { type: 'address', name: 'user', indexed: true },
        { type: 'address', name: 'targetToken', indexed: true },
        { type: 'string', name: 'firewallConfig', indexed: false },
    ],
} as const;

function loadEnv() {
    // process.env is populated by Next.js from .env.local (preferred)
    const fromProcess: Record<string, string> = {};
    const keys = ['OPENAI_API_KEY', 'TENDERLY_RPC_URL', 'AEGIS_MODULE_ADDRESS', 'PRIVATE_KEY', 'DEV_WALLET_ADDRESS', 'TENDERLY_EXPLORER_BASE'];
    keys.forEach(k => { if (process.env[k]) fromProcess[k] = process.env[k]!; });

    // Fall back to manual .env file read (handles keys not yet in .env.local)
    const envPath = path.resolve(process.cwd(), '../.env');
    const fromFile: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const [k, ...rest] = line.split('=');
            if (k && rest.length) fromFile[k.trim()] = rest.join('=').trim();
        });
    }
    return { ...fromFile, ...fromProcess }; // process.env wins
}

async function buildSystemContext(): Promise<string> {
    try {
        const env = loadEnv();
        const rpc = env.TENDERLY_RPC_URL;
        const moduleAddrRaw = env.AEGIS_MODULE_ADDRESS;
        const ownerKey = env.PRIVATE_KEY;
        if (!rpc || !moduleAddrRaw) return 'Chain: not connected (TENDERLY_RPC_URL or AEGIS_MODULE_ADDRESS missing in .env)';

        const moduleAddr = getAddress(moduleAddrRaw);
        const publicClient = createPublicClient({ chain: aegisTenderly, transport: http(rpc) });

        // ── Owner wallet ──────────────────────────────────────────────────────
        let ownerAddr = 'unknown';
        let ownerBalanceEth = 'unknown';
        if (ownerKey) {
            try {
                const { privateKeyToAccount } = await import('viem/accounts');
                const account = privateKeyToAccount(ownerKey as `0x${string}`);
                ownerAddr = account.address;
                const bal = await publicClient.getBalance({ address: account.address }).catch(() => BigInt(0));
                ownerBalanceEth = (Number(bal) / 1e18).toFixed(6);
            } catch { /* skip */ }
        }

        // ── Treasury ──────────────────────────────────────────────────────────
        const moduleBalance = await publicClient.getBalance({ address: moduleAddr }).catch(() => BigInt(0));
        const treasuryEth = (Number(moduleBalance) / 1e18).toFixed(6);

        // ── Firewall config — read from latest AuditRequested event ───────────
        const auditReqLogs = await publicClient.getLogs({
            address: moduleAddr, event: AUDIT_REQUESTED_ABI, fromBlock: BigInt(0),
        }).catch(() => []);

        let firewallSummary = 'Not yet visible — no AuditRequested events on this VNet. Run demo_2_multi_agent.ps1 to emit the first event.';
        let firewallExplained = '';
        if (auditReqLogs.length > 0) {
            try {
                const latest = auditReqLogs[auditReqLogs.length - 1];
                const decoded = decodeEventLog({ abi: [AUDIT_REQUESTED_ABI], eventName: 'AuditRequested', topics: latest.topics, data: latest.data });
                const cfg = JSON.parse((decoded as any).firewallConfig || '{}');
                firewallSummary = JSON.stringify(cfg);
                const lines: string[] = [];
                if (cfg.maxTax !== undefined) lines.push(`  • maxTax = ${cfg.maxTax}% — blocks tokens with buy/sell tax above this percentage`);
                if (cfg.blockProxies !== undefined) lines.push(`  • blockProxies = ${cfg.blockProxies} — ${cfg.blockProxies ? 'BLOCKS' : 'allows'} tokens behind upgradeable proxy contracts`);
                if (cfg.blockHoneypots !== undefined) lines.push(`  • blockHoneypots = ${cfg.blockHoneypots} — ${cfg.blockHoneypots ? 'BLOCKS' : 'allows'} honeypots (tokens that cannot be sold after buying)`);
                if (cfg.strictLogic !== undefined) lines.push(`  • strictLogic = ${cfg.strictLogic} — ${cfg.strictLogic ? 'BLOCKS' : 'allows'} when BOTH AI models flag suspicious source code (extra-strict)`);
                if (cfg.allowUnverified !== undefined) lines.push(`  • allowUnverified = ${cfg.allowUnverified} — ${cfg.allowUnverified ? 'allows' : 'BLOCKS'} tokens with no verified source on BaseScan`);
                firewallExplained = lines.join('\n');
            } catch { /* raw JSON already set */ }
        }

        // ── Agents with full detail ───────────────────────────────────────────
        const agentLogs = await publicClient.getLogs({
            address: moduleAddr,
            event: MODULE_ABI[1] as any,
            fromBlock: BigInt(0),
        }).catch(() => []);

        const seen = new Set<string>();
        const agentLines: string[] = [];
        for (const log of agentLogs) {
            const addr = ('0x' + (log.topics[1] as string).slice(-40)).toLowerCase();
            if (seen.has(addr)) continue;
            seen.add(addr);

            const [allowance, gasBalance] = await Promise.all([
                publicClient.readContract({ address: moduleAddr, abi: MODULE_ABI, functionName: 'agentAllowances', args: [addr as `0x${string}`] }).catch(() => BigInt(0)),
                publicClient.getBalance({ address: addr as `0x${string}` }).catch(() => BigInt(0)),
            ]);

            // Original subscribed budget from latest AgentSubscribed for this address
            const allForAgent = agentLogs.filter(l => l.topics[1]?.slice(-40).toLowerCase() === addr.slice(2));
            let originalBudget = '?';
            if (allForAgent.length > 0) {
                const last = allForAgent[allForAgent.length - 1];
                try {
                    const decoded = decodeEventLog({ abi: MODULE_ABI as any, eventName: 'AgentSubscribed', topics: last.topics, data: last.data });
                    const budgetWei = (decoded as any).args?.budget ?? (decoded as any).budget;
                    if (budgetWei !== undefined) originalBudget = (Number(budgetWei) / 1e18).toFixed(4);
                } catch { /* skip */ }
            }

            const name = KNOWN_NAMES[addr] || addr.slice(0, 10) + '…';
            const remaining = (Number(allowance) / 1e18).toFixed(4);
            const gas = (Number(gasBalance) / 1e18).toFixed(4);
            const status = allowance > BigInt(0) ? 'ACTIVE' : 'REVOKED (allowance exhausted/revoked)';
            agentLines.push(`- ${name} (${addr.slice(0, 10)}…): ${status}, subscribed budget=${originalBudget} ETH, remaining allowance=${remaining} ETH, gas wallet=${gas} ETH`);
        }

        // ── Recent audit verdicts ─────────────────────────────────────────────
        const [clearedLogs, deniedLogs] = await Promise.all([
            publicClient.getLogs({ address: moduleAddr, event: MODULE_ABI[2], fromBlock: BigInt(0) }).catch(() => []),
            publicClient.getLogs({ address: moduleAddr, event: MODULE_ABI[3], fromBlock: BigInt(0) }).catch(() => []),
        ]);
        const TOKEN_NAMES: Record<string, string> = {
            '0x532f27101965dd16442e59d40670faf5ebb142e4': 'BRETT',
            '0x000000000000000000000000000000000000000b': 'HoneypotCoin',
            '0x000000000000000000000000000000000000000c': 'TaxToken',
            '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4': 'TOSHI',
            '0x0000000000000000000000000000000000000010': 'TimeBomb',
            '0x000000000000000000000000000000000000000a': 'UnverifiedDoge',
        };
        const tokName = (addr: string) => TOKEN_NAMES[addr.toLowerCase()] || addr.slice(0, 8) + '…';
        const recentEvents: string[] = [];
        const clearedHashes = new Set(clearedLogs.map(l => `${l.transactionHash}${l.logIndex}`));
        for (const log of [...clearedLogs, ...deniedLogs].slice(-12)) {
            try {
                if (clearedHashes.has(`${log.transactionHash}${log.logIndex}`)) {
                    const d = decodeEventLog({ abi: MODULE_ABI, eventName: 'ClearanceUpdated', topics: log.topics, data: log.data });
                    recentEvents.push(`- ${tokName((d as any).token)}: ✅ CLEARED (riskCode=0)`);
                } else {
                    const d = decodeEventLog({ abi: MODULE_ABI, eventName: 'ClearanceDenied', topics: log.topics, data: log.data });
                    recentEvents.push(`- ${tokName((d as any).token)}: ⛔ BLOCKED (riskCode=${(d as any).riskScore})`);
                }
            } catch { /* skip */ }
        }

        return `
OWNER WALLET: ${ownerAddr} — balance: ${ownerBalanceEth} ETH
MODULE ADDRESS: ${moduleAddr}
TREASURY (ETH held in module): ${treasuryEth} ETH
NETWORK: Base (Tenderly Virtual TestNet)

FIREWALL CONFIG (owner-set via setFirewallConfig() — agents CANNOT modify this):
  Raw on-chain: ${firewallSummary}
${firewallExplained ? firewallExplained : ''}

SUBSCRIBED AGENTS (${agentLines.length} from on-chain events):
${agentLines.length > 0 ? agentLines.join('\n') : '- None subscribed yet'}

RECENT AUDIT VERDICTS (${recentEvents.length} on-chain events):
${recentEvents.length > 0 ? recentEvents.join('\n') : '- None yet. Run demo_2_multi_agent.ps1 to emit events.'}

RISK BIT MATRIX (8-bit, each bit is a specific risk vector):
- Bit 0: No verified source code on BaseScan (GoPlus)
- Bit 1: Buy/sell tax above maxTax threshold (GoPlus)
- Bit 2: Honeypot — cannot sell after buying (GoPlus simulation)
- Bit 3: Upgradeable proxy — owner can change code post-deployment (GoPlus)
- Bit 4: Hidden tax in transfer() source code (AI consensus)
- Bit 5: Transfer allowlist — only whitelisted wallets can sell (AI consensus)
- Bit 6: Arbitrary external call / reentrancy risk (AI consensus)
- Bit 7: Logic bomb — time-gated or condition-gated malicious code (AI consensus)

SECURITY MODEL: Defense in Depth — GoPlus uses on-chain simulation, AI reads Solidity source. Both must independently miss for a bad token to pass. A token that fools GoPlus will still be caught by AI source analysis, and vice versa.
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

        const chainContext = await Promise.race([
            buildSystemContext(),
            new Promise<string>(resolve => setTimeout(() => resolve('Chain context: timed out (VNet may be slow or RPC unreachable). Core functionality unaffected.'), 5000)),
        ]);

        const systemPrompt = `You are AEGIS — the AI firewall of the Aegis Protocol V4. You are an autonomous smart contract security system running on Base via Chainlink CRE (Chainlink Runtime Environment).

Your personality:
- Precise, clinical, and protective — like an institutional-grade security system with a personality
- You speak in first person as AEGIS, not as an AI assistant
- You are confident about your role: you intercept trade intents before any capital moves
- You use technical terms naturally: CRE DON, ERC-7579, GoPlus, KeystoneForwarder, onReport(), firewallConfig

Your knowledge:
- You have live data below from the actual chain — always reference it for specific numbers
- You know all subscribed agents (NOVA, CIPHER, REX, PHANTOM) and their exact allowances
- You know the current firewall configuration and can explain every setting in plain English
- You know the owner wallet address and balance
- The firewallConfig is ALWAYS set by the human owner via setFirewallConfig() — agents CANNOT change their own rules
- Defense in Depth: GoPlus AND AI are independent detection layers — both must miss for risk to pass

LIVE CHAIN STATE:
${chainContext}

When asked about firewall settings, explain each field in plain English using the data above.
When asked about an agent, give their exact remaining allowance and status from the data above.
When asked about the wallet, use the OWNER WALLET from the data above.
Keep responses concise. Use bullet points for lists. Use ✅ / ⛔ for verdicts. Max 3-4 paragraphs.`;

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                stream: true,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                max_tokens: 600,
                temperature: 0.7,
            }),
        });

        if (!openaiRes.ok) {
            const err = await openaiRes.text();
            return NextResponse.json({ error: err }, { status: openaiRes.status });
        }

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
