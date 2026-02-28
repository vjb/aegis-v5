/**
 * ═══════════════════════════════════════════════════════════════
 * V5 Phase 3 TDD — ERC-7715 SmartSessions + Agent Session Key
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests written BEFORE implementation (TDD Red → Green).
 * All tests are UNIT — no chain, no bundler required.
 */

import { type Address, type Hex } from "viem";
import {
    SMART_SESSIONS_VALIDATOR_ADDRESS,
    SELECTOR_REQUEST_AUDIT,
    SELECTOR_TRIGGER_SWAP,
    SESSION_MODES,
    buildAgentSession,
    getSmartSessionValidatorModule,
} from "../scripts/v5_session_config";

// ── Test constants ──────────────────────────────────────────────────────────
const MOCK_AGENT: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MOCK_MODULE: Address = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const MOCK_BUDGET = BigInt("10000000000000000"); // 0.01 ETH

// ── SmartSessions validator module ─────────────────────────────────────────
describe("getSmartSessionValidatorModule (unit)", () => {
    it("returns type=validator (not executor)", () => {
        const mod = getSmartSessionValidatorModule();
        expect(mod.type).toBe("validator");
    });

    it("has the canonical SmartSessions validator address", () => {
        const mod = getSmartSessionValidatorModule();
        expect(mod.address.toLowerCase()).toBe(
            SMART_SESSIONS_VALIDATOR_ADDRESS.toLowerCase()
        );
    });
});

// ── Function selectors ─────────────────────────────────────────────────────
describe("AegisModule function selectors (unit)", () => {
    it("requestAudit(address) selector is 4 bytes", () => {
        expect(SELECTOR_REQUEST_AUDIT).toMatch(/^0x[0-9a-fA-F]{8}$/);
    });

    it("triggerSwap(address,uint256,uint256) selector is 4 bytes", () => {
        expect(SELECTOR_TRIGGER_SWAP).toMatch(/^0x[0-9a-fA-F]{8}$/);
    });

    it("selectors are distinct (no collision)", () => {
        expect(SELECTOR_REQUEST_AUDIT).not.toBe(SELECTOR_TRIGGER_SWAP);
    });
});

// ── Session config ──────────────────────────────────────────────────────────
describe("buildAgentSession (unit)", () => {
    let session: ReturnType<typeof buildAgentSession>;

    beforeEach(() => {
        session = buildAgentSession(MOCK_AGENT, MOCK_MODULE, MOCK_BUDGET);
    });

    it("specifies the SmartSessions validator as session validator", () => {
        expect(session.sessionValidator.toLowerCase()).toBe(
            SMART_SESSIONS_VALIDATOR_ADDRESS.toLowerCase()
        );
    });

    it("encodes agent address in sessionValidatorInitData", () => {
        // initData encodes the session key (agent address) as checksummed Hex
        expect(session.sessionValidatorInitData.toLowerCase()).toContain(
            MOCK_AGENT.toLowerCase().replace("0x", "")
        );
    });

    it("permits exactly 2 actions (requestAudit + triggerSwap)", () => {
        expect(session.actions).toHaveLength(2);
    });

    it("first action targets AegisModule with requestAudit selector", () => {
        const action = session.actions[0];
        expect(action.actionTarget.toLowerCase()).toBe(MOCK_MODULE.toLowerCase());
        expect(action.actionTargetSelector).toBe(SELECTOR_REQUEST_AUDIT);
    });

    it("second action targets AegisModule with triggerSwap selector", () => {
        const action = session.actions[1];
        expect(action.actionTarget.toLowerCase()).toBe(MOCK_MODULE.toLowerCase());
        expect(action.actionTargetSelector).toBe(SELECTOR_TRIGGER_SWAP);
    });

    it("has a 32-byte salt", () => {
        expect(session.salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });
});

// ── SmartSessionMode ────────────────────────────────────────────────────────
describe("SESSION_MODES (unit)", () => {
    it("USE mode = 0x00 (agent presents existing signed session)", () => {
        expect(SESSION_MODES.USE).toBe("0x00");
    });

    it("ENABLE mode = 0x01 (agent enables + uses in same UserOp)", () => {
        expect(SESSION_MODES.ENABLE).toBe("0x01");
    });

    it("UNSAFE_ENABLE mode = 0x02 (skip policy checks — dev only)", () => {
        expect(SESSION_MODES.UNSAFE_ENABLE).toBe("0x02");
    });
});
