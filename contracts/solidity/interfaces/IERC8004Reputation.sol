// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/**
 * @title IERC8004Reputation
 * @notice Interface for ERC-8004 Reputation Registry — on-chain feedback for agents
 * @dev Deployed at 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 (mainnet)
 *      and 0x8004B663056A597Dffe9eCcC1965A193B7388713 (Base Sepolia)
 */
interface IERC8004Reputation {
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex
    );

    /// @notice Submit feedback for an agent (no pre-auth required since Jan 2026)
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /// @notice Revoke previously given feedback
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    /// @notice Get aggregated feedback summary
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);

    /// @notice Read a specific feedback entry
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view returns (
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        bool isRevoked
    );

    /// @notice Get all clients who gave feedback to an agent
    function getClients(uint256 agentId) external view returns (address[] memory clientList);

    /// @notice Get last feedback index for a client-agent pair
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64 lastIndex);

    /// @notice Get the identity registry address
    function getIdentityRegistry() external view returns (address registry);
}
