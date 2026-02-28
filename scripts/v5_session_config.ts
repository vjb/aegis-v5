/**
 * V5 Session Key Config — Pure Builders for ERC-7715 SmartSessions
 * No network calls. Exported for unit testing.
 *
 * ERC-7715 flow:
 *   1. Owner installs SmartSessionValidator as a 'validator' module on Safe
 *   2. Owner creates a Session: { sessionKey: agentAddr, target: module, selectors, valueLimit }
 *   3. Owner signs enableSessions action (on-chain via UserOp or off-chain EIP-712)
 *   4. Agent uses session signature to submit UserOps without the owner's key
 */

import { getAddress, toFunctionSelector, type Address, type Hex } from "viem";
import {
    getSmartSessionsValidator,
    SmartSessionMode,
    type Module,
    type Session,
} from "@rhinestone/module-sdk";

// ─── SmartSessions Validator (canonical, deployed by Rhinestone) ───────────
export const SMART_SESSIONS_VALIDATOR_ADDRESS =
    "0x00000000008bDABA73cD9815d79069c247Eb4bDA" as Address;

// ─── AegisModule function selectors ───────────────────────────────────────
// These are the ONLY two functions the session key is permitted to call
export const SELECTOR_REQUEST_AUDIT = toFunctionSelector(
    "requestAudit(address)"
) as Hex;

export const SELECTOR_TRIGGER_SWAP = toFunctionSelector(
    "triggerSwap(address,uint256,uint256)"
) as Hex;

/**
 * Returns the SmartSessionsValidator Rhinestone Module config.
 * Used to install the validator onto the Safe (alongside AegisModule executor).
 */
export function getSmartSessionValidatorModule(): Module {
    return getSmartSessionsValidator({ sessions: [] });
}

/**
 * Builds an ERC-7715 Session for an AI agent.
 *
 * Restricts the agent to ONLY:
 *   - AegisModule.requestAudit(address token)
 *   - AegisModule.triggerSwap(address, uint256, uint256)
 *
 * Value limit = agentBudget (enforced by spending limit policy).
 * Expiry = current time + durationSeconds (default 24h).
 *
 * @param agentAddress   The agent's EOA public address (session key)
 * @param moduleAddress  Deployed AegisModule address (permitted target)
 * @param agentBudget    Max ETH the agent can spend (in wei)
 * @param durationSeconds Session validity window (default: 86400 = 24h)
 */
export function buildAgentSession(
    agentAddress: Address,
    moduleAddress: Address,
    agentBudget: bigint,
    durationSeconds = 86400,
    chainId = BigInt(73578453)
): Session {
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + durationSeconds);

    return {
        sessionValidator: SMART_SESSIONS_VALIDATOR_ADDRESS,
        sessionValidatorInitData: getAddress(agentAddress) as Hex,
        salt: `0x${"00".repeat(32)}` as Hex,
        userOpPolicies: [],
        erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
        permitERC4337Paymaster: false,
        chainId,
        actions: [
            {
                // AegisModule.requestAudit(address)
                actionTarget: getAddress(moduleAddress),
                actionTargetSelector: SELECTOR_REQUEST_AUDIT,
                actionPolicies: [],
            },
            {
                // AegisModule.triggerSwap(address, uint256, uint256)
                actionTarget: getAddress(moduleAddress),
                actionTargetSelector: SELECTOR_TRIGGER_SWAP,
                actionPolicies: [],
            },
        ],
    };
}

/**
 * Returns the SmartSessionMode values for agent UserOp signing.
 * USE = agent presents signed session hash.
 * ENABLE = agent enables and uses in same UserOp (owner-signed message required).
 */
export const SESSION_MODES = SmartSessionMode;
