// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/AegisModule.sol";

/**
 * @title MockERC20
 * @notice Minimal ERC20 for Base Sepolia testing — no permissions, free minting.
 */
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "not approved");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/**
 * @title DeployMocks
 * @notice Deploys MockBRETT, MockHoneypot, and AegisModule to Base Sepolia.
 *         Mints 1,000,000 of each token to the deployer.
 *
 * Usage:
 *   forge script script/DeployMocks.s.sol:DeployMocks \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 */
contract DeployMocks is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        // Deploy mock tokens
        MockERC20 mockBrett = new MockERC20("Mock BRETT", "mBRETT");
        MockERC20 mockHoneypot = new MockERC20("Mock Honeypot", "mHONEY");

        // Mint 1M of each to deployer
        mockBrett.mint(deployer, 1_000_000 ether);
        mockHoneypot.mint(deployer, 1_000_000 ether);

        // Deploy AegisModule with deployer as the keystoneForwarder (for testing)
        AegisModule aegisModule = new AegisModule(deployer);

        vm.stopBroadcast();

        // Log addresses
        console.log("===== DEPLOYMENT COMPLETE =====");
        console.log("MockBRETT:    ", address(mockBrett));
        console.log("MockHoneypot: ", address(mockHoneypot));
        console.log("AegisModule:  ", address(aegisModule));
        console.log("Deployer:     ", deployer);
        console.log("===============================");
    }
}
