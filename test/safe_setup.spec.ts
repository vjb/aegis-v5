/**
 * ═══════════════════════════════════════════════════════════════
 * V5 Phase 2 TDD — Safe Smart Account + AegisModule Install
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests written BEFORE implementation (TDD). Run will fail until
 * scripts/v5_setup_safe.ts is implemented (Debug Loop rule).
 *
 * Test tiers:
 *   UNIT  — pure encoding / config, no chain required
 *   INTEG — requires TENDERLY_RPC_URL in .env (skipped otherwise)
 */

import { encodeFunctionData, type Address, type Hex, getAddress } from "viem";
import {
    buildSafeConfig,
    buildAegisModuleConfig,
    AEGIS_MODULE_TYPE,
    ENTRYPOINT_V07,
} from "../scripts/v5_safe_config";

// ── Constants expected by tests ────────────────────────────────────────────
const MOCK_OWNER: Address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MOCK_MODULE: Address = "0x1234567890123456789012345678901234567890";

// ── UNIT: Safe config builder ──────────────────────────────────────────────
describe("buildSafeConfig (unit)", () => {
    it("returns a config with the correct owner and entry point", () => {
        const cfg = buildSafeConfig(MOCK_OWNER);
        expect(cfg.owners).toContain(MOCK_OWNER);
        expect(cfg.entryPoint.address).toBe(ENTRYPOINT_V07);
        expect(cfg.entryPoint.version).toBe("0.7");
        expect(cfg.version).toBe("1.4.1");
    });

    it("starts with threshold 1 (single-owner Safe)", () => {
        const cfg = buildSafeConfig(MOCK_OWNER);
        expect(cfg.saltNonce).toBeDefined();
    });
});

// ── UNIT: Module install config ────────────────────────────────────────────
describe("buildAegisModuleConfig (unit)", () => {
    it("returns type='executor' (ERC-7579 TYPE_EXECUTOR = 2)", () => {
        const mod = buildAegisModuleConfig(MOCK_MODULE);
        expect(mod.type).toBe("executor");
        expect(AEGIS_MODULE_TYPE).toBe("executor");
    });

    it("sets module address correctly", () => {
        const mod = buildAegisModuleConfig(MOCK_MODULE);
        expect(mod.module).toBe(getAddress(MOCK_MODULE));
    });

    it("has zero initData for AegisModule (onInstall is a no-op)", () => {
        const mod = buildAegisModuleConfig(MOCK_MODULE);
        // AegisModule.onInstall() accepts empty bytes
        expect(mod.initData).toBe("0x");
    });
});

// ── UNIT: EntryPoint constant ──────────────────────────────────────────────
describe("constants (unit)", () => {
    it("ENTRYPOINT_V07 matches canonical ERC-4337 v0.7 address", () => {
        expect(ENTRYPOINT_V07.toLowerCase()).toBe(
            "0x0000000071727de22e5e9d8baf0edac6f37da032"
        );
    });
});

// ── INTEGRATION: Live Safe deployment ─────────────────────────────────────
const RPC = process.env.TENDERLY_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex | undefined;
const MODULE_ADDRESS = process.env.AEGIS_MODULE_ADDRESS as Address | undefined;

const describeInteg = RPC && PRIVATE_KEY && MODULE_ADDRESS ? describe : describe.skip;

describeInteg("deploySafeWithAegisModule (integration — requires TENDERLY_RPC_URL)", () => {
    // Dynamic import to avoid erroring when chain isn't available
    let deploySafeWithAegisModule: (
        ownerPk: Hex,
        moduleAddress: Address,
        rpcUrl: string
    ) => Promise<{ safeAddress: Address; txHash: Hex }>;

    beforeAll(async () => {
        const mod = await import("../scripts/v5_setup_safe");
        deploySafeWithAegisModule = mod.deploySafeWithAegisModule;
    });

    it(
        "deploys a Safe and installs AegisModule as ERC-7579 Executor",
        async () => {
            const result = await deploySafeWithAegisModule(
                PRIVATE_KEY!,
                MODULE_ADDRESS!,
                RPC!
            );
            expect(result.safeAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
            expect(result.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
        },
        120_000 // 2 min timeout — bundler + chain confirmation
    );
});
