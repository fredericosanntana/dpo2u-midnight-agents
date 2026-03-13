// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IERC8004Identity.sol";
import "../interfaces/IERC8004Reputation.sol";

/**
 * @title MockIdentityRegistry
 * @notice Minimal mock of ERC-8004 Identity Registry for unit testing
 */
contract MockIdentityRegistry is IERC8004Identity {
    uint256 private _nextId = 1;
    mapping(uint256 => string) private _agentURIs;
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external override returns (uint256 agentId) {
        agentId = _nextId++;
        _agentURIs[agentId] = agentURI;
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
        }
        emit Registered(agentId, agentURI, msg.sender);
    }

    function register(string calldata agentURI) external override returns (uint256 agentId) {
        agentId = _nextId++;
        _agentURIs[agentId] = agentURI;
        emit Registered(agentId, agentURI, msg.sender);
    }

    function register() external override returns (uint256 agentId) {
        agentId = _nextId++;
        emit Registered(agentId, "", msg.sender);
    }

    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    ) external override {
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    ) external view override returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external override {
        _agentURIs[agentId] = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function totalAgents() external view override returns (uint256) {
        return _nextId - 1;
    }

    function agentExists(uint256 agentId) external view override returns (bool) {
        return agentId > 0 && agentId < _nextId;
    }

    function ownerOf(uint256) external view override returns (address) {
        return msg.sender;
    }
}

/**
 * @title MockReputationRegistry
 * @notice Simplified mock of ERC-8004 Reputation Registry for unit testing
 */
contract MockReputationRegistry is IERC8004Reputation {
    struct FeedbackEntry {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    mapping(uint256 => mapping(address => FeedbackEntry[])) private _feedbacks;
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _isClient;

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata,
        string calldata,
        bytes32
    ) external override {
        address client = msg.sender;
        _feedbacks[agentId][client].push(FeedbackEntry(value, valueDecimals, tag1, tag2, false));

        if (!_isClient[agentId][client]) {
            _clients[agentId].push(client);
            _isClient[agentId][client] = true;
        }

        // Note: Event emission omitted in mock to avoid stack too deep
        // Tests don't rely on this event
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external override {
        if (feedbackIndex > 0 && feedbackIndex <= _feedbacks[agentId][msg.sender].length) {
            _feedbacks[agentId][msg.sender][feedbackIndex - 1].isRevoked = true;
            emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
        }
    }

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata,
        string calldata
    ) external view override returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        address[] memory targets;

        if (clientAddresses.length > 0) {
            targets = clientAddresses;
        } else {
            targets = _clients[agentId];
        }

        for (uint256 i = 0; i < targets.length; i++) {
            FeedbackEntry[] storage entries = _feedbacks[agentId][targets[i]];
            for (uint256 j = 0; j < entries.length; j++) {
                if (!entries[j].isRevoked) {
                    count++;
                    summaryValue += entries[j].value;
                    if (count == 1) {
                        summaryValueDecimals = entries[j].valueDecimals;
                    }
                }
            }
        }
    }

    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view override returns (int128, uint8, string memory, string memory, bool) {
        if (feedbackIndex == 0 || feedbackIndex > _feedbacks[agentId][clientAddress].length) {
            return (0, 0, "", "", false);
        }
        FeedbackEntry storage e = _feedbacks[agentId][clientAddress][feedbackIndex - 1];
        return (e.value, e.valueDecimals, e.tag1, e.tag2, e.isRevoked);
    }

    function getClients(uint256 agentId) external view override returns (address[] memory) {
        return _clients[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view override returns (uint64) {
        return uint64(_feedbacks[agentId][clientAddress].length);
    }

    function getIdentityRegistry() external pure override returns (address) {
        return address(0);
    }
}
