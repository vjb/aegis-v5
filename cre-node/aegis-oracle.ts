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
        source: `// Honeypot — allowlist-only transfers`
    },
    "0x000000000000000000000000000000000000000c": {
        name: "TaxToken",
        goplus: { is_open_source: "1", cannot_sell_all: "1", is_honeypot: "0", is_proxy: "0" },
        source: `// 99% sell tax`
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
    const mockData = MOCK_REGISTRY[targetAddress];

    // Phase 2: BaseScan source fetch (Confidential HTTP)
    const confidentialClient = new ConfidentialHTTPClient();
    let sourceCode = "";
    let contractName = "";

    if (mockData) {
        sourceCode = mockData.source;
        contractName = mockData.name;
    } else {
        let currentAddress = targetAddress;
        for (let i = 0; i < 2; i++) {
            const bsUrl = `https://api.etherscan.io/v2/api?chainid=8453&module=contract&action=getsourcecode&address=${currentAddress}&apikey=${basescanKey}`;
            const bsRes = confidentialClient.sendRequest(runtime, {
                vaultDonSecrets: [{ key: "AEGIS_BASESCAN_SECRET", namespace: "aegis" }],
                request: { url: bsUrl, method: "GET" }
            }).result();
            if (bsRes.statusCode !== 200) break;
            const bsBody = JSON.parse(new TextDecoder().decode(bsRes.body));
            if (bsBody.status !== "1" || !bsBody.result?.length) break;
            const contractData = bsBody.result[0];
            sourceCode = contractData.SourceCode;
            contractName = contractData.ContractName;
            if (contractData.Proxy === "1" && contractData.Implementation) { currentAddress = contractData.Implementation; continue; }
            break;
        }
        if (sourceCode.length > 15000) sourceCode = sourceCode.slice(0, 15000);
    }

    // Phase 3: Dual-model AI consensus (Confidential HTTP)
    let obfuscatedTax = 0, privilegeEscalation = 0, externalCallRisk = 0, logicBomb = 0;

    if (sourceCode && sourceCode.length > 0 && !(mockData && targetAddress === "0x000000000000000000000000000000000000000b")) {
        const aiPrompt = `You are the Aegis Protocol Lead Security Auditor. Analyze the following smart contract.
Return ONLY a JSON object with keys: obfuscatedTax (bool), privilegeEscalation (bool), externalCallRisk (bool), logicBomb (bool), reasoning (string).
Firewall rules: maxTax=${maxTax}%, blockProxies=${blockProxies}, strictLogic=${strictLogic}, blockHoneypots=${blockHoneypots}.
Contract: ${sourceCode}`;

        // OpenAI GPT-4o
        const openAiRes = confidentialClient.sendRequest(runtime, {
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

        if (openAiRes.statusCode === 200) {
            const r = JSON.parse(JSON.parse(new TextDecoder().decode(openAiRes.body)).choices[0].message.content);
            if (r.obfuscatedTax) obfuscatedTax = 1;
            if (r.privilegeEscalation) privilegeEscalation = 1;
            if (r.externalCallRisk) externalCallRisk = 1;
            if (r.logicBomb) logicBomb = 1;
        }

        // Groq Llama-3
        const groqRes = confidentialClient.sendRequest(runtime, {
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

        if (groqRes.statusCode === 200) {
            const r = JSON.parse(JSON.parse(new TextDecoder().decode(groqRes.body)).choices[0].message.content);
            // Union of Fears: flag if EITHER model flags it
            if (r.obfuscatedTax) obfuscatedTax = 1;
            if (r.privilegeEscalation) privilegeEscalation = 1;
            if (r.externalCallRisk) externalCallRisk = 1;
            if (r.logicBomb) logicBomb = 1;
        }
    }

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
