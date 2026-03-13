// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapExecutor
 * @notice Executes swaps via Uniswap V3 on Base Chain, sending USDC to Treasury
 * @dev Used by the self-funding cycle: DPO2U fees → USDC → Treasury
 */

/// @notice Minimal Uniswap V3 SwapRouter interface
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Minimal WETH interface
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract SwapExecutor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Base Chain addresses
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    ISwapRouter public constant SWAP_ROUTER = ISwapRouter(0x2626664c2603336E57B271c5C0b26F421741e481);

    address public treasury;
    uint256 public constant MAX_SLIPPAGE_BPS = 300; // 3% max slippage

    event SwapExecuted(
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    error ZeroAddress();
    error ZeroAmount();
    error SlippageTooHigh();
    error SwapFailed();

    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    /**
     * @notice Swap ETH to USDC and send to Treasury
     * @param minAmountOut Minimum USDC to receive (slippage protection)
     */
    function swapETHtoUSDC(uint256 minAmountOut) external payable onlyOwner nonReentrant {
        if (msg.value == 0) revert ZeroAmount();

        // Wrap ETH
        IWETH(WETH).deposit{value: msg.value}();
        IWETH(WETH).approve(address(SWAP_ROUTER), msg.value);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 500, // 0.05% pool (most liquid on Base)
            recipient: treasury,
            amountIn: msg.value,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = SWAP_ROUTER.exactInputSingle(params);
        emit SwapExecuted(WETH, msg.value, amountOut, treasury);
    }

    /**
     * @notice Swap any ERC-20 token to USDC and send to Treasury
     * @param tokenIn Token to swap from
     * @param amountIn Amount of tokenIn to swap
     * @param minAmountOut Minimum USDC to receive
     * @param poolFee Uniswap V3 pool fee tier (500, 3000, 10000)
     */
    function swapTokenToUSDC(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 poolFee
    ) external onlyOwner nonReentrant {
        if (amountIn == 0) revert ZeroAmount();
        if (tokenIn == address(0)) revert ZeroAddress();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(SWAP_ROUTER), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: USDC,
            fee: poolFee,
            recipient: treasury,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = SWAP_ROUTER.exactInputSingle(params);
        emit SwapExecuted(tokenIn, amountIn, amountOut, treasury);
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    /**
     * @notice Rescue stuck tokens (emergency)
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
