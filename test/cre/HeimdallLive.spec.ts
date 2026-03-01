/**
 * ═══════════════════════════════════════════════════════════════
 * HeimdallLive.test.ts — LIVE Integration Tests (ZERO MOCKING)
 * ═══════════════════════════════════════════════════════════════
 *
 * Every test hits REAL infrastructure:
 *   - Local Heimdall microservice on localhost:8080
 *   - Base Sepolia RPC for eth_getCode
 *   - BaseScan API for verification check
 *
 * Prerequisites:
 *   docker run -d -p 8080:8080 --name aegis-heimdall aegis-heimdall
 */

import * as dotenv from "dotenv";
dotenv.config();

const HEIMDALL_URL = "http://localhost:8080";
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// Known contract addresses on Base Sepolia
const AEGIS_MODULE = process.env.AEGIS_MODULE_ADDRESS || "0x23EfaEF29EcC0e6CE313F0eEd3d5dA7E0f5Bcd89";

// ─── Helper: fetch with timeout ──────────────────────────────────────────────
async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 60000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...opts, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ─── Helper: get bytecode from Base Sepolia via live RPC ─────────────────────
async function getLiveBytecode(address: string): Promise<string> {
    const res = await fetchWithTimeout(BASE_SEPOLIA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getCode",
            params: [address, "latest"],
            id: 1,
        }),
    });
    const body = await res.json() as any;
    return body.result || "0x";
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2: Local Heimdall Microservice Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("Phase 2: Live Heimdall Microservice", () => {
    // Increased timeout — Heimdall decompilation can take 30+ seconds
    jest.setTimeout(120000);

    it("GET /health should return ok with Heimdall version", async () => {
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/health`, { method: "GET" });
        expect(res.status).toBe(200);

        const body = await res.json() as any;
        expect(body.status).toBe("ok");
        expect(body.heimdall).toBeDefined();
        expect(body.heimdall).toContain("heimdall");
    });

    it("POST /decompile should return decompiled logic for known bytecode", async () => {
        // Fetch REAL bytecode from Base Sepolia
        const bytecode = await getLiveBytecode(AEGIS_MODULE);
        expect(bytecode.length).toBeGreaterThan(10);

        // Send to LIVE local Heimdall service
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/decompile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bytecode }),
        }, 120000);

        expect(res.status).toBe(200);

        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.decompiled).toBeDefined();
        expect(body.decompiled.length).toBeGreaterThan(0);
        expect(body.bytecodeLength).toBeGreaterThan(10);

        console.log(`[TEST] Decompiled ${body.bytecodeLength} hex chars → ${body.decompiled.length} chars in ${body.elapsedMs}ms`);
        console.log(`[TEST] First 300 chars:\n${body.decompiled.slice(0, 300)}`);
    });

    it("POST /decompile should reject empty bytecode", async () => {
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/decompile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bytecode: "" }),
        });

        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.success).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 3: Live Base Sepolia Pipeline Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("Phase 3: Live Base Sepolia Pipeline", () => {
    jest.setTimeout(120000);

    it("should fetch live bytecode from Base Sepolia via eth_getCode", async () => {
        const bytecode = await getLiveBytecode(AEGIS_MODULE);

        expect(bytecode).toBeDefined();
        expect(bytecode.startsWith("0x")).toBe(true);
        expect(bytecode.length).toBeGreaterThan(100);

        console.log(`[TEST] Live bytecode for AegisModule: ${bytecode.length} hex chars`);
    });

    it("should fetch bytecode AND decompile via full pipeline", async () => {
        // Step 1: Live RPC to Base Sepolia
        const bytecode = await getLiveBytecode(AEGIS_MODULE);
        expect(bytecode.length).toBeGreaterThan(100);

        // Step 2: Live call to local Heimdall microservice
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/decompile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bytecode }),
        }, 120000);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.decompiled.length).toBeGreaterThan(0);

        // The decompiled output should contain function-like structures
        const hasStructure = body.decompiled.includes("function") ||
            body.decompiled.includes("CALL") ||
            body.decompiled.includes("JUMPDEST") ||
            body.decompiled.includes("storage");
        expect(hasStructure).toBe(true);

        console.log(`[TEST] Full pipeline: Base Sepolia → Heimdall → ${body.decompiled.length} chars of decompiled code`);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 4: Live LLM Consensus with Heimdall output
// ═════════════════════════════════════════════════════════════════════════════

describe("Phase 4: Live LLM Consensus Integration", () => {
    jest.setTimeout(180000); // LLM calls can take 30+ seconds

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    it("should send Heimdall-decompiled code to live GPT-4o and get valid risk JSON", async () => {
        if (!OPENAI_KEY) {
            console.log("[TEST] OPENAI_API_KEY not set — skipping live LLM test");
            return;
        }

        // Step 1: Live bytecode from Base Sepolia
        const bytecode = await getLiveBytecode(AEGIS_MODULE);
        expect(bytecode.length).toBeGreaterThan(100);
        console.log(`[TEST] Step 1: Fetched ${bytecode.length} hex chars from Base Sepolia`);

        // Step 2: Live decompilation via Heimdall
        const decompileRes = await fetchWithTimeout(`${HEIMDALL_URL}/decompile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bytecode }),
        }, 120000);
        const decompileBody = await decompileRes.json() as any;
        expect(decompileBody.success).toBe(true);
        const decompiledSource = decompileBody.decompiled.slice(0, 8000); // Trim for token limits
        console.log(`[TEST] Step 2: Heimdall decompiled → ${decompiledSource.length} chars`);

        // Step 3: Live GPT-4o call with decompiled code
        const prompt = `You are a smart contract security auditor. This code was DECOMPILED by Heimdall from raw EVM bytecode (it is NOT original source code). Variable names are generic (var_a, var_b), function selectors may be unresolved. Focus on EVM-level patterns.

Analyze for malicious patterns and return ONLY valid JSON:
{
  "obfuscatedTax": boolean,
  "privilegeEscalation": boolean,
  "externalCallRisk": boolean,
  "logicBomb": boolean,
  "reasoning": "one sentence"
}

Decompiled contract:
${decompiledSource}`;

        const llmRes = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: 0,
                max_tokens: 300,
            }),
        }, 60000);

        expect(llmRes.status).toBe(200);
        const llmBody = await llmRes.json() as any;
        const content = llmBody.choices[0].message.content;
        console.log(`[TEST] Step 3: GPT-4o raw response: ${content}`);

        // Parse the JSON from GPT-4o response (strip markdown fences if present)
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const riskResult = JSON.parse(jsonStr);

        // Assert valid risk structure
        expect(typeof riskResult.obfuscatedTax).toBe("boolean");
        expect(typeof riskResult.privilegeEscalation).toBe("boolean");
        expect(typeof riskResult.externalCallRisk).toBe("boolean");
        expect(typeof riskResult.logicBomb).toBe("boolean");
        expect(typeof riskResult.reasoning).toBe("string");
        expect(riskResult.reasoning.length).toBeGreaterThan(0);

        // Compute risk mask (same as oracle)
        const riskMask =
            (riskResult.obfuscatedTax ? 1 : 0) |
            (riskResult.privilegeEscalation ? 2 : 0) |
            (riskResult.externalCallRisk ? 4 : 0) |
            (riskResult.logicBomb ? 8 : 0);

        console.log(`[TEST] ✅ LLM Risk Assessment from decompiled code:`);
        console.log(`[TEST]   obfuscatedTax: ${riskResult.obfuscatedTax}`);
        console.log(`[TEST]   privilegeEscalation: ${riskResult.privilegeEscalation}`);
        console.log(`[TEST]   externalCallRisk: ${riskResult.externalCallRisk}`);
        console.log(`[TEST]   logicBomb: ${riskResult.logicBomb}`);
        console.log(`[TEST]   8-bit risk mask: ${riskMask} (0b${riskMask.toString(2).padStart(8, "0")})`);
        console.log(`[TEST]   reasoning: ${riskResult.reasoning}`);
    });
});
