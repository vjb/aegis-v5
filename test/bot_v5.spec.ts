/**
 * ═══════════════════════════════════════════════════════════════
 * V5 Phase 4 TDD — Bot UserOp Call Builders
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests written BEFORE bot.ts implementation (TDD Red → Green).
 *
 * KEY ASSERTION: The V5 bot must use sendUserOperation (not sendTransaction).
 * The calls target AEGIS_MODULE_ADDRESS (permissionless wraps inner calls
 * in Safe.execute() automatically — the UserOp sender is the Safe Account).
 */

import { type Address } from "viem";
import {
    buildV5RequestAuditCall,
    buildV5TriggerSwapCall,
    AEGIS_MODULE_ABI,
    type UserOpCall,
} from "../scripts/v5_bot_config";
import {
    SELECTOR_REQUEST_AUDIT,
    SELECTOR_TRIGGER_SWAP,
} from "../scripts/v5_session_config";

// ── Constants ──────────────────────────────────────────────────────────────
const MOCK_MODULE: Address = "0x4B6F8B6F8b6F8B6F8b6F8B6F8b6F8B6F8b6F8B6F";
const MOCK_TOKEN: Address = "0x532f27101965dd16442E59d40670FaF5eBB142E4"; // BRETT
const MOCK_SAFE: Address = "0xDf37F91dEa7CBD496d4C75e80DF53b46D5Bb1A4";
const SWAP_AMOUNT = BigInt("10000000000000000"); // 0.01 ETH

// ── V5: Calls target AEGIS_MODULE (not SAFE directly) ─────────────────────
// Note: permissionless wraps { to: module, data } inside Safe.execute() calldata.
// The UserOp.sender = SAFE. The UserOp.callData = Safe.execute(to=module, data=...).
// From the TEST perspective, we only verify the inner call objects.
describe("buildV5RequestAuditCall (unit)", () => {
    let call: UserOpCall;

    beforeEach(() => {
        call = buildV5RequestAuditCall(MOCK_MODULE, MOCK_TOKEN);
    });

    it("targets AegisModule (NOT the Safe directly)", () => {
        expect(call.to.toLowerCase()).toBe(MOCK_MODULE.toLowerCase());
    });

    it("attaches zero ETH value (treasury pays, not the agent)", () => {
        expect(call.value).toBe(BigInt(0));
    });

    it("encodes requestAudit(address) selector correctly", () => {
        const selector = call.data.slice(0, 10); // "0x" + 8 hex chars
        expect(selector).toBe(SELECTOR_REQUEST_AUDIT);
    });

    it("encodes the token address as the only argument", () => {
        expect(call.data.toLowerCase()).toContain(
            MOCK_TOKEN.toLowerCase().replace("0x", "").padStart(64, "0")
        );
    });
});

describe("buildV5TriggerSwapCall (unit)", () => {
    let call: UserOpCall;

    beforeEach(() => {
        call = buildV5TriggerSwapCall(MOCK_MODULE, MOCK_TOKEN, SWAP_AMOUNT);
    });

    it("targets AegisModule", () => {
        expect(call.to.toLowerCase()).toBe(MOCK_MODULE.toLowerCase());
    });

    it("attaches zero ETH value (module treasury provides ETH for swaps)", () => {
        expect(call.value).toBe(BigInt(0));
    });

    it("encodes triggerSwap(address,uint256,uint256) — 3 params", () => {
        const selector = call.data.slice(0, 10);
        expect(selector).toBe(SELECTOR_TRIGGER_SWAP);
    });

    it("defaults amountOutMinimum to 1 (contract requires non-zero)", () => {
        // amountOutMinimum is the 3rd param — encoded at bytes 68-100
        const amountOutMinHex = call.data.slice(2 + 8 + 64 + 64, 2 + 8 + 64 + 64 + 64);
        expect(BigInt("0x" + amountOutMinHex)).toBe(BigInt(1));
    });

    it("is distinct from requestAudit calldata (different selector)", () => {
        const auditCall = buildV5RequestAuditCall(MOCK_MODULE, MOCK_TOKEN);
        expect(call.data.slice(0, 10)).not.toBe(auditCall.data.slice(0, 10));
    });
});

// ── Legacy vs Current calldata shape comparison ────────────────────────────────────
describe("Legacy vs V5 call structure", () => {
    it("V5 triggerSwap has 3 params, legacy bot.ts ABI had only 2 (bug fixed)", () => {
        // Legacy bot.ts had triggerSwap with only _token + _amount (missing _amountOutMinimum)
        // V5 correctly has all 3 params as per AegisModule.sol
        const call = buildV5TriggerSwapCall(MOCK_MODULE, MOCK_TOKEN, SWAP_AMOUNT);
        // Full calldata = 4 (selector) + 32*3 (args) = 100 bytes = 200 hex + "0x"
        expect(call.data.length).toBe(2 + 8 + 64 * 3); // "0x" + selector + 3 params
    });
});

// ═══════════════════════════════════════════════════════════════════════
//  Phase 5.5.2 — ERC-7715 Session Key Constraints
// ═══════════════════════════════════════════════════════════════════════
import {
    buildAgentSession,
    SMART_SESSIONS_VALIDATOR_ADDRESS,
} from "../scripts/v5_session_config";
import { toFunctionSelector, encodeFunctionData, type Hex } from "viem";

const MOCK_AGENT: Address = "0x1234567890AbCdEf1234567890AbCdEf12345678";

describe("ERC-7715 Session Key Constraints (5.5.2)", () => {
    const session = buildAgentSession(MOCK_AGENT, MOCK_MODULE, BigInt(1e18));

    it("session key targets ONLY the AegisModule address", () => {
        for (const action of session.actions) {
            expect(action.actionTarget.toLowerCase()).toBe(MOCK_MODULE.toLowerCase());
        }
    });

    it("session permits exactly 2 selectors: requestAudit + triggerSwap", () => {
        expect(session.actions).toHaveLength(2);
        const selectors = session.actions.map((a) => a.actionTargetSelector);
        expect(selectors).toContain(SELECTOR_REQUEST_AUDIT);
        expect(selectors).toContain(SELECTOR_TRIGGER_SWAP);
    });

    it("session DOES NOT permit arbitrary function selectors (e.g. ETH drain)", () => {
        const DRAIN_SELECTOR = toFunctionSelector("transfer(address,uint256)") as Hex;
        const selectors = session.actions.map((a) => a.actionTargetSelector);
        expect(selectors).not.toContain(DRAIN_SELECTOR);
    });

    it("session DOES NOT permit calling a random contract (only AegisModule)", () => {
        const RANDOM_CONTRACT: Address = "0xDeAdDeAdDeAdDeAdDeAdDeAdDeAdDeAdDeAdDeAd";
        for (const action of session.actions) {
            expect(action.actionTarget.toLowerCase()).not.toBe(RANDOM_CONTRACT.toLowerCase());
        }
    });

    it("session uses the SmartSessionsValidator (Rhinestone canonical)", () => {
        expect(session.sessionValidator.toLowerCase()).toBe(
            SMART_SESSIONS_VALIDATOR_ADDRESS.toLowerCase()
        );
    });

    it("session key = agent public address (embedded in initData)", () => {
        expect(session.sessionValidatorInitData.toLowerCase()).toContain(
            MOCK_AGENT.toLowerCase().replace("0x", "")
        );
    });
});
