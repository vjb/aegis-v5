// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { ERC7579ExecutorBase } from "modulekit/Modules.sol";

/**
 * @title AegisModule V4 — ERC-7579 AI Security Firewall Executor
 * @notice An ERC-7579 Type-2 Executor Module that installs onto a Smart Account
 *         (e.g., Safe) and acts as a zero-custody AI security gateway with
 *         real Uniswap V3 swaps executed directly from the module's treasury.
 *
 *         Architecture:
 *           AI Agent (subscribed wallet) → requestAudit(token)
 *             → emits AuditRequested → Chainlink CRE DON audits token
 *             → onReport(tradeId, 0) → clears token
 *             → triggerSwap(token, amount) → real Uniswap V3 exactInputSingle()
 *             → purchased tokens land in this module's treasury
 *
 *         Multi-agent: Owner subscribes multiple AI agents with individual ETH budgets.
 *         Each agent is independently allowlisted and budget-capped.
 *
 * @dev Inherits ERC7579ExecutorBase from rhinestone/modulekit.
 *      Real Uniswap V3 swap: tries 0.3%, 0.05%, 1% fee tiers automatically.
 *      Base mainnet addresses hardcoded (SwapRouter02 + WETH).
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @dev Uniswap V3 SwapRouter02 — Base mainnet 0x2626664c2603336E57B271c5C0b26F421741e481
interface IV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

// ─── AegisModule ─────────────────────────────────────────────────────────────

contract AegisModule is ERC7579ExecutorBase {

    // ─── Base Mainnet Constants ────────────────────────────────────────
    address public constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address public constant WETH        = 0x4200000000000000000000000000000000000006;

    // ─── Ownership ────────────────────────────────────────────────────
    address public owner;

    // ─── Multi-Agent Budget Tracking ──────────────────────────────────
    mapping(address => uint256) public agentAllowances;

    // ─── Trade Request State ──────────────────────────────────────────
    struct TradeRequest {
        address targetToken;
        bool exists;
    }
    mapping(uint256 => TradeRequest) public tradeRequests;
    uint256 public nextTradeId;

    // ─── Clearance State (one-shot per audit cycle) ───────────────────
    mapping(address => bool) public isApproved;

    // ─── Access Control ───────────────────────────────────────────────
    /// The Chainlink KeystoneForwarder — ONLY address permitted to call onReport().
    address public immutable keystoneForwarder;

    // ─── Firewall Config ──────────────────────────────────────────────
    string public firewallConfig =
        '{"maxTax":5,"blockProxies":true,"strictLogic":true,"blockHoneypots":true}';

    // ─── Events ───────────────────────────────────────────────────────
    event AuditRequested(
        uint256 indexed tradeId,
        address indexed user,
        address indexed targetToken,
        string firewallConfig
    );
    event ClearanceUpdated(address indexed token, bool approved);
    event ClearanceDenied(address indexed token, uint256 riskScore);
    event SwapExecuted(address indexed targetToken, uint256 amountIn, uint256 amountOut);
    event AgentSubscribed(address indexed agent, uint256 allowance);
    event AgentRevoked(address indexed agent);
    event TreasuryDeposit(address indexed from, uint256 amount);
    event TreasuryWithdrawal(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────
    error NotKeystoneForwarder();
    error NoPendingRequest();
    error TokenNotCleared();
    error InvalidToken();
    error NotAuthorized();
    error NotOwner();
    error InsufficientBudget();
    error InsufficientTreasury();
    error AllSwapsFailed();
    error ZeroSlippageNotAllowed();

    // ─── Modifiers ────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOwnerOrAgent() {
        if (msg.sender != owner && agentAllowances[msg.sender] == 0) revert NotAuthorized();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address _keystoneForwarder) {
        keystoneForwarder = _keystoneForwarder;
        owner = msg.sender;
    }

    /// @notice Accept ETH deposits into the module treasury
    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════════════
    //  ERC-7579 MODULE LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    function onInstall(bytes calldata /*data*/) external override {}
    function onUninstall(bytes calldata /*data*/) external override {}

    function isInitialized(address /*smartAccount*/) external pure returns (bool) {
        return true;
    }

    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == TYPE_EXECUTOR;
    }

    function name() external pure returns (string memory) { return "AegisModule"; }
    function version() external pure returns (string memory) { return "4.0.0"; }

    // ═══════════════════════════════════════════════════════════════════════
    //  TREASURY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Owner deposits ETH into the module treasury
    function depositETH() external payable {
        require(msg.value > 0, "Must send ETH");
        emit TreasuryDeposit(msg.sender, msg.value);
    }

    /// @notice Owner subscribes an AI agent with an ETH spending budget
    function subscribeAgent(address _agent, uint256 _budget) external onlyOwner {
        require(_agent != address(0), "Invalid agent");
        agentAllowances[_agent] = _budget;
        emit AgentSubscribed(_agent, _budget);
    }

    /// @notice Owner revokes an agent's authority and zeroes its budget
    function revokeAgent(address _agent) external onlyOwner {
        agentAllowances[_agent] = 0;
        emit AgentRevoked(_agent);
    }

    /// @notice Owner updates the vault-level firewall policy
    function setFirewallConfig(string calldata _config) external onlyOwner {
        firewallConfig = _config;
    }

    /// @notice Owner withdraws ETH from the treasury
    function withdrawETH(uint256 _amount) external onlyOwner {
        require(address(this).balance >= _amount, "Insufficient balance");
        (bool sent,) = payable(owner).call{value: _amount}("");
        require(sent, "Transfer failed");
        emit TreasuryWithdrawal(owner, _amount);
    }

    /// @notice Owner withdraws purchased ERC20 tokens from the treasury
    function withdrawERC20(address _token, uint256 _amount) external onlyOwner {
        require(IERC20(_token).balanceOf(address(this)) >= _amount, "Insufficient ERC20");
        require(IERC20(_token).transfer(owner, _amount), "Transfer failed");
    }

    function getTreasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STEP 1 — SUBMIT TRADE INTENT
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice The AI Agent submits a trade intent for a target token.
     *         The vault's owner-set firewallConfig is emitted so the CRE DON can apply it.
     * @param _token The ERC-20 token the agent wants to buy.
     * @return tradeId The ID of this audit request.
     */
    function requestAudit(address _token) external onlyOwnerOrAgent returns (uint256 tradeId) {
        if (_token == address(0)) revert InvalidToken();

        tradeId = nextTradeId++;
        tradeRequests[tradeId] = TradeRequest({ targetToken: _token, exists: true });

        emit AuditRequested(tradeId, msg.sender, _token, firewallConfig);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STEP 2 — ORACLE REPORT CALLBACK
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Called by the Chainlink KeystoneForwarder when the CRE DON has rendered
     *         its verdict. A riskScore of 0 means the token is CLEARED.
     */
    function onReport(uint256 tradeId, uint256 riskScore) external {
        if (msg.sender != keystoneForwarder) revert NotKeystoneForwarder();
        _processReport(tradeId, riskScore);
    }

    /**
     * @notice Owner-accessible override for demos and local testing.
     *         Simulates the oracle callback without requiring the real KeystoneForwarder.
     */
    function onReportDirect(uint256 tradeId, uint256 riskScore) external {
        if (msg.sender != keystoneForwarder && msg.sender != owner) revert NotAuthorized();
        _processReport(tradeId, riskScore);
    }

    function _processReport(uint256 tradeId, uint256 riskScore) internal {
        TradeRequest memory req = tradeRequests[tradeId];
        if (!req.exists) revert NoPendingRequest();

        delete tradeRequests[tradeId]; // Prevent replay

        if (riskScore == 0) {
            isApproved[req.targetToken] = true;
            emit ClearanceUpdated(req.targetToken, true);
        } else {
            emit ClearanceDenied(req.targetToken, riskScore);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STEP 3 — JIT UNISWAP V3 SWAP
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Called by an AI Agent to execute a real Uniswap V3 swap from the treasury.
     *         Requires prior clearance from the CRE oracle (isApproved[token] == true).
     *
     *         Automatically tries 3 fee tiers: 0.3% → 0.05% → 1%
     *         Purchased tokens land in this module (treasury).
     *
     * @param _token The target token (must be cleared by oracle)
     * @param _amountIn ETH amount in wei to spend from the treasury
     * @param _amountOutMinimum Minimum tokens to receive (slippage protection)
     */
    function triggerSwap(
        address _token,
        uint256 _amountIn,
        uint256 _amountOutMinimum
    ) external {
        // ── Guards ──────────────────────────────────────────────────────────
        if (agentAllowances[msg.sender] < _amountIn && msg.sender != owner) revert InsufficientBudget();
        if (!isApproved[_token]) revert TokenNotCleared();
        if (address(this).balance < _amountIn) revert InsufficientTreasury();
        if (_amountOutMinimum == 0) revert ZeroSlippageNotAllowed();

        // ── Deduct budget BEFORE external call (CEI) ───────────────────────
        if (msg.sender != owner) {
            agentAllowances[msg.sender] -= _amountIn;
        }

        // ── Reset clearance BEFORE external call (anti-replay + CEI) ───────
        isApproved[_token] = false;

        // ── Real Uniswap V3 swap — try 3 fee tiers ─────────────────────────
        uint24[3] memory feeTiers = [uint24(3000), uint24(500), uint24(10000)];

        for (uint256 i = 0; i < feeTiers.length; i++) {
            IV3SwapRouter.ExactInputSingleParams memory params = IV3SwapRouter.ExactInputSingleParams({
                tokenIn:           WETH,
                tokenOut:          _token,
                fee:               feeTiers[i],
                recipient:         address(this), // tokens stay in module treasury
                amountIn:          _amountIn,
                amountOutMinimum:  _amountOutMinimum,
                sqrtPriceLimitX96: 0
            });

            try IV3SwapRouter(SWAP_ROUTER).exactInputSingle{value: _amountIn}(params)
                returns (uint256 amountOut)
            {
                emit SwapExecuted(_token, _amountIn, amountOut);
                return;
            } catch {
                // Try next fee tier
            }
        }

        // If all fee tiers fail, revert — budget and clearance already consumed
        // This is intentional: a swap failure is a protocol failure, not a retry
        revert AllSwapsFailed();
    }

    // ─── View helpers ─────────────────────────────────────────────────────
    function getTradeRequest(uint256 tradeId) external view returns (address targetToken, bool exists) {
        TradeRequest memory r = tradeRequests[tradeId];
        return (r.targetToken, r.exists);
    }
}
