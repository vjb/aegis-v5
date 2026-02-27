/**
 * Aegis Protocol V4 — CRE Oracle
 *
 * V4 Change Summary (from V3):
 *   - `vaultAddress` now refers to the AegisModule (ERC-7579 Executor),
 *     not the standalone AegisVault treasury.
 *   - onReport ABI is UNCHANGED: (uint256 tradeId, uint256 riskScore)
 *   - All audit logic (GoPlus, BaseScan, GPT-4o, Llama-3) is preserved.
 *   - The module still uses `writeReport()` via EVMClient → KeystoneForwarder.
 *
 * The separation of concerns means this file needs minimal changes.
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
// vaultAddress now points to the deployed AegisModule (ERC-7579 Executor).
// The KeystoneForwarder will call AegisModule.onReport() on clearance delivery.
type Config = {
    vaultAddress: string;       // AegisModule contract address
    chainSelectorName: string;  // e.g. "base-mainnet"
};

// ─── Hackathon Mock Registry (unchanged from V3) ─────────────────────────────
const MOCK_REGISTRY: Record<string, { name: string, goplus: any, source: string }> = {
    "0x000000000000000000000000000000000000000a": {
        name: "UnverifiedDoge",
        goplus: { is_open_source: "0", cannot_sell_all: "0", is_honeypot: "0", is_proxy: "0" },
        source: ""
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
        // Only owner-approved addresses can transfer out of the contract
        // All other sellers are permanently locked out
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

// ─── AuditResult Type (unchanged from V3) ────────────────────────────────────
type AuditResult = {
    targetAddress: string;
    goPlusStatus: string;
    unverifiedCode: number;
    sellRestriction: number;
    honeypot: number;
    proxyContract: number;
    obfuscatedTax: number;
    privilegeEscalation: number;
    externalCallRisk: number;
    logicBomb: number;
};

// ─── Phase 1: GoPlus Static Analysis (Node Mode) ─────────────────────────────
const performStaticAnalysis = (
    nodeRuntime: NodeRuntime<Config>,
    log: EVMLog
): AuditResult => {
    let unverifiedCode = 0, sellRestriction = 0, honeypot = 0, proxyContract = 0;
    const httpClient = new HTTPClient();

    if (!log.topics || log.topics.length < 4) {
        throw new Error("Invalid log topics for AuditRequested");
    }

    const targetTokenHex = bytesToHex(log.topics[3]).replace("0x", "");
    const targetAddress = "0x" + targetTokenHex.slice(-40).toLowerCase();

    nodeRuntime.log(`🛡️ AEGIS MODULE V4 | Auditing: ${targetAddress}`);

    const mockData = MOCK_REGISTRY[targetAddress];
    if (mockData) {
        if (mockData.goplus.is_open_source === "0") unverifiedCode = 1;
        if (mockData.goplus.cannot_sell_all === "1") sellRestriction = 1;
        if (mockData.goplus.is_honeypot === "1") honeypot = 1;
        nodeRuntime.log(`[GoPlus] MOCKED: ${mockData.name}`);
    } else {
        const goPlusUrl = `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${targetAddress}`;
        const goPlusRes = httpClient.sendRequest(nodeRuntime, { method: "GET", url: goPlusUrl }).result();
        if (goPlusRes.statusCode !== 200) throw new Error(`GoPlus Error: ${goPlusRes.statusCode}`);
        const body = JSON.parse(new TextDecoder().decode(goPlusRes.body));
        const data = body.result?.[targetAddress];
        if (data) {
            if (data.is_open_source === "0") unverifiedCode = 1;
            if (data.cannot_sell_all === "1") sellRestriction = 1;
            if (data.is_honeypot === "1") honeypot = 1;
            if (data.is_proxy === "1") proxyContract = 1;
        } else {
            unverifiedCode = 1;
        }
    }

    return {
        targetAddress, goPlusStatus: "",
        unverifiedCode, sellRestriction, honeypot, proxyContract,
        obfuscatedTax: 0, privilegeEscalation: 0, externalCallRisk: 0, logicBomb: 0
    };
};

// Input type for AI analysis node-mode pass
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

// ─── Phase 2 + 3: BaseScan + Dual-LLM Consensus (Node Mode) ──────────────────
// Runs inside runInNodeMode so nodeRuntime.log() surfaces as [USER LOG].
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

    // Phase 2: BaseScan source fetch
    if (mockData) {
        sourceCode = mockData.source;
        contractName = mockData.name;
        nodeRuntime.log(`[BaseScan] Using mock source for ${contractName} (${sourceCode.length} chars)`);
    } else {
        nodeRuntime.log(`[BaseScan] ConfidentialHTTPClient fetching source for ${targetAddress}...`);
        nodeRuntime.log(`[BaseScan] NOTE: AEGIS_BASESCAN_SECRET never leaves the DON`);
        let currentAddress = targetAddress;
        for (let i = 0; i < 2; i++) {
            const bsUrl = `https://api.etherscan.io/v2/api?chainid=8453&module=contract&action=getsourcecode&address=${currentAddress}&apikey=${basescanKey}`;
            const bsRes = confidentialClient.sendRequest(nodeRuntime, {
                vaultDonSecrets: [{ key: "AEGIS_BASESCAN_SECRET", namespace: "aegis" }],
                request: { url: bsUrl, method: "GET" }
            }).result();
            nodeRuntime.log(`[BaseScan] HTTP ${bsRes.statusCode} (key stayed in DON)`);
            if (bsRes.statusCode !== 200) break;
            const bsBody = JSON.parse(new TextDecoder().decode(bsRes.body));
            if (bsBody.status !== "1" || !bsBody.result?.length) {
                nodeRuntime.log(`[BaseScan] No verified source found — contract may be unverified`);
                break;
            }
            const contractData = bsBody.result[0];
            sourceCode = contractData.SourceCode;
            contractName = contractData.ContractName;
            nodeRuntime.log(`[BaseScan] Fetched: ${contractName} | ${sourceCode.length} chars of Solidity`);
            nodeRuntime.log(`[BaseScan] Proxy=${contractData.Proxy} | Compiler=${contractData.CompilerVersion}`);
            if (contractData.Proxy === "1" && contractData.Implementation) { currentAddress = contractData.Implementation; continue; }
            break;
        }
        if (sourceCode.length > 15000) sourceCode = sourceCode.slice(0, 15000);
        nodeRuntime.log(`[BaseScan] Sending ${sourceCode.length} chars to AI (truncated to 15000 max)`);
    }

    // Phase 3: Dual-LLM consensus
    if (sourceCode && sourceCode.length > 0) {
        const aiPrompt = `You are the Aegis Protocol Lead Security Auditor. Analyze the following smart contract.
Return ONLY a JSON object with keys: obfuscatedTax (bool), privilegeEscalation (bool), externalCallRisk (bool), logicBomb (bool), reasoning (string).
Firewall rules: maxTax=${maxTax}%, blockProxies=${blockProxies}, strictLogic=${strictLogic}, blockHoneypots=${blockHoneypots}.
Contract name: ${contractName}
Contract source:
${sourceCode}`;

        nodeRuntime.log(`[AI] Auditing contract: ${contractName}`);
        nodeRuntime.log(`[AI] Prompt preview: ${aiPrompt.slice(0, 300)}...`);
        nodeRuntime.log(`[AI] Sending to GPT-4o via ConfidentialHTTPClient (AEGIS_OPENAI_SECRET never leaves DON)...`);

        // GPT-4o
        const openAiRes = confidentialClient.sendRequest(nodeRuntime, {
            vaultDonSecrets: [{ key: "AEGIS_OPENAI_SECRET", namespace: "aegis" }],
            request: {
                url: "https://api.openai.com/v1/chat/completions",
                method: "POST",
                multiHeaders: {
                    "Authorization": { values: [`Bearer ${openAiKey}`] },
                    "Content-Type": { values: ["application/json"] }
                },
                bodyString: JSON.stringify({ model: "gpt-4o", temperature: 0.0, response_format: { type: "json_object" }, messages: [{ role: "user", content: aiPrompt }] })
            }
        }).result();

        nodeRuntime.log(`[GPT-4o] HTTP status: ${openAiRes.statusCode}`);
        if (openAiRes.statusCode === 200) {
            const rawGpt = JSON.parse(new TextDecoder().decode(openAiRes.body)).choices[0].message.content;
            nodeRuntime.log(`[GPT-4o] Response (truncated to 800): ${rawGpt.slice(0, 800)}`);
            const r = JSON.parse(rawGpt);
            if (r.obfuscatedTax) obfuscatedTax = 1;
            if (r.privilegeEscalation) privilegeEscalation = 1;
            if (r.externalCallRisk) externalCallRisk = 1;
            if (r.logicBomb) logicBomb = 1;
            nodeRuntime.log(`[GPT-4o] Bits: tax=${r.obfuscatedTax} priv=${r.privilegeEscalation} extCall=${r.externalCallRisk} bomb=${r.logicBomb}`);
            nodeRuntime.log(`[GPT-4o] Reasoning: ${String(r.reasoning).slice(0, 700)}`);
        } else {
            nodeRuntime.log(`[GPT-4o] ERROR HTTP ${openAiRes.statusCode}`);
        }

        nodeRuntime.log(`[AI] Sending to Llama-3 via Groq ConfidentialHTTPClient (AEGIS_GROQ_SECRET never leaves DON)...`);

        // Llama-3 via Groq
        const groqRes = confidentialClient.sendRequest(nodeRuntime, {
            vaultDonSecrets: [{ key: "AEGIS_GROQ_SECRET", namespace: "aegis" }],
            request: {
                url: "https://api.groq.com/openai/v1/chat/completions",
                method: "POST",
                multiHeaders: {
                    "Authorization": { values: [`Bearer ${groqKey}`] },
                    "Content-Type": { values: ["application/json"] }
                },
                bodyString: JSON.stringify({ model: "llama-3.1-8b-instant", temperature: 0.0, response_format: { type: "json_object" }, messages: [{ role: "user", content: aiPrompt }] })
            }
        }).result();

        nodeRuntime.log(`[Llama-3] HTTP status: ${groqRes.statusCode}`);
        if (groqRes.statusCode === 200) {
            const rawLlama = JSON.parse(new TextDecoder().decode(groqRes.body)).choices[0].message.content;
            nodeRuntime.log(`[Llama-3] Response (truncated to 800): ${rawLlama.slice(0, 800)}`);
            const r = JSON.parse(rawLlama);
            // Union of Fears: flag if EITHER model says yes
            if (r.obfuscatedTax) obfuscatedTax = 1;
            if (r.privilegeEscalation) privilegeEscalation = 1;
            if (r.externalCallRisk) externalCallRisk = 1;
            if (r.logicBomb) logicBomb = 1;
            nodeRuntime.log(`[Llama-3] Bits: tax=${r.obfuscatedTax} priv=${r.privilegeEscalation} extCall=${r.externalCallRisk} bomb=${r.logicBomb}`);
            nodeRuntime.log(`[Llama-3] Reasoning: ${String(r.reasoning).slice(0, 700)}`);
        } else {
            nodeRuntime.log(`[Llama-3] ERROR HTTP ${groqRes.statusCode}`);
        }

        nodeRuntime.log(`[AI] Union of Fears — obfuscatedTax=${obfuscatedTax} privilegeEscalation=${privilegeEscalation} externalCallRisk=${externalCallRisk} logicBomb=${logicBomb}`);
    } else {
        nodeRuntime.log(`[AI] SKIPPED — no source code found for ${targetAddress} (unverified contract)`);
    }

    return { obfuscatedTax, privilegeEscalation, externalCallRisk, logicBomb };
};

// ─── Main DON Trigger ─────────────────────────────────────────────────────────
// V4 NOTE: The AuditRequested event signature is now emitted by AegisModule.sol,
// but is structurally IDENTICAL to V3:
//   AuditRequested(uint256 indexed tradeId, address indexed user,
//                  address indexed targetToken, string firewallConfig)
// So topic parsing is unchanged.
const onAuditTrigger = (runtime: Runtime<Config>, log: EVMLog): string => {
    runtime.log("🛡️ AegisModule V4 | AuditRequested intercepted");

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
    try {
        const parsed = JSON.parse(firewallConfig);
        if (typeof parsed.maxTax === 'number') maxTax = parsed.maxTax;
        if (typeof parsed.blockProxies === 'boolean') blockProxies = parsed.blockProxies;
        if (typeof parsed.strictLogic === 'boolean') strictLogic = parsed.strictLogic;
        if (typeof parsed.blockHoneypots === 'boolean') blockHoneypots = parsed.blockHoneypots;
        if (typeof parsed.allowUnverified === 'boolean') allowUnverified = parsed.allowUnverified;
    } catch { /* use defaults */ }

    // Fetch secrets
    const basescanKey = runtime.getSecret({ id: "AEGIS_BASESCAN_SECRET" }).result().value;
    const openAiKey = runtime.getSecret({ id: "AEGIS_OPENAI_SECRET" }).result().value;
    const groqKey = runtime.getSecret({ id: "AEGIS_GROQ_SECRET" }).result().value;

    // Phase 1: GoPlus (DON node-mode with BFT median consensus)
    const staticResult = runtime.runInNodeMode(
        performStaticAnalysis,
        ConsensusAggregationByFields<AuditResult>({
            targetAddress: identical,
            goPlusStatus: ignore,
            unverifiedCode: median,
            sellRestriction: median,
            honeypot: median,
            proxyContract: median,
            obfuscatedTax: median,
            privilegeEscalation: median,
            externalCallRisk: median,
            logicBomb: median,
        })
    )(log).result();

    const targetAddress = staticResult.targetAddress;

    // Phase 2 + 3: BaseScan ConfidentialHTTP fetch + Dual-LLM consensus
    // These run in runInNodeMode because they are non-BFT operations (standard APIs).
    // nodeRuntime.log() inside this block surfaces as [USER LOG] in simulate output.
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


    // ─── Assemble 8-bit risk matrix ──────────────────────────────────────
    let riskMatrix = 0;
    if (staticResult.unverifiedCode && !allowUnverified) riskMatrix |= 1;
    if (staticResult.sellRestriction) riskMatrix |= 2;
    if (staticResult.honeypot && blockHoneypots) riskMatrix |= 4;
    if (staticResult.proxyContract && blockProxies) riskMatrix |= 8;
    if (obfuscatedTax) riskMatrix |= 16;
    if (privilegeEscalation) riskMatrix |= 32;
    if (externalCallRisk) riskMatrix |= 64;
    if (logicBomb) riskMatrix |= 128;

    runtime.log(`⚖️ Final Risk Code: ${riskMatrix}`);

    // ─── Parse tradeId from AuditRequested topics[1] ─────────────────────
    const tradeIdHex = bytesToHex(log.topics[1]);
    const tradeId = BigInt(tradeIdHex.startsWith("0x") ? tradeIdHex : "0x" + tradeIdHex);

    // ─── ABI-encode onReport payload: (uint256 tradeId, uint256 riskScore) ─
    // V4: This sends to AegisModule.onReport() — same ABI as V3 AegisVault.onReport()
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

    // V4: receiver is AegisModule address (not AegisVault)
    const evmClient = new EVMClient(network!.chainSelector.selector);
    const txRes = evmClient.writeReport(runtime, {
        receiver: runtime.config.vaultAddress, // AegisModule address
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
            // Listen for AuditRequested events from AegisModule
            evmClient.logTrigger({ addresses: [hexToBase64(config.vaultAddress)] }),
            onAuditTrigger
        )
    ];
};

export async function main() {
    const runner = await Runner.newRunner<Config>();
    await runner.run(initWorkflow);
}
