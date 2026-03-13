// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../interfaces/IERC8004Identity.sol";

/**
 * @title ERC8004IdentityRegistryMock
 * @notice Mock implementation of ERC-8004 Identity Registry for testing on Base Sepolia
 * @dev Implements IERC8004Identity interface - agents are registered as ERC-721 NFTs
 *      Note: ownerOf is inherited from ERC721 (public view) which satisfies IERC8004Identity (external view)
 */
contract ERC8004IdentityRegistryMock is ERC721 {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    uint256 private _nextAgentId = 1;

    // agentId => agentURI
    mapping(uint256 => string) private _agentURIs;

    // agentId => metadataKey => metadataValue
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    constructor() ERC721("ERC8004 Agent Identity", "AGENT") {}

    /**
     * @notice Register agent with URI and metadata
     */
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _mint(msg.sender, agentId);
        _agentURIs[agentId] = agentURI;

        // Store metadata entries
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Register agent with URI only
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _mint(msg.sender, agentId);
        _agentURIs[agentId] = agentURI;

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Register agent without URI
     */
    function register() external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _mint(msg.sender, agentId);

        emit Registered(agentId, "", msg.sender);
    }

    /**
     * @notice Set a single metadata key-value pair
     */
    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    ) external {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        require(ownerOf(agentId) == msg.sender, "Not agent owner");

        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    /**
     * @notice Read metadata value for a key
     */
    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    ) external view returns (bytes memory metadataValue) {
        return _metadata[agentId][metadataKey];
    }

    /**
     * @notice Update agentURI
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        require(ownerOf(agentId) == msg.sender, "Not agent owner");

        _agentURIs[agentId] = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice Total registered agents
     */
    function totalAgents() external view returns (uint256 count) {
        return _nextAgentId - 1;
    }

    /**
     * @notice Check if agent exists
     */
    function agentExists(uint256 agentId) external view returns (bool exists) {
        return _ownerOf(agentId) != address(0);
    }

    /**
     * @notice Get agent URI (ERC-721 tokenURI)
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Agent does not exist");
        return _agentURIs[tokenId];
    }
}
