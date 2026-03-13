// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IERC8004Reputation.sol";

/**
 * @title ERC8004ReputationRegistryMock
 * @notice Mock implementation of ERC-8004 Reputation Registry for testing on Base Sepolia
 * @dev Implements IERC8004Reputation interface - on-chain feedback system for agents
 */
contract ERC8004ReputationRegistryMock is IERC8004Reputation {
    address public immutable identityRegistry;

    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        bool isRevoked;
    }

    // agentId => clientAddress => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private _feedbacks;

    // agentId => clientAddress => lastIndex
    mapping(uint256 => mapping(address => uint64)) private _lastIndex;

    // agentId => client addresses
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _isClient;

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    /**
     * @notice Submit feedback for an agent
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external override {
        // Increment feedback index for this client-agent pair
        uint64 feedbackIndex = ++_lastIndex[agentId][msg.sender];

        // Store feedback (direct storage write to avoid stack issues)
        Feedback storage fb = _feedbacks[agentId][msg.sender][feedbackIndex];
        fb.value = value;
        fb.valueDecimals = valueDecimals;
        fb.tag1 = tag1;
        fb.tag2 = tag2;
        fb.endpoint = endpoint;
        fb.feedbackURI = feedbackURI;
        fb.feedbackHash = feedbackHash;
        fb.isRevoked = false;

        // Track client if first feedback
        if (!_isClient[agentId][msg.sender]) {
            _clients[agentId].push(msg.sender);
            _isClient[agentId][msg.sender] = true;
        }

        emit NewFeedback(
            agentId,
            msg.sender,
            feedbackIndex,
            value,
            valueDecimals,
            tag1,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash
        );
    }

    /**
     * @notice Revoke previously given feedback
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external override {
        require(_feedbacks[agentId][msg.sender][feedbackIndex].value != 0 || feedbackIndex <= _lastIndex[agentId][msg.sender], "Feedback not found");
        require(!_feedbacks[agentId][msg.sender][feedbackIndex].isRevoked, "Already revoked");

        _feedbacks[agentId][msg.sender][feedbackIndex].isRevoked = true;

        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @notice Get aggregated feedback summary
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view override returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        summaryValueDecimals = 0;
        int256 totalValue = 0;

        // If no client addresses provided, use all clients
        address[] memory clients;
        if (clientAddresses.length > 0) {
            clients = clientAddresses;
        } else {
            clients = _clients[agentId];
        }

        for (uint256 i = 0; i < clients.length; i++) {
            address client = clients[i];
            uint64 lastIdx = _lastIndex[agentId][client];

            for (uint64 j = 1; j <= lastIdx; j++) {
                Feedback memory fb = _feedbacks[agentId][client][j];

                // Skip revoked feedback
                if (fb.isRevoked) continue;

                // Filter by tags (empty string matches all)
                bool tag1Match = bytes(tag1).length == 0 || keccak256(bytes(fb.tag1)) == keccak256(bytes(tag1));
                bool tag2Match = bytes(tag2).length == 0 || keccak256(bytes(fb.tag2)) == keccak256(bytes(tag2));

                if (tag1Match && tag2Match) {
                    totalValue += fb.value;
                    count++;
                }
            }
        }

        summaryValue = int128(totalValue);
    }

    /**
     * @notice Read a specific feedback entry
     */
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view override returns (
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        bool isRevoked
    ) {
        Feedback memory fb = _feedbacks[agentId][clientAddress][feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.isRevoked);
    }

    /**
     * @notice Get all clients who gave feedback to an agent
     */
    function getClients(uint256 agentId) external view override returns (address[] memory clientList) {
        return _clients[agentId];
    }

    /**
     * @notice Get last feedback index for a client-agent pair
     */
    function getLastIndex(uint256 agentId, address clientAddress) external view override returns (uint64 lastIndex) {
        return _lastIndex[agentId][clientAddress];
    }

    /**
     * @notice Get the identity registry address
     */
    function getIdentityRegistry() external view override returns (address registry) {
        return identityRegistry;
    }
}
