// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import { AegisModule } from "src/AegisModule.sol";

/**
 * @title AegisModuleTest V4 — TDD Test Suite
 *
 * Test coverage:
 *   1. requestAudit — emits AuditRequested, requires authorized caller
 *   2. onReport — clearance granted on riskScore=0
 *   3. onReport — clearance denied on riskScore>0
 *   4. onReport — reverts if caller is not keystoneForwarder
 *   5. triggerSwap — reverts if token not cleared
 *   6. triggerSwap — clearance consumed after swap (anti-replay CEI)
 *   7. tradeId — increments correctly across multiple requests
 *   8. subscribeAgent — grants agent budget
 *   9. revokeAgent — zeroes agent budget, blocks requestAudit
 *  10. onReportDirect — owner can simulate oracle callback
 *  11. depositETH — treasury receives ETH
 *  12. budget — agent cannot exceed budget cap
 */
contract AegisModuleTest is Test {
    AegisModule public module;

    address public owner = address(this);
    address public forwarder = address(0xF04AFB11);
    address public agent1 = address(0xa6e00001);
    address public agent2 = address(0xa6e00002);
    address public token = address(0x70770001);
    address public honeypot = address(0x40770002);

    function setUp() public {
        module = new AegisModule(forwarder);
        // Fund module treasury for swap tests (fork tests would hit Uniswap)
        vm.deal(address(module), 10 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 1: requestAudit (authorized)
    // ═══════════════════════════════════════════════════════════════════════
    function test_requestAudit_emitsEvent() public {
        // Owner subscribes agent1
        module.subscribeAgent(agent1, 5 ether);

        // Expect AuditRequested event
        vm.expectEmit(true, true, true, false);
        emit AegisModule.AuditRequested(0, agent1, token, "");

        vm.prank(agent1);
        uint256 tradeId = module.requestAudit(token);

        assertEq(tradeId, 0);
        (address storedToken, bool exists) = module.getTradeRequest(0);
        assertEq(storedToken, token);
        assertTrue(exists);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 2: unauthorized agent cannot requestAudit
    // ═══════════════════════════════════════════════════════════════════════
    function test_requestAudit_blocksUnauthorizedAgent() public {
        // agent2 has no allowance and is not owner
        vm.prank(agent2);
        vm.expectRevert(AegisModule.NotAuthorized.selector);
        module.requestAudit(token);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 3: onReport — riskScore=0 → clearance granted
    // ═══════════════════════════════════════════════════════════════════════
    function test_onReport_clearance() public {
        // Owner requests audit directly
        module.requestAudit(token);

        vm.expectEmit(true, false, false, true);
        emit AegisModule.ClearanceUpdated(token, true);

        vm.prank(forwarder);
        module.onReport(0, 0);

        assertTrue(module.isApproved(token));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 4: onReport — riskScore>0 → clearance denied
    // ═══════════════════════════════════════════════════════════════════════
    function test_onReport_denial() public {
        module.requestAudit(honeypot);

        vm.expectEmit(true, false, false, true);
        emit AegisModule.ClearanceDenied(honeypot, 5);

        vm.prank(forwarder);
        module.onReport(0, 5); // riskScore=5 (unverified + honeypot)

        assertFalse(module.isApproved(honeypot));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 5: onReport — keystoneForwarder guard
    // ═══════════════════════════════════════════════════════════════════════
    function test_onReport_keystoneGuard() public {
        module.requestAudit(token);

        vm.prank(address(0xBAD));
        vm.expectRevert(AegisModule.NotKeystoneForwarder.selector);
        module.onReport(0, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 6: triggerSwap — reverts if not cleared
    // ═══════════════════════════════════════════════════════════════════════
    function test_triggerSwap_requiresClearance() public {
        // token is NOT cleared — should revert
        vm.expectRevert(AegisModule.TokenNotCleared.selector);
        module.triggerSwap(token, 0.01 ether, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 7: triggerSwap — CEI pattern & anti-replay
    // ═══════════════════════════════════════════════════════════════════════
    function test_triggerSwap_consumesClearance() public {
        // Grant clearance via onReportDirect
        module.requestAudit(token);
        module.onReportDirect(0, 0);
        assertTrue(module.isApproved(token), "Should be approved before swap");

        // Swap should SUCCEED with mock swap (no more real Uniswap)
        // Expect SwapExecuted event with mock 1:1000 ratio
        vm.expectEmit(true, false, false, true);
        emit AegisModule.SwapExecuted(token, 0.01 ether, 0.01 ether * 1000);

        module.triggerSwap(token, 0.01 ether, 1);

        // Clearance consumed (anti-replay CEI pattern proven)
        assertFalse(module.isApproved(token), "Clearance must be consumed after swap");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 8: tradeId — increments correctly
    // ═══════════════════════════════════════════════════════════════════════
    function test_tradeId_increment() public {
        address token2 = address(0x7077e2);
        address token3 = address(0x7077e3);

        uint256 id0 = module.requestAudit(token);
        uint256 id1 = module.requestAudit(token2);
        uint256 id2 = module.requestAudit(token3);

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(module.nextTradeId(), 3);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 9: subscribeAgent and revokeAgent
    // ═══════════════════════════════════════════════════════════════════════
    function test_subscribeAgent() public {
        module.subscribeAgent(agent1, 3 ether);
        assertEq(module.agentAllowances(agent1), 3 ether);

        vm.expectEmit(true, false, false, true);
        emit AegisModule.AgentSubscribed(agent1, 3 ether);
        module.subscribeAgent(agent1, 3 ether); // re-subscribe emits again
    }

    function test_revokeAgent_blocksAudit() public {
        module.subscribeAgent(agent1, 3 ether);
        module.revokeAgent(agent1);
        assertEq(module.agentAllowances(agent1), 0);

        vm.prank(agent1);
        vm.expectRevert(AegisModule.NotAuthorized.selector);
        module.requestAudit(token);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 10: onReportDirect — owner can simulate oracle
    // ═══════════════════════════════════════════════════════════════════════
    function test_onReportDirect_ownerCanClear() public {
        module.requestAudit(token);
        module.onReportDirect(0, 0); // no vm.prank — owner is test contract
        assertTrue(module.isApproved(token));
    }

    function test_onReportDirect_blocksRandomCaller() public {
        module.requestAudit(token);
        vm.prank(address(0xBAD));
        vm.expectRevert(AegisModule.NotAuthorized.selector);
        module.onReportDirect(0, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 11: depositETH — treasury receives ETH
    // ═══════════════════════════════════════════════════════════════════════
    function test_depositETH() public {
        uint256 before = address(module).balance;
        module.depositETH{ value: 1 ether }();
        assertEq(address(module).balance, before + 1 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 12: agent budget cap
    // ═══════════════════════════════════════════════════════════════════════
    function test_triggerSwap_insufficientBudget() public {
        module.subscribeAgent(agent1, 0.005 ether); // only 0.005 ETH budget

        // Clear the token
        module.requestAudit(token);
        module.onReportDirect(0, 0);

        // Try to spend 0.01 ETH but budget is only 0.005 ETH
        vm.prank(agent1);
        vm.expectRevert(AegisModule.InsufficientBudget.selector);
        module.triggerSwap(token, 0.01 ether, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 13: triggerSwap — mock swap emits SwapExecuted (5.5.1b)
    // ═══════════════════════════════════════════════════════════════════════
    function test_triggerSwap_mockEmitsEvent() public {
        module.subscribeAgent(agent1, 1 ether);

        module.requestAudit(token);
        module.onReportDirect(0, 0);

        // Agent triggers swap — mock emits event with 1:1000 ratio
        vm.prank(agent1);
        vm.expectEmit(true, false, false, true);
        emit AegisModule.SwapExecuted(token, 0.02 ether, 0.02 ether * 1000);
        module.triggerSwap(token, 0.02 ether, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 14: only owner can subscribeAgent (5.5.1c)
    // ═══════════════════════════════════════════════════════════════════════
    function test_subscribeAgent_onlyOwner() public {
        vm.prank(agent1);
        vm.expectRevert(AegisModule.NotOwner.selector);
        module.subscribeAgent(agent2, 1 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 15: random address cannot triggerSwap (5.5.1c)
    // ═══════════════════════════════════════════════════════════════════════
    function test_triggerSwap_onlyOwnerOrAgent() public {
        // Clear token
        module.requestAudit(token);
        module.onReportDirect(0, 0);

        // Random address (not owner, not subscribed) tries to swap
        // Guard: `agentAllowances[msg.sender] < _amountIn && msg.sender != owner`
        // → InsufficientBudget (0 budget + not owner)
        vm.prank(address(0xDEAD));
        vm.expectRevert(AegisModule.InsufficientBudget.selector);
        module.triggerSwap(token, 0.01 ether, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TEST 16: agent budget deducted after swap (5.5.1b)
    // ═══════════════════════════════════════════════════════════════════════
    function test_triggerSwap_deductsBudget() public {
        module.subscribeAgent(agent1, 1 ether);

        module.requestAudit(token);
        module.onReportDirect(0, 0);

        vm.prank(agent1);
        module.triggerSwap(token, 0.01 ether, 1);

        // Budget should be deducted by the swap amount
        assertEq(module.agentAllowances(agent1), 1 ether - 0.01 ether);
    }
}

