// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @notice Multi-token treasury with role-based access and spending limits
 * @dev Accepts ETH and ERC-20 tokens. Operators have daily spending limits.
 */
contract Treasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    uint256 public maxPerTx = 500 * 1e6; // 500 USDC (6 decimals)
    uint256 public maxPerDay = 2000 * 1e6; // 2000 USDC/day

    struct DailySpend {
        uint256 amount;
        uint256 day;
    }

    mapping(address => DailySpend) public dailySpends; // operator => spend

    event Withdrawal(
        address indexed operator,
        address indexed token,
        address indexed to,
        uint256 amount,
        string reason
    );
    event EthReceived(address indexed from, uint256 amount);
    event LimitsUpdated(uint256 maxPerTx, uint256 maxPerDay);

    error ExceedsPerTxLimit(uint256 amount, uint256 limit);
    error ExceedsDailyLimit(uint256 spent, uint256 amount, uint256 limit);
    error ZeroAmount();
    error EthTransferFailed();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, admin);
    }

    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ERC-20 tokens from treasury
     * @param token ERC-20 token address
     * @param to Recipient address
     * @param amount Amount to withdraw
     * @param reason Human-readable reason for audit trail
     */
    function withdraw(
        address token,
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > maxPerTx) revert ExceedsPerTxLimit(amount, maxPerTx);

        _trackDailySpend(msg.sender, amount);

        IERC20(token).safeTransfer(to, amount);
        emit Withdrawal(msg.sender, token, to, amount, reason);
    }

    /**
     * @notice Withdraw ETH from treasury
     * @param to Recipient address
     * @param amount Amount in wei
     * @param reason Human-readable reason
     */
    function withdrawETH(
        address payable to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > maxPerTx) revert ExceedsPerTxLimit(amount, maxPerTx);

        _trackDailySpend(msg.sender, amount);

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
        emit Withdrawal(msg.sender, address(0), to, amount, reason);
    }

    /**
     * @notice Update spending limits (governor only)
     */
    function setLimits(uint256 _maxPerTx, uint256 _maxPerDay) external onlyRole(GOVERNOR_ROLE) {
        maxPerTx = _maxPerTx;
        maxPerDay = _maxPerDay;
        emit LimitsUpdated(_maxPerTx, _maxPerDay);
    }

    /**
     * @notice Get remaining daily allowance for an operator
     */
    function dailyRemaining(address operator) external view returns (uint256) {
        DailySpend storage ds = dailySpends[operator];
        uint256 today = block.timestamp / 1 days;
        if (ds.day != today) return maxPerDay;
        if (ds.amount >= maxPerDay) return 0;
        return maxPerDay - ds.amount;
    }

    function _trackDailySpend(address operator, uint256 amount) internal {
        DailySpend storage ds = dailySpends[operator];
        uint256 today = block.timestamp / 1 days;

        if (ds.day != today) {
            ds.day = today;
            ds.amount = 0;
        }

        if (ds.amount + amount > maxPerDay) {
            revert ExceedsDailyLimit(ds.amount, amount, maxPerDay);
        }

        ds.amount += amount;
    }
}
