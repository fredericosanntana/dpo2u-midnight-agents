// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DPO2UToken
 * @notice ERC-20 token with transfer fee mechanism for self-funding
 * @dev 1% transfer fee sent to Treasury. Fee-exempt addresses configurable.
 */
contract DPO2UToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 1e18; // 100M tokens
    uint256 public constant MAX_FEE_BPS = 500; // 5% max fee cap
    uint256 public feeBps = 100; // 1% default fee (basis points)

    address public treasury;
    mapping(address => bool) public feeExempt;

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeExemptUpdated(address indexed account, bool exempt);

    error FeeTooHigh(uint256 requested, uint256 max);
    error ZeroAddress();

    constructor(address _treasury) ERC20("DPO2U", "DPO2U") ERC20Permit("DPO2U") Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;

        // Treasury and deployer are fee-exempt
        feeExempt[_treasury] = true;
        feeExempt[msg.sender] = true;

        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /**
     * @notice Override transfer to apply fee
     */
    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0) || feeExempt[from] || feeExempt[to] || feeBps == 0) {
            super._update(from, to, amount);
            return;
        }

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 netAmount = amount - fee;

        super._update(from, to, netAmount);
        if (fee > 0) {
            super._update(from, treasury, fee);
        }
    }

    /**
     * @notice Set treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address old = treasury;
        // Remove old treasury exemption, add new
        feeExempt[old] = false;
        treasury = _treasury;
        feeExempt[_treasury] = true;
        emit TreasuryUpdated(old, _treasury);
    }

    /**
     * @notice Update transfer fee in basis points
     * @param _feeBps New fee in basis points (max 500 = 5%)
     */
    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);
        uint256 old = feeBps;
        feeBps = _feeBps;
        emit FeeUpdated(old, _feeBps);
    }

    /**
     * @notice Set fee exemption for an address (LP pools, staking, etc.)
     * @param account Address to exempt
     * @param exempt Whether to exempt
     */
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        feeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }
}
