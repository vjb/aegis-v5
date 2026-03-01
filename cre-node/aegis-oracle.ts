// @ts-nocheck
/**
 * Aegis Protocol V5 — CRE Oracle
 *
 * Architecture:
 *   - `vaultAddress` refers to the AegisModule (ERC-7579 Executor on Safe Smart Account)
 *   - onReport ABI: (uint256 tradeId, uint256 riskScore)
 *   - 3-phase audit: GoPlus (static) → BaseScan (source) → GPT-4o + Llama-3 (AI consensus)
 *   - Deployed on Base Sepolia (chain ID 84532)
 *   - Uses `writeReport()` via EVMClient → KeystoneForwarder
 *
 * CRE Best Practices:
 *   - Phase 1 (GoPlus) runs in runInNodeMode — non-BFT API, manual aggregation.
 *   - Phase 2+3 (BaseScan + AI) runs in a SECOND runInNodeMode — same reason.
 *   - nodeRuntime.log() inside runInNodeMode surfaces as [USER LOG] in simulate.
 *   - runtime.log() inside the handler callback is silently suppressed.
 *   - All log lines capped at 900 chars (CRE limit: 1KB per log line).
 *   - ConfidentialHTTPClient used for GoPlus (JWT), BaseScan, OpenAI, Groq — keys never leave DON.
 *   - GoPlus auth: APP_KEY + APP_SECRET → short-lived JWT → Bearer token on token_security requests.
 *   - Authenticated GoPlus unlocks: is_blacklisted, lp_holders, dex_info (premium fields).
 */

import {
    EVMClient,
    HTTPClient,
    ConfidentialHTTPClient,
    handler,
    Runner,
    getNetwork,
    hexToBase64,
    bytesToHex,
    ConsensusAggregationByFields,
    identical,
    ignore,
    median,
    type Runtime,
    type NodeRuntime,
    type EVMLog,
    TxStatus
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";

// ─── V4 Config ───────────────────────────────────────────────────────────────
type Config = {
    vaultAddress: string;       // AegisModule contract address
    chainSelectorName: string;  // e.g. "base-mainnet"
};

// ─── Hackathon Mock Registry ─────────────────────────────────────────────────
// Mock tokens are used for Demo 2 (multi-agent) malicious scenarios.
// Realistic full Solidity source is provided so GPT-4o + Llama-3 can
// independently analyze and flag them — NOT just trusting GoPlus.
const MOCK_REGISTRY: Record<string, { name: string, goplus: any, source: string }> = {
    // ─── Base Sepolia deployed mocks ──────────────────────────────────────
    "0x46d40e0abda0814bb0cb323b2bb85a129d00b0ac": {
        name: "MockBRETT",
        goplus: { is_open_source: "1", cannot_sell_all: "0", is_honeypot: "0", is_proxy: "0" },
        source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @title MockBRETT — clean test token
contract MockBRETT is ERC20 {
    constructor() ERC20("MockBRETT", "BRETT") { _mint(msg.sender, 1_000_000 * 1e18); }
}`
    },
    "0xf672c8fc888b98db5c9662d26e657417a3c453b5": {
        name: "MockHoneypot",
        goplus: { is_open_source: "1", cannot_sell_all: "0", is_honeypot: "1", is_proxy: "0" },
        source: `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockHoneypot - transfers restricted to owner allowlist
contract MockHoneypot is ERC20, Ownable {
    mapping(address => bool) private _allowedSellers;

    constructor() ERC20("MockHoneypot", "HONEY") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 1e18);
        _allowedSellers[msg.sender] = true;
    }

    function allowSeller(address account) external onlyOwner {
        _allowedSellers[account] = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && from != owner() && !_allowedSellers[from]) {
            revert("MockHoneypot: transfers not allowed for non-approved sellers");
        }
        super._update(from, to, value);
    }
}`
    },
    // ─── Original demo mocks (canonical addresses) ────────────────────────
    "0x000000000000000000000000000000000000000a": {
        name: "UnverifiedDoge",
        goplus: { is_open_source: "0", cannot_sell_all: "0", is_honeypot: "0", is_proxy: "0" },
        source: ""  // Unverified — no source, AI will be skipped, bit 0 set
    },
    "0x000000000000000000000000000000000000000b": {
        name: "HoneypotCoin",
        goplus: { is_open_source: "1", cannot_sell_all: "0", is_honeypot: "1", is_proxy: "0" },
        source: `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title HoneypotCoin - transfers restricted to owner allowlist
contract HoneypotCoin is ERC20, Ownable {
    mapping(address => bool) private _allowedSellers;

    constructor() ERC20("HoneypotCoin", "HPC") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000_000 * 1e18);
        _allowedSellers[msg.sender] = true;
    }

    function allowSeller(address account) external onlyOwner {
        _allowedSellers[account] = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        // Only owner-approved addresses can transfer out of the contract.
        // All other sellers are permanently locked out — classic honeypot.
        if (from != address(0) && from != owner() && !_allowedSellers[from]) {
            revert("HoneypotCoin: transfers not allowed for non-approved sellers");
        }
        super._update(from, to, value);
    }
}`
    },
    "0x000000000000000000000000000000000000000c": {
        name: "TaxToken",
        goplus: { is_open_source: "1", cannot_sell_all: "1", is_honeypot: "0", is_proxy: "0" },
        source: `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TaxToken - obfuscated 99% sell fee collected by owner
contract TaxToken is ERC20, Ownable {
    address private _feeCollector;
    uint256 private _taxBasisPoints = 9900; // 99% in basis points, disguised as 'protocol fee'

    constructor() ERC20("TaxToken", "TAXT") Ownable(msg.sender) {
        _feeCollector = msg.sender;
        _mint(msg.sender, 500_000_000 * 1e18);
    }

    function setTax(uint256 bps) external onlyOwner { _taxBasisPoints = bps; }
    function setFeeCollector(address fc) external onlyOwner { _feeCollector = fc; }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && from != owner()) {
            uint256 fee = (value * _taxBasisPoints) / 10000;
            uint256 net  = value - fee;
            super._update(from, _feeCollector, fee);
            super._update(from, to, net);
        } else {
            super._update(from, to, value);
        }
    }
}`
    },
};

// ─── AuditResult Type ─────────────────────────────────────────────────────────
type AuditResult = {
    targetAddress: string;
    unverifiedCode: number;
    sellRestriction: number;
    honeypot: number;
    proxyContract: number;
    obfuscatedTax: number;
    privilegeEscalation: number;
    externalCallRisk: number;
    logicBomb: number;
};

// ─── AI Analysis Result Type ──────────────────────────────────────────────────
type AIAnalysisInput = {
    targetAddress: string;
    maxTax: number;
    blockProxies: boolean;
    strictLogic: boolean;
    blockHoneypots: boolean;
    basescanKey: string;
    openAiKey: string;
    groqKey: string;
};

type AIAnalysisResult = {
    obfuscatedTax: number;
    privilegeEscalation: number;
    externalCallRisk: number;
    logicBomb: number;
};

// ─── Phase 1: GoPlus Static Analysis (Node Mode) ─────────────────────────────
// Runs inside runInNodeMode → nodeRuntime.log() appears as [USER LOG].
// Uses ConfidentialHTTPClient for GoPlus JWT auth — APP_KEY/APP_SECRET stay in DON.
// Falls back to unauthenticated call if JWT exchange fails.
type StaticAnalysisInput = {
    log: EVMLog;
    goPlusAppKey: string;
    goPlusAppSecret: string;
};

const performStaticAnalysis = (
    nodeRuntime: NodeRuntime<Config>,
    input: StaticAnalysisInput
): AuditResult => {
    const { log, goPlusAppKey, goPlusAppSecret } = input;
    let unverifiedCode = 0, sellRestriction = 0, honeypot = 0, proxyContract = 0;
    const confidentialClient = new ConfidentialHTTPClient();
    // NOTE: no plain HTTPClient — ALL external calls go through ConfidentialHTTPClient
    // even unauthenticated GoPlus calls. Privacy track: zero plain HTTP from the DON.

    if (!log.topics || log.topics.length < 4) {
        throw new Error("Invalid log topics for AuditRequested");
    }

    const targetTokenHex = bytesToHex(log.topics[3]).replace("0x", "");
    const targetAddress = "0x" + targetTokenHex.slice(-40).toLowerCase();

    nodeRuntime.log(`🛡️ AEGIS MODULE V5 | Auditing: ${targetAddress}`);

    const mockData = MOCK_REGISTRY[targetAddress];
    if (mockData) {
        if (mockData.goplus.is_open_source === "0") unverifiedCode = 1;
        if (mockData.goplus.cannot_sell_all === "1") sellRestriction = 1;
        if (mockData.goplus.is_honeypot === "1") honeypot = 1;
        nodeRuntime.log(`[GoPlus] MOCK registry hit: ${mockData.name}`);
        nodeRuntime.log(`[GoPlus] unverified=${unverifiedCode} sellRestriction=${sellRestriction} honeypot=${honeypot}`);
    } else {
        nodeRuntime.log(`__GOPLUS_START__`); // UI phase marker — drives Oracle Feed indicator
        nodeRuntime.log(`[GoPlus] Authenticating with ConfidentialHTTPClient (APP_KEY stays in DON)...`);

        // ── Step 1: Exchange APP_KEY + APP_SECRET for a short-lived JWT ──────────
        let goPlusToken = "";
        const timestamp = Math.floor(Date.now() / 1000).toString();
        // GoPlus signature: HMAC-SHA256 not available in WASM, so we use the
        // /token endpoint with APP_KEY + APP_SECRET + time as form params.
        const tokenRes = confidentialClient.sendRequest(nodeRuntime, {
            vaultDonSecrets: [
                { key: "AEGIS_GOPLUS_KEY", namespace: "aegis" },
                { key: "AEGIS_GOPLUS_SECRET", namespace: "aegis" },
            ],
            request: {
                url: "https://api.gopluslabs.io/api/v1/token",
                method: "POST",
                multiHeaders: { "Content-Type": { values: ["application/json"] } },
                bodyString: JSON.stringify({
                    app_key: goPlusAppKey,
                    time: timestamp,
                    sign: goPlusAppSecret  // GoPlus simple auth: secret used directly as sign param
                })
            }
        }).result();

        if (tokenRes.statusCode === 200) {
            try {
                const tokenBody = JSON.parse(new TextDecoder().decode(tokenRes.body));
                goPlusToken = tokenBody.result?.access_token || "";
                nodeRuntime.log(`[GoPlus] JWT acquired — AEGIS_GOPLUS_KEY stays inside the Decentralized Oracle Network`);
            } catch { nodeRuntime.log(`[GoPlus] JWT parse failed — falling back to unauthenticated`); }
        } else {
            nodeRuntime.log(`[GoPlus] Auth HTTP ${tokenRes.statusCode} — falling back to unauthenticated`);
        }

        // ── Step 2: Call token_security — always via ConfidentialHTTPClient ──
        // All external calls go through the DON's confidential channel.
        // Authenticated: Bearer token. Unauthenticated: no auth header, same channel.
        nodeRuntime.log(`[GoPlus] Fetching token_security for ${targetAddress} (auth=${!!goPlusToken}) via ConfidentialHTTPClient`);
        const goPlusUrl = `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${targetAddress}`;

        const goPlusReq: any = {
            vaultDonSecrets: goPlusToken ? [{ key: "AEGIS_GOPLUS_KEY", namespace: "aegis" }] : [],
            request: {
                url: goPlusUrl,
                method: "GET",
                ...(goPlusToken && { multiHeaders: { "Authorization": { values: [`Bearer ${goPlusToken}`] } } })
            }
        };
        const goPlusRes = confidentialClient.sendRequest(nodeRuntime, goPlusReq).result();

        nodeRuntime.log(`[GoPlus] HTTP ${goPlusRes.statusCode}`);
        if (goPlusRes.statusCode !== 200) throw new Error(`GoPlus Error: ${goPlusRes.statusCode}`);

        const body = JSON.parse(new TextDecoder().decode(goPlusRes.body));
        const data = body.result?.[targetAddress];
        if (data) {
            if (data.is_open_source === "0") unverifiedCode = 1;
            if (data.cannot_sell_all === "1") sellRestriction = 1;
            if (data.is_honeypot === "1") honeypot = 1;
            if (data.is_proxy === "1") proxyContract = 1;

            // ── Premium fields (only available on authenticated tier) ──────────
            if (goPlusToken) {
                // Blacklisted address — cannot interact with the token
                if (data.is_blacklisted === "1") {
                    sellRestriction = 1;
                    nodeRuntime.log(`[GoPlus/Premium] is_blacklisted=1 → sellRestriction flag set`);
                }
                // LP holder concentration risk — top holder owns >80% of liquidity
                if (Array.isArray(data.lp_holders) && data.lp_holders.length > 0) {
                    const topLpPct = parseFloat(data.lp_holders[0]?.percent || "0");
                    if (topLpPct > 0.8) {
                        honeypot = 1; // concentrated LP = rug pull risk
                        nodeRuntime.log(`[GoPlus/Premium] LP concentration=${(topLpPct * 100).toFixed(1)}% → honeypot flag set`);
                    }
                }
                // Trade-only-on-one-DEX risk (super-thin liquidity)
                if (data.dex && Array.isArray(data.dex) && data.dex.length === 0) {
                    unverifiedCode = 1;
                    nodeRuntime.log(`[GoPlus/Premium] No DEX pools found → unverified flag set`);
                }
                nodeRuntime.log(`[GoPlus/Premium] Full field read: blacklisted=${data.is_blacklisted} lp_holders=${data.lp_holders?.length || 0} dex=${data.dex?.length || 0}`);
            }

            nodeRuntime.log(`[GoPlus] unverified=${unverifiedCode} sellRestriction=${sellRestriction} honeypot=${honeypot} proxy=${proxyContract}`);
        } else {
            unverifiedCode = 1;
            nodeRuntime.log(`[GoPlus] No data returned — marking unverified`);
        }
    }

    return {
        targetAddress,
        unverifiedCode, sellRestriction, honeypot, proxyContract,
        obfuscatedTax: 0, privilegeEscalation: 0, externalCallRisk: 0, logicBomb: 0
    };
};

// ─── Phase 2 + 3: BaseScan + Dual-LLM Consensus (Node Mode) ──────────────────
// Runs inside runInNodeMode → nodeRuntime.log() appears as [USER LOG].
// ConfidentialHTTPClient keeps API keys inside the DON — they never leave.
// AI runs for ALL tokens with source code — mock or real.
const performAIAnalysis = (
    nodeRuntime: NodeRuntime<Config>,
    input: AIAnalysisInput
): AIAnalysisResult => {
    const { targetAddress, maxTax, blockProxies, strictLogic, blockHoneypots,
        basescanKey, openAiKey, groqKey } = input;
    let obfuscatedTax = 0, privilegeEscalation = 0, externalCallRisk = 0, logicBomb = 0;

    const confidentialClient = new ConfidentialHTTPClient();
    const mockData = MOCK_REGISTRY[targetAddress];
    let sourceCode = "";
    let contractName = "";

    // Phase 2: Fetch contract source
    if (mockData) {
        sourceCode = mockData.source;
        contractName = mockData.name;
        nodeRuntime.log(`[BaseScan] Using MOCK source for ${contractName} (${sourceCode.length} chars)`);
    } else {
        nodeRuntime.log(`[BaseScan] ConfidentialHTTPClient → BaseScan for ${targetAddress}`);
        nodeRuntime.log(`[BaseScan] AEGIS_BASESCAN_SECRET stays inside the Decentralized Oracle Network`);
        let currentAddress = targetAddress;
        for (let i = 0; i < 2; i++) {
            const bsUrl = `https://api.etherscan.io/v2/api?chainid=8453&module=contract&action=getsourcecode&address=${currentAddress}&apikey=${basescanKey}`;
            const bsRes = confidentialClient.sendRequest(nodeRuntime, {
                vaultDonSecrets: [{ key: "AEGIS_BASESCAN_SECRET", namespace: "aegis" }],
                request: { url: bsUrl, method: "GET" }
            }).result();
            nodeRuntime.log(`[BaseScan] HTTP ${bsRes.statusCode} — key never left DON`);
            if (bsRes.statusCode !== 200) break;
            const bsBody = JSON.parse(new TextDecoder().decode(bsRes.body));
            if (bsBody.status !== "1" || !bsBody.result?.length) {
                nodeRuntime.log(`[BaseScan] No verified source — contract may be unverified`);
                break;
            }
            const contractData = bsBody.result[0];
            sourceCode = contractData.SourceCode;
            contractName = contractData.ContractName;
            nodeRuntime.log(`[BaseScan] Contract: ${contractName} | ${sourceCode.length} chars of Solidity`);
            nodeRuntime.log(`[BaseScan] Proxy=${contractData.Proxy} | Compiler=${contractData.CompilerVersion}`);
            if (contractData.Proxy === "1" && contractData.Implementation) {
                nodeRuntime.log(`[BaseScan] Proxy detected — following to implementation: ${contractData.Implementation}`);
                currentAddress = contractData.Implementation;
                continue;
            }
            break;
        }
        if (sourceCode.length > 15000) {
            sourceCode = sourceCode.slice(0, 15000);
            nodeRuntime.log(`[BaseScan] Source truncated to 15000 chars for AI input`);
        }
        nodeRuntime.log(`[BaseScan] Sending ${sourceCode.length} chars to AI models`);
    }

    // Phase 3: Dual-LLM consensus
    if (sourceCode && sourceCode.length > 0) {
        const aiPrompt = `You are the Aegis Protocol Lead Security Auditor for a DeFi firewall. Analyze this ERC-20 token contract for MALICIOUS patterns ONLY.

Return ONLY a valid JSON object with these exact boolean keys plus a reasoning string:
  obfuscatedTax: TRUE only if there is a hidden fee >  ${maxTax}% deducted inside _transfer/_update that is NOT clearly named 'tax' or 'fee'. Standard Ownable, renounceOwnership, or royalty logic is NOT a tax.
  privilegeEscalation: TRUE if EITHER: (a) the owner can drain ALL user balances, mint unlimited tokens with no cap, or permanently freeze ALL transfers via a hidden backdoor; OR (b) the contract restricts transfers to an owner-controlled allowlist/whitelist so that non-approved users cannot sell their tokens. Standard OpenZeppelin Ownable (transferOwnership/renounceOwnership) is NOT privilege escalation.
  externalCallRisk: TRUE only if transfer logic makes unguarded calls to arbitrary user-controlled addresses that could re-enter and drain funds.
  logicBomb: TRUE only if there is a time-locked or block-based trigger that will disable transfers or steal funds in the future.
  reasoning: one sentence summary.

Firewall: maxTax=${maxTax}%, blockProxies=${blockProxies}, blockHoneypots=${blockHoneypots}.
Contract: ${contractName}

${sourceCode}`;

        nodeRuntime.log(`[AI] Contract under audit: ${contractName}`);
        nodeRuntime.log(`[AI] Prompt sent to AI (first 400 chars): ${aiPrompt.slice(0, 400)}`);
        nodeRuntime.log(`[AI] → GPT-4o via ConfidentialHTTPClient | AEGIS_OPENAI_SECRET stays in DON`);

        // --- GPT-4o ---
        const openAiRes = confidentialClient.sendRequest(nodeRuntime, {
            vaultDonSecrets: [{ key: "AEGIS_OPENAI_SECRET", namespace: "aegis" }],
            request: {
                url: "https://api.openai.com/v1/chat/completions",
                method: "POST",
                multiHeaders: {
                    "Authorization": { values: [`Bearer ${openAiKey}`] },
                    "Content-Type": { values: ["application/json"] }
                },
                bodyString: JSON.stringify({
                    model: "gpt-4o",
                    temperature: 0.0,
                    response_format: { type: "json_object" },
                    messages: [{ role: "user", content: aiPrompt }]
                })
            }
        }).result();

        nodeRuntime.log(`[GPT-4o] HTTP ${openAiRes.statusCode}`);
        if (openAiRes.statusCode === 200) {
            const rawGpt = JSON.parse(new TextDecoder().decode(openAiRes.body)).choices[0].message.content;
            // Cap at 800 chars — CRE max log line is 1KB
            nodeRuntime.log(`[GPT-4o] Response: ${rawGpt.slice(0, 800)}`);
            const r = JSON.parse(rawGpt);
            if (r.obfuscatedTax) obfuscatedTax = 1;
            if (r.privilegeEscalation) privilegeEscalation = 1;
            if (r.externalCallRisk) externalCallRisk = 1;
            if (r.logicBomb) logicBomb = 1;
            nodeRuntime.log(`[GPT-4o] Risk bits → tax=${r.obfuscatedTax} priv=${r.privilegeEscalation} extCall=${r.externalCallRisk} bomb=${r.logicBomb}`);
            nodeRuntime.log(`[GPT-4o] Reasoning: ${String(r.reasoning).slice(0, 700)}`);
        } else {
            nodeRuntime.log(`[GPT-4o] ERROR HTTP ${openAiRes.statusCode}`);
        }

        nodeRuntime.log(`[AI] → Llama-3 via Groq ConfidentialHTTPClient | AEGIS_GROQ_SECRET stays in DON`);

        // --- Llama-3 via Groq ---
        const groqRes = confidentialClient.sendRequest(nodeRuntime, {
            vaultDonSecrets: [{ key: "AEGIS_GROQ_SECRET", namespace: "aegis" }],
            request: {
                url: "https://api.groq.com/openai/v1/chat/completions",
                method: "POST",
                multiHeaders: {
                    "Authorization": { values: [`Bearer ${groqKey}`] },
                    "Content-Type": { values: ["application/json"] }
                },
                bodyString: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    temperature: 0.0,
                    response_format: { type: "json_object" },
                    messages: [{ role: "user", content: aiPrompt }]
                })
            }
        }).result();

        nodeRuntime.log(`[Llama-3] HTTP ${groqRes.statusCode}`);
        if (groqRes.statusCode === 200) {
            const rawLlama = JSON.parse(new TextDecoder().decode(groqRes.body)).choices[0].message.content;
            nodeRuntime.log(`[Llama-3] Response: ${rawLlama.slice(0, 800)}`);
            const r = JSON.parse(rawLlama);
            // Union of Fears: flag if EITHER model flags it
            if (r.obfuscatedTax) obfuscatedTax = 1;
            if (r.privilegeEscalation) privilegeEscalation = 1;
            if (r.externalCallRisk) externalCallRisk = 1;
            if (r.logicBomb) logicBomb = 1;
            nodeRuntime.log(`[Llama-3] Risk bits → tax=${r.obfuscatedTax} priv=${r.privilegeEscalation} extCall=${r.externalCallRisk} bomb=${r.logicBomb}`);
            nodeRuntime.log(`[Llama-3] Reasoning: ${String(r.reasoning).slice(0, 700)}`);
        } else {
            nodeRuntime.log(`[Llama-3] ERROR HTTP ${groqRes.statusCode}`);
        }

        nodeRuntime.log(`[AI] Union of Fears → obfuscatedTax=${obfuscatedTax} privilegeEscalation=${privilegeEscalation} externalCallRisk=${externalCallRisk} logicBomb=${logicBomb}`);
    } else {
        nodeRuntime.log(`[AI] SKIPPED — no source code for ${targetAddress} (unverified contract, bit 0 set)`);
    }

    return { obfuscatedTax, privilegeEscalation, externalCallRisk, logicBomb };
};

// ─── Main DON Trigger ─────────────────────────────────────────────────────────
// AuditRequested(uint256 indexed tradeId, address indexed user,
//                address indexed targetToken, string firewallConfig)
const onAuditTrigger = (runtime: Runtime<Config>, log: EVMLog): string => {
    runtime.log("🛡️ AegisModule V5 | AuditRequested intercepted");

    // Parse firewallConfig from non-indexed event data
    let firewallConfig = '{"maxTax":5,"blockProxies":true,"strictLogic":true,"blockHoneypots":true}';
    try {
        if (log.data && log.data.length > 0) {
            const rawHex = bytesToHex(log.data).replace("0x", "");
            if (rawHex.length >= 128) {
                const strLen = parseInt(rawHex.substring(64, 128), 16);
                const strHex = rawHex.substring(128, 128 + strLen * 2);
                let decoded = '';
                for (let i = 0; i < strHex.length; i += 2) {
                    decoded += String.fromCharCode(parseInt(strHex.substring(i, i + 2), 16));
                }
                if (decoded.startsWith('{')) firewallConfig = decoded;
            }
        }
    } catch { /* use defaults */ }

    // Parse firewall rules
    let maxTax = 5, blockProxies = true, strictLogic = true, blockHoneypots = true, allowUnverified = false;
    let blockSellRestriction = true, blockObfuscatedTax = true, blockPrivilegeEscalation = true, blockExternalCallRisk = true, blockLogicBomb = true;
    try {
        const parsed = JSON.parse(firewallConfig);
        if (typeof parsed.maxTax === 'number') maxTax = parsed.maxTax;
        if (typeof parsed.blockProxies === 'boolean') blockProxies = parsed.blockProxies;
        if (typeof parsed.strictLogic === 'boolean') strictLogic = parsed.strictLogic;
        if (typeof parsed.blockHoneypots === 'boolean') blockHoneypots = parsed.blockHoneypots;
        if (typeof parsed.allowUnverified === 'boolean') allowUnverified = parsed.allowUnverified;
        // Per-bit enable flags (default true if not present)
        if (typeof parsed.blockSellRestriction === 'boolean') blockSellRestriction = parsed.blockSellRestriction;
        if (typeof parsed.blockObfuscatedTax === 'boolean') blockObfuscatedTax = parsed.blockObfuscatedTax;
        if (typeof parsed.blockPrivilegeEscalation === 'boolean') blockPrivilegeEscalation = parsed.blockPrivilegeEscalation;
        if (typeof parsed.blockExternalCallRisk === 'boolean') blockExternalCallRisk = parsed.blockExternalCallRisk;
        if (typeof parsed.blockLogicBomb === 'boolean') blockLogicBomb = parsed.blockLogicBomb;
    } catch { /* use defaults */ }

    // Fetch secrets (retrieved on handler runtime — fine for coordination)
    // GoPlus keys are optional — if not registered, GoPlus runs unauthenticated (free tier).
    // All other secrets (BaseScan, OpenAI, Groq) are required for full AI pipeline.
    const basescanKey = runtime.getSecret({ id: "AEGIS_BASESCAN_SECRET" }).result().value;
    const openAiKey = runtime.getSecret({ id: "AEGIS_OPENAI_SECRET" }).result().value;
    const groqKey = runtime.getSecret({ id: "AEGIS_GROQ_SECRET" }).result().value;
    let goPlusAppKey = '', goPlusAppSecret = '';
    try {
        goPlusAppKey = runtime.getSecret({ id: "AEGIS_GOPLUS_KEY" }).result().value || '';
        goPlusAppSecret = runtime.getSecret({ id: "AEGIS_GOPLUS_SECRET" }).result().value || '';
    } catch {
        // AEGIS_GOPLUS_KEY / AEGIS_GOPLUS_SECRET not yet registered — using unauthenticated GoPlus (free tier).
        // Register via: cre workflow secrets set --id AEGIS_GOPLUS_KEY --value <key>
    }

    // ── Phase 1: GoPlus (runInNodeMode — non-BFT API, BFT median aggregation) ──
    // GoPlus JWT auth via ConfidentialHTTPClient — APP_KEY/SECRET stay inside DON
    const staticResult = runtime.runInNodeMode(
        performStaticAnalysis,
        ConsensusAggregationByFields<AuditResult>({
            targetAddress: identical,
            unverifiedCode: median,
            sellRestriction: median,
            honeypot: median,
            proxyContract: median,
            obfuscatedTax: median,
            privilegeEscalation: median,
            externalCallRisk: median,
            logicBomb: median,
        })
    )({ log, goPlusAppKey, goPlusAppSecret }).result();

    const targetAddress = staticResult.targetAddress;

    // ── Phase 2+3: BaseScan + AI (runInNodeMode — non-BFT, manual aggregation) ──
    const aiResult = runtime.runInNodeMode(
        performAIAnalysis,
        ConsensusAggregationByFields<AIAnalysisResult>({
            obfuscatedTax: median,
            privilegeEscalation: median,
            externalCallRisk: median,
            logicBomb: median,
        })
    )({
        targetAddress, maxTax, blockProxies, strictLogic, blockHoneypots,
        basescanKey, openAiKey, groqKey
    }).result();

    const { obfuscatedTax, privilegeEscalation, externalCallRisk, logicBomb } = aiResult;

    // ── Assemble 8-bit risk matrix ────────────────────────────────────────────
    // GoPlus bits (0-3): static on-chain analysis
    // AI bits (4-7):     source-code AI analysis (catches what GoPlus cannot see)
    // Defense in Depth: each layer uses different detection methods, both must miss for risk to pass through
    let riskMatrix = 0;
    if (staticResult.unverifiedCode && !allowUnverified) riskMatrix |= 1;               // bit 0 (GoPlus)
    if (staticResult.sellRestriction && blockSellRestriction) riskMatrix |= 2;           // bit 1 (GoPlus)
    if (staticResult.honeypot && blockHoneypots) riskMatrix |= 4;                        // bit 2 (GoPlus)
    if (staticResult.proxyContract && blockProxies) riskMatrix |= 8;                     // bit 3 (GoPlus)
    if (obfuscatedTax && blockObfuscatedTax) riskMatrix |= 16;                           // bit 4 (AI)
    if (privilegeEscalation && blockPrivilegeEscalation) riskMatrix |= 32;               // bit 5 (AI)
    if (externalCallRisk && blockExternalCallRisk) riskMatrix |= 64;                     // bit 6 (AI)
    if (logicBomb && blockLogicBomb) riskMatrix |= 128;                                  // bit 7 (AI)

    runtime.log(`⚖️ Final Risk Code: ${riskMatrix}`);

    // ── Parse tradeId from AuditRequested topics[1] ───────────────────────────
    const tradeIdHex = bytesToHex(log.topics[1]);
    const tradeId = BigInt(tradeIdHex.startsWith("0x") ? tradeIdHex : "0x" + tradeIdHex);

    // ── ABI-encode onReport payload: (uint256 tradeId, uint256 riskScore) ─────
    const reportDataHex = encodeAbiParameters(
        parseAbiParameters('uint256, uint256'),
        [tradeId, BigInt(riskMatrix)]
    );

    const reportResponse = runtime.report({
        encodedPayload: hexToBase64(reportDataHex),
        encoderName: 'evm',
        signingAlgo: 'ecdsa',
        hashingAlgo: 'keccak256',
    }).result();

    const network = getNetwork({
        chainFamily: "evm",
        chainSelectorName: runtime.config.chainSelectorName
    });

    const evmClient = new EVMClient(network!.chainSelector.selector);
    const txRes = evmClient.writeReport(runtime, {
        receiver: runtime.config.vaultAddress,
        report: reportResponse,
        gasConfig: { gasLimit: "500000" }
    }).result();

    if (txRes.txStatus !== TxStatus.SUCCESS) {
        throw new Error(`Failed to write report: ${txRes.errorMessage || txRes.txStatus}`);
    }

    runtime.log(`✅ onReport delivered to AegisModule at ${runtime.config.vaultAddress}`);
    return "Audit Complete";
};

// ─── Workflow Init ────────────────────────────────────────────────────────────
const initWorkflow = (config: Config) => {
    const network = getNetwork({
        chainFamily: "evm",
        chainSelectorName: config.chainSelectorName
    });

    if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`);

    const evmClient = new EVMClient(network.chainSelector.selector);

    return [
        handler(
            evmClient.logTrigger({ addresses: [hexToBase64(config.vaultAddress)] }),
            onAuditTrigger
        )
    ];
};

export async function main() {
    const runner = await Runner.newRunner<Config>();
    await runner.run(initWorkflow);
}
