// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IERC8004Identity.sol";
import "./interfaces/IERC8004Reputation.sol";

/**
 * @title DPO2UAgentBridge
 * @notice Bridge between DPO2U AgentRegistry and ERC-8004 Identity/Reputation registries
 * @dev Registers DPO2U agents on the global ERC-8004 ecosystem, syncs heartbeat/permissions
 *      as metadata, and posts execution feedback to the Reputation Registry.
 */
contract DPO2UAgentBridge is AccessControl {
    bytes32 public constant BRIDGE_OPERATOR_ROLE = keccak256("BRIDGE_OPERATOR_ROLE");

    IERC8004Identity public immutable identityRegistry;
    IERC8004Reputation public immutable reputationRegistry;

    // Bidirectional mappings: DPO2U agentId <-> ERC-8004 agentId
    mapping(bytes32 => uint256) public dpo2uToErc8004;
    mapping(uint256 => bytes32) public erc8004ToDpo2u;

    // Track all bridged agents
    bytes32[] public bridgedAgents;

    event AgentBridged(bytes32 indexed dpo2uAgentId, uint256 indexed erc8004Id, string agentURI);
    event HeartbeatSynced(bytes32 indexed dpo2uAgentId, uint256 indexed erc8004Id, uint256 timestamp);
    event PermissionsSynced(bytes32 indexed dpo2uAgentId, uint256 indexed erc8004Id, uint256 permissions);
    event FeedbackSubmitted(uint256 indexed erc8004Id, int128 value, string tag1);

    error AlreadyBridged(bytes32 dpo2uAgentId);
    error NotBridged(bytes32 dpo2uAgentId);
    error ERC8004IdNotMapped(uint256 erc8004Id);

    constructor(
        address admin,
        address _identityRegistry,
        address _reputationRegistry
    ) {
        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BRIDGE_OPERATOR_ROLE, admin);
    }

    /**
     * @notice Register a DPO2U agent on the ERC-8004 Identity Registry
     * @param dpo2uAgentId The bytes32 agent ID from DPO2U AgentRegistry
     * @param agentURI URI pointing to agent's JSON registration file (IPFS or HTTP)
     * @param metadata Initial metadata entries (permissions, heartbeat, etc.)
     * @return erc8004Id The newly assigned ERC-8004 agent ID (NFT tokenId)
     */
    function registerOnERC8004(
        bytes32 dpo2uAgentId,
        string calldata agentURI,
        IERC8004Identity.MetadataEntry[] calldata metadata
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) returns (uint256 erc8004Id) {
        if (dpo2uToErc8004[dpo2uAgentId] != 0) revert AlreadyBridged(dpo2uAgentId);

        // Register on ERC-8004 Identity Registry (mints NFT to this contract)
        erc8004Id = identityRegistry.register(agentURI, metadata);

        // Store bidirectional mapping
        dpo2uToErc8004[dpo2uAgentId] = erc8004Id;
        erc8004ToDpo2u[erc8004Id] = dpo2uAgentId;
        bridgedAgents.push(dpo2uAgentId);

        emit AgentBridged(dpo2uAgentId, erc8004Id, agentURI);
    }

    /**
     * @notice Sync heartbeat timestamp from DPO2U to ERC-8004 metadata
     * @param dpo2uAgentId The DPO2U agent ID
     * @param lastHeartbeat The timestamp from AgentRegistry.lastHeartbeat
     */
    function syncHeartbeat(
        bytes32 dpo2uAgentId,
        uint256 lastHeartbeat
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) {
        uint256 erc8004Id = dpo2uToErc8004[dpo2uAgentId];
        if (erc8004Id == 0) revert NotBridged(dpo2uAgentId);

        identityRegistry.setMetadata(
            erc8004Id,
            "dpo2u:lastHeartbeat",
            abi.encodePacked(lastHeartbeat)
        );

        emit HeartbeatSynced(dpo2uAgentId, erc8004Id, lastHeartbeat);
    }

    /**
     * @notice Sync permissions bitfield from DPO2U to ERC-8004 metadata
     * @param dpo2uAgentId The DPO2U agent ID
     * @param permissions The permissions bitfield from AgentRegistry
     */
    function syncPermissions(
        bytes32 dpo2uAgentId,
        uint256 permissions
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) {
        uint256 erc8004Id = dpo2uToErc8004[dpo2uAgentId];
        if (erc8004Id == 0) revert NotBridged(dpo2uAgentId);

        identityRegistry.setMetadata(
            erc8004Id,
            "dpo2u:permissions",
            abi.encodePacked(permissions)
        );

        emit PermissionsSynced(dpo2uAgentId, erc8004Id, permissions);
    }

    /**
     * @notice Submit positive/negative feedback to the Reputation Registry
     * @param erc8004Id The ERC-8004 agent ID
     * @param value Feedback value (e.g., 100 for success, -100 for failure)
     * @param valueDecimals Decimal places for value interpretation
     * @param tag1 Category tag (e.g., "claim-swap", "heartbeat")
     * @param tag2 Sub-category tag (e.g., "success", "failure")
     */
    function submitFeedback(
        uint256 erc8004Id,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) {
        reputationRegistry.giveFeedback(
            erc8004Id,
            value,
            valueDecimals,
            tag1,
            tag2,
            "", // endpoint (optional)
            "", // feedbackURI (optional)
            bytes32(0) // feedbackHash (optional)
        );

        emit FeedbackSubmitted(erc8004Id, value, tag1);
    }

    /**
     * @notice Update the agentURI for a bridged agent
     * @param dpo2uAgentId The DPO2U agent ID
     * @param newURI The new agent URI
     */
    function updateAgentURI(
        bytes32 dpo2uAgentId,
        string calldata newURI
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) {
        uint256 erc8004Id = dpo2uToErc8004[dpo2uAgentId];
        if (erc8004Id == 0) revert NotBridged(dpo2uAgentId);

        identityRegistry.setAgentURI(erc8004Id, newURI);
    }

    /**
     * @notice Set arbitrary metadata on a bridged agent's ERC-8004 identity
     * @param dpo2uAgentId The DPO2U agent ID
     * @param metadataKey The metadata key
     * @param metadataValue The metadata value
     */
    function setMetadata(
        bytes32 dpo2uAgentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) {
        uint256 erc8004Id = dpo2uToErc8004[dpo2uAgentId];
        if (erc8004Id == 0) revert NotBridged(dpo2uAgentId);

        identityRegistry.setMetadata(erc8004Id, metadataKey, metadataValue);
    }

    // ============ View Functions ============

    /// @notice Get ERC-8004 ID for a DPO2U agent (0 = not bridged)
    function getERC8004Id(bytes32 dpo2uAgentId) external view returns (uint256) {
        return dpo2uToErc8004[dpo2uAgentId];
    }

    /// @notice Get DPO2U agent ID for an ERC-8004 ID
    function getDPO2UId(uint256 erc8004Id) external view returns (bytes32) {
        return erc8004ToDpo2u[erc8004Id];
    }

    /// @notice Total number of bridged agents
    function bridgedAgentCount() external view returns (uint256) {
        return bridgedAgents.length;
    }

    /// @notice Get reputation summary for a bridged agent
    function getAgentReputation(
        uint256 erc8004Id,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        address[] memory empty = new address[](0);
        return reputationRegistry.getSummary(erc8004Id, empty, tag1, tag2);
    }
}
