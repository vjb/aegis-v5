/**
 * x402-Gated Oracle Audit Endpoint
 * 
 * Exposes Aegis CRE threat intelligence as a paid API.
 * Agents pay $0.05 USDC per audit via the x402 HTTP payment protocol.
 * 
 * Flow:
 *   1. Agent sends GET /api/oracle/audit?token=0x...
 *   2. If no X-PAYMENT header → 402 Payment Required (with payment instructions)
 *   3. If valid payment → run CRE pipeline → return 8-bit risk mask + JSON
 *   4. Settlement happens AFTER successful response (withX402 guarantees this)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from 'x402-next';

// ── Load environment ────────────────────────────────────────────────
function loadEnv() {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '../.env');
    const envObj: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line: string) => {
            const [k, ...v] = line.split('=');
            if (k && v.length) envObj[k.trim()] = v.join('=').trim();
        });
    }
    return {
        OPENAI_API_KEY: envObj.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
        BASESCAN_API_KEY: envObj.BASESCAN_API_KEY || process.env.BASESCAN_API_KEY || '',
        GOPLUS_APP_KEY: envObj.GOPLUS_APP_KEY || process.env.GOPLUS_APP_KEY || '',
        // Treasury address that receives USDC payments
        // IMPORTANT: Must be different from the payer wallet (x402 rejects from===to)
        TREASURY_ADDRESS: envObj.TREASURY_ADDRESS || process.env.TREASURY_ADDRESS || '0xC006bfc3Cac01634168e9cD0a1fEbD4Ffb816e14',
    };
}

// ── CRE Pipeline (simplified for API) ───────────────────────────────
async function runAuditPipeline(tokenAddress: string, env: ReturnType<typeof loadEnv>) {
    const results: Record<string, any> = {
        token: tokenAddress,
        timestamp: new Date().toISOString(),
        pipeline: 'Aegis CRE v5',
    };

    // Phase 1: GoPlus security check
    try {
        const goplusUrl = `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${tokenAddress}`;
        const goplusRes = await fetch(goplusUrl);
        const goplusData = await goplusRes.json();
        const tokenData = goplusData?.result?.[tokenAddress.toLowerCase()] || {};
        results.goplus = {
            honeypot: tokenData.is_honeypot === '1',
            sellRestriction: tokenData.cannot_sell_all === '1',
            proxy: tokenData.is_proxy === '1',
            verified: tokenData.is_open_source === '1',
        };
    } catch {
        results.goplus = { error: 'GoPlus unavailable' };
    }

    // Phase 2: BaseScan source retrieval
    let sourceCode = '';
    try {
        const bsUrl = `https://api.basescan.org/api?module=contract&action=getsourcecode&address=${tokenAddress}&apikey=${env.BASESCAN_API_KEY}`;
        const bsRes = await fetch(bsUrl);
        const bsData = await bsRes.json();
        sourceCode = bsData?.result?.[0]?.SourceCode || '';
        results.basescan = {
            hasSource: sourceCode.length > 0,
            sourceLength: sourceCode.length,
            contractName: bsData?.result?.[0]?.ContractName || 'Unknown',
        };
    } catch {
        results.basescan = { error: 'BaseScan unavailable' };
    }

    // Phase 3: AI Analysis (GPT-4o)
    if (sourceCode.length > 0 && env.OPENAI_API_KEY) {
        const truncated = sourceCode.slice(0, 15000);
        const aiPrompt = `You are the Aegis Protocol Lead Security Auditor. Analyze this ERC-20 token contract for MALICIOUS patterns ONLY.

Return ONLY valid JSON:
  obfuscatedTax: boolean
  privilegeEscalation: boolean
  externalCallRisk: boolean
  logicBomb: boolean
  reasoning: one sentence summary

Contract source:
${truncated}`;

        try {
            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    temperature: 0,
                    response_format: { type: 'json_object' },
                    messages: [{ role: 'user', content: aiPrompt }],
                }),
            });
            const aiData = await openaiRes.json();
            const rawContent = aiData.choices?.[0]?.message?.content || '{}';
            results.ai = JSON.parse(rawContent);
        } catch (e: any) {
            results.ai = { error: e.message };
        }
    } else {
        results.ai = { skipped: !sourceCode.length ? 'no source code' : 'no API key' };
    }

    // Phase 4: Compute 8-bit risk code
    let riskCode = 0;
    const gp = results.goplus || {};
    const ai = results.ai || {};

    if (!results.basescan?.hasSource) riskCode |= 1;   // Bit 0: unverified
    if (gp.sellRestriction) riskCode |= 2;               // Bit 1
    if (gp.honeypot) riskCode |= 4;                      // Bit 2
    if (gp.proxy) riskCode |= 8;                         // Bit 3
    if (ai.obfuscatedTax) riskCode |= 16;                // Bit 4
    if (ai.privilegeEscalation) riskCode |= 32;          // Bit 5
    if (ai.externalCallRisk) riskCode |= 64;             // Bit 6
    if (ai.logicBomb) riskCode |= 128;                   // Bit 7

    results.riskCode = riskCode;
    results.is_malicious = riskCode > 0;
    results.verdict = riskCode === 0 ? 'APPROVED' : 'BLOCKED';

    return results;
}

// ── Handler ─────────────────────────────────────────────────────────
const handler = async (req: NextRequest) => {
    const tokenAddress = req.nextUrl.searchParams.get('token');
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
        return NextResponse.json(
            { error: 'Missing or invalid token address. Use ?token=0x...' },
            { status: 400 }
        );
    }

    const env = loadEnv();
    const results = await runAuditPipeline(tokenAddress, env);

    return NextResponse.json({
        protocol: 'x402',
        payment: '$0.05 USDC',
        ...results,
    });
};

// ── Export with x402 payment gate ───────────────────────────────────
const env = loadEnv();

export const GET = withX402(
    handler,
    env.TREASURY_ADDRESS as `0x${string}`,
    {
        price: '$0.05',
        network: 'base-sepolia',
        config: {
            description: 'Aegis CRE Oracle Audit — 8-bit risk analysis via GoPlus + GPT-4o',
        },
    }
);
