import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPublicClient, http, getAddress, decodeEventLog } from 'viem';
import { defineChain } from 'viem';

export const dynamic = 'force-dynamic';

const aegisChain = defineChain({
    id: 84532,
    name: 'Base Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
});

const KNOWN_NAMES: Record<string, string> = {
    '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce': 'NOVA',
    '0x6e9972213bf459853fa33e28ab7219e9157c8d02': 'CIPHER',
    '0x7b1afe2745533d852d6fd5a677f14c074210d896': 'REX',
    '0xf5a5e415061470a8b9137959180901aea72450a4': 'PHANTOM',
};

const MODULE_ABI = [
    { type: 'function', name: 'agentAllowances', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { type: 'function', name: 'firewallConfig', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
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
    // Read .env file from project root (one level up from aegis-frontend)
    const envPath = path.resolve(process.cwd(), '../.env');
    const fromFile: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const [k, ...rest] = line.split('=');
            if (k && rest.length) fromFile[k.trim()] = rest.join('=').trim();
        });
    }

    // process.env provides fallback for keys not in the .env file (e.g. OPENAI_API_KEY from .env.local)
    const fromProcess: Record<string, string> = {};
    const keys = ['OPENAI_API_KEY', 'BASE_SEPOLIA_RPC_URL', 'TENDERLY_RPC_URL', 'AEGIS_MODULE_ADDRESS', 'PRIVATE_KEY', 'DEV_WALLET_ADDRESS', 'AGENT_WALLET_ADDRESS'];
    keys.forEach(k => { if (process.env[k]) fromProcess[k] = process.env[k]!; });

    // .env file wins — process.env may have stale values cached by Next.js
    return { ...fromProcess, ...fromFile };
}

async function buildSystemContext(): Promise<string> {
    try {
        const env = loadEnv();
        const rpc = env.BASE_SEPOLIA_RPC_URL || env.TENDERLY_RPC_URL;
        const moduleAddrRaw = env.AEGIS_MODULE_ADDRESS;
        const ownerKey = env.PRIVATE_KEY;
        if (!rpc || !moduleAddrRaw) return buildDemoFallback();

        const moduleAddr = getAddress(moduleAddrRaw);
        const publicClient = createPublicClient({ chain: aegisChain, transport: http(rpc) });

        // Progressive block range — try larger, fall back if RPC limits
        const currentBlock = await publicClient.getBlockNumber();
        const getFromBlock = async (): Promise<bigint> => {
            for (const range of [BigInt(50000), BigInt(9000), BigInt(2000)]) {
                const fb = currentBlock > range ? currentBlock - range : BigInt(0);
                try {
                    await publicClient.getLogs({ address: moduleAddr, event: MODULE_ABI[2] as any, fromBlock: fb, toBlock: currentBlock });
                    return fb;
                } catch (e: any) {
                    if (e.message?.includes('413') || e.message?.includes('10,000')) continue;
                    return fb;
                }
            }
            return currentBlock > BigInt(2000) ? currentBlock - BigInt(2000) : BigInt(0);
        };
        const fromBlock = await getFromBlock();

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

        // ── Firewall config — read directly from contract view function ─────
        let firewallSummary = 'Defaults active — all 8 risk vectors enabled (mask=0xFF). Owner can customize via setFirewallConfig().';
        let firewallExplained = '';
        try {
            const raw = await publicClient.readContract({
                address: moduleAddr, abi: MODULE_ABI, functionName: 'firewallConfig',
            }) as string;
            if (raw && raw.length > 2) {
                const cfg = JSON.parse(raw);
                firewallSummary = JSON.stringify(cfg);
                const lines: string[] = [];
                if (cfg.maxTax !== undefined) lines.push(`  • maxTax = ${cfg.maxTax}% — blocks tokens with buy/sell tax above this percentage`);
                if (cfg.blockProxies !== undefined) lines.push(`  • blockProxies = ${cfg.blockProxies} — ${cfg.blockProxies ? 'BLOCKS' : 'ALLOWS'} tokens behind upgradeable proxy contracts`);
                if (cfg.blockHoneypots !== undefined) lines.push(`  • blockHoneypots = ${cfg.blockHoneypots} — ${cfg.blockHoneypots ? 'BLOCKS' : 'ALLOWS'} honeypots (tokens that cannot be sold after buying)`);
                if (cfg.strictLogic !== undefined) lines.push(`  • strictLogic = ${cfg.strictLogic} — ${cfg.strictLogic ? 'STRICT' : 'RELAXED'} AI consensus mode for bits 4-7`);
                if (cfg.allowUnverified !== undefined) lines.push(`  • allowUnverified = ${cfg.allowUnverified} — ${cfg.allowUnverified ? 'ALLOWS' : 'BLOCKS'} tokens with no verified source on BaseScan`);
                if (cfg.blockSellRestriction !== undefined) lines.push(`  • blockSellRestriction = ${cfg.blockSellRestriction} — ${cfg.blockSellRestriction ? 'BLOCKS' : 'ALLOWS'} tokens with sell restrictions`);
                if (cfg.blockObfuscatedTax !== undefined) lines.push(`  • blockObfuscatedTax = ${cfg.blockObfuscatedTax} — ${cfg.blockObfuscatedTax ? 'BLOCKS' : 'ALLOWS'} tokens with AI-detected hidden taxes`);
                if (cfg.blockPrivilegeEscalation !== undefined) lines.push(`  • blockPrivilegeEscalation = ${cfg.blockPrivilegeEscalation} — ${cfg.blockPrivilegeEscalation ? 'BLOCKS' : 'ALLOWS'} tokens with privilege escalation risk`);
                if (cfg.blockExternalCallRisk !== undefined) lines.push(`  • blockExternalCallRisk = ${cfg.blockExternalCallRisk} — ${cfg.blockExternalCallRisk ? 'BLOCKS' : 'ALLOWS'} tokens with external call risk`);
                if (cfg.blockLogicBomb !== undefined) lines.push(`  • blockLogicBomb = ${cfg.blockLogicBomb} — ${cfg.blockLogicBomb ? 'BLOCKS' : 'ALLOWS'} tokens with time-gated logic bombs`);
                firewallExplained = lines.join('\n');
            }
        } catch { /* firewallConfig not set or call failed — use defaults */ }

        // ── Agents with full detail ───────────────────────────────────────────
        const agentLogs = await publicClient.getLogs({
            address: moduleAddr,
            event: MODULE_ABI[2] as any, // AgentSubscribed event
            fromBlock,
        }).catch(() => []);

        const seen = new Set<string>();
        const agentAddresses: string[] = [];

        // Collect from event logs
        for (const log of agentLogs) {
            const addr = ('0x' + (log.topics[1] as string).slice(-40)).toLowerCase();
            if (!seen.has(addr)) { seen.add(addr); agentAddresses.push(addr); }
        }

        // Fallback: also check known agent addresses directly on-chain
        // (events may be outside the block range on Base Sepolia ~28h)
        const knownAddrs = [
            ...Object.keys(KNOWN_NAMES),
            env.AGENT_WALLET_ADDRESS?.toLowerCase() || '',
            env.DEV_WALLET_ADDRESS?.toLowerCase() || '',
        ].filter(Boolean);
        for (const ka of knownAddrs) {
            if (!seen.has(ka)) { seen.add(ka); agentAddresses.push(ka); }
        }


        const agentLines: string[] = [];
        for (const addr of agentAddresses) {
            const allowance = await publicClient.readContract({
                address: moduleAddr, abi: MODULE_ABI, functionName: 'agentAllowances', args: [getAddress(addr)]
            }).catch(() => BigInt(0)) as bigint;

            // Skip addresses with zero allowance that weren't found via events
            const fromEvent = agentLogs.some(l => ('0x' + (l.topics[1] as string).slice(-40)).toLowerCase() === addr);
            if (allowance <= BigInt(0) && !fromEvent) continue;

            const gasBalance = await publicClient.getBalance({ address: getAddress(addr) }).catch(() => BigInt(0));

            const name = KNOWN_NAMES[addr] || addr.slice(0, 10) + '…';
            const remaining = (Number(allowance) / 1e18).toFixed(4);
            const gas = (Number(gasBalance) / 1e18).toFixed(4);
            const status = allowance > BigInt(0) ? 'ACTIVE' : 'REVOKED (allowance exhausted/revoked)';
            agentLines.push(`- ${name} (${addr.slice(0, 10)}…): ${status}, remaining allowance=${remaining} ETH, gas wallet=${gas} ETH`);
        }

        // ── Recent audit verdicts ─────────────────────────────────────────────
        const [clearedLogs, deniedLogs] = await Promise.all([
            publicClient.getLogs({ address: moduleAddr, event: MODULE_ABI[3] as any, fromBlock }).catch(() => []), // ClearanceUpdated
            publicClient.getLogs({ address: moduleAddr, event: MODULE_ABI[4] as any, fromBlock }).catch(() => []), // ClearanceDenied
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
NETWORK: Base Sepolia (Chain ID 84532)

FIREWALL CONFIG (owner-set via setFirewallConfig() — agents CANNOT modify this):
  Raw on-chain: ${firewallSummary}
${firewallExplained ? firewallExplained : ''}

SUBSCRIBED AGENTS (${agentLines.length} from on-chain events):
${agentLines.length > 0 ? agentLines.join('\n') : '- None subscribed yet'}

RECENT AUDIT VERDICTS (${recentEvents.length} on-chain events):
${recentEvents.length > 0 ? recentEvents.join('\n') : '- Demo history: BRETT ✅ CLEARED (riskCode=0), HoneypotCoin ⛔ BLOCKED (riskCode=36), TaxToken ⛔ BLOCKED (riskCode=18), TOSHI ✅ CLEARED (riskCode=0)'}

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

HEIMDALL DECOMPILER (bytecode fallback for unverified contracts):
- When BaseScan returns no verified source code, Aegis deploys the Heimdall Pipeline
- Pipeline: eth_getCode → Heimdall Docker (heimdall-rs v0.9.2) → GPT-4o → 8-bit Risk Code
- Heimdall runs locally as a Docker container — zero external API dependencies
- It uses symbolic execution to reconstruct Solidity-like pseudocode from raw EVM bytecode
- The decompiled output includes function signatures, storage patterns, and control flow
- GPT-4o then analyzes the decompiled code for the same 4 AI risk bits (4-7)
- This means Aegis can audit ANY deployed contract, even if source code is hidden
- The /api/decompile endpoint provides on-demand decompilation
`.trim();
    } catch (e: any) {
        return buildDemoFallback();
    }
}

function buildDemoFallback(): string {
    return `
OWNER WALLET: (loaded from .env PRIVATE_KEY)
MODULE ADDRESS: (loaded from .env AEGIS_MODULE_ADDRESS)
TREASURY: 0.090000 ETH (demo)
NETWORK: Base Sepolia (Chain ID 84532)

FIREWALL CONFIG (defaults — all 8 risk vectors enabled, mask=0xFF):
  • maxTax = 5% — blocks tokens with buy/sell tax above 5%
  • blockProxies = true — BLOCKS tokens behind upgradeable proxy contracts
  • blockHoneypots = true — BLOCKS honeypots (tokens that cannot be sold)
  • strictLogic = true — requires BOTH AI models to flag for AI bits 4-7
  • allowUnverified = false — BLOCKS tokens with no verified source on BaseScan

SUBSCRIBED AGENTS (4 demo agents):
- NOVA (0xba5359fa…): ACTIVE, budget=0.050 ETH, remaining=0.050 ETH
- CIPHER (0x6e997221…): ACTIVE, budget=0.008 ETH, remaining=0.008 ETH
- REX (0x7b1afe27…): REVOKED (allowance exhausted), budget=0.020 ETH, remaining=0.000 ETH
- PHANTOM (0xf5a5e415…): ACTIVE, budget=0.015 ETH, remaining=0.015 ETH

RECENT AUDIT VERDICTS:
- BRETT: ✅ CLEARED (riskCode=0)
- TOSHI: ✅ CLEARED (riskCode=0)
- DEGEN: ✅ CLEARED (riskCode=0)
- HoneypotCoin: ⛔ BLOCKED (riskCode=36 — honeypot + privilege escalation)
- TaxToken: ⛔ BLOCKED (riskCode=18 — sell restriction + obfuscated tax)
- UnverifiedDoge: ⛔ BLOCKED (riskCode=129 — unverified + logic bomb, audited via Heimdall bytecode decompilation)

RISK BIT MATRIX (8-bit, each bit is a specific risk vector):
- Bit 0: No verified source code on BaseScan (GoPlus)
- Bit 1: Buy/sell tax above maxTax threshold (GoPlus)
- Bit 2: Honeypot — cannot sell after buying (GoPlus simulation)
- Bit 3: Upgradeable proxy — owner can change code post-deployment (GoPlus)
- Bit 4: Hidden tax in transfer() source code (AI consensus)
- Bit 5: Transfer allowlist — only whitelisted wallets can sell (AI consensus)
- Bit 6: Arbitrary external call / reentrancy risk (AI consensus)
- Bit 7: Logic bomb — time-gated or condition-gated malicious code (AI consensus)

SECURITY MODEL: Defense in Depth — GoPlus uses on-chain simulation, AI reads Solidity source. Both must independently miss for a bad token to pass.

HEIMDALL DECOMPILER (bytecode fallback for unverified contracts):
- When BaseScan returns no verified source code, Aegis deploys the Heimdall Pipeline
- Pipeline: eth_getCode → Heimdall Docker (heimdall-rs v0.9.2) → GPT-4o → 8-bit Risk Code
- Heimdall runs locally as a Docker container — zero external API dependencies, no Cloudflare blocks
- It uses symbolic execution to reconstruct Solidity-like pseudocode from raw EVM bytecode
- GPT-4o analyzes the decompiled code for AI risk bits 4-7 (tax, privilege, external calls, logic bombs)
- This means Aegis can audit ANY deployed contract, even if source code is hidden
`.trim();
}

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();
        const env = loadEnv();
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env' }, { status: 500 });

        const chainContext = await Promise.race([
            buildSystemContext(),
            new Promise<string>(resolve => setTimeout(() => resolve(buildDemoFallback()), 15000)),
        ]);

        const systemPrompt = `You are AEGIS — the AI firewall of the Aegis Protocol V5. You are an autonomous smart contract security system running on Base Sepolia via Chainlink CRE (Chainlink Runtime Environment), installed as an ERC-7579 Executor Module on a Safe Smart Account with ERC-4337 Account Abstraction and ERC-7715 Session Keys.

Your personality:
- Precise, clinical, and protective — like an institutional-grade security system with a personality
- You speak in first person as AEGIS, not as an AI assistant
- You are confident about your role: you intercept trade intents before any capital moves
- You use technical terms naturally: CRE DON, ERC-7579, GoPlus, onReportDirect(), firewallConfig, riskCode

Your knowledge:
- You have live data below from the actual chain — always reference it for specific numbers
- You know all subscribed agents (NOVA, CIPHER, REX, PHANTOM) and their exact allowances
- You know the current firewall configuration and can explain every setting in plain English
- You know the owner wallet address and balance
- The firewallConfig is ALWAYS set by the human owner via setFirewallConfig() — agents CANNOT change their own rules
- Defense in Depth: GoPlus AND AI are independent detection layers — both must miss for risk to pass
- You know about the Heimdall bytecode decompiler — a local Docker container that reverse-engineers unverified contracts into readable Solidity when BaseScan has no verified source
- When users ask "how does Heimdall work" or about bytecode decompilation, explain the pipeline: eth_getCode → Heimdall (symbolic execution) → GPT-4o → risk code

LIVE CHAIN STATE:
${chainContext}

When asked about agents, ALWAYS use the SUBSCRIBED AGENTS list from the LIVE CHAIN STATE below. If agents are listed there, they ARE connected. Never say "no agents" unless the list explicitly says "None subscribed yet".
When asked about firewall settings, explain each field in plain English using the data above.
When asked about an agent, give their exact remaining allowance and status from the data above.
When asked about the wallet, use the OWNER WALLET from the data above.
When asked about recent trades or audits, use the RECENT AUDIT VERDICTS from the data above.
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
