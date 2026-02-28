/**
 * V5 Safe Setup — Pure Configuration Builders (no network, no side-effects)
 * Exported for unit testing. All functions are synchronous and deterministic.
 */

import { getAddress, type Address, type Hex } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { type Module } from "@rhinestone/module-sdk";

// ─── Public constants ──────────────────────────────────────────────────────
export const ENTRYPOINT_V07 = entryPoint07Address as Address;
export const AEGIS_MODULE_TYPE = "executor" as const;

/**
 * Builds Safe account config for permissionless toSafeSmartAccount().
 * Uses current timestamp as saltNonce for unique-per-run Safe addresses.
 */
export function buildSafeConfig(ownerAddress: Address) {
    return {
        owners: [ownerAddress],
        threshold: 1,
        version: "1.4.1" as const,
        entryPoint: {
            address: ENTRYPOINT_V07,
            version: "0.7" as const,
        },
        saltNonce: BigInt(Math.floor(Date.now() / 1000)),
    };
}

/**
 * Builds the AegisModule Rhinestone Module config.
 *
 * Rhinestone Module shape (v0.4.0):
 *   address + module = same address (both required by SDK)
 *   additionalContext = "0x" (not used by AegisModule)
 *   AegisModule.onInstall() is a no-op — initData = "0x"
 */
export function buildAegisModuleConfig(moduleAddress: Address): Module {
    const addr = getAddress(moduleAddress);
    return {
        address: addr,
        module: addr,
        type: AEGIS_MODULE_TYPE,
        initData: "0x" as Hex,
        deInitData: "0x" as Hex,
        additionalContext: "0x" as Hex,
    };
}
