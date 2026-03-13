// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/**
 * @title IERC8004Identity
 * @notice Interface for ERC-8004 Identity Registry — agent registration as ERC-721 NFTs
 * @dev Deployed at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (mainnet)
 *      and 0x8004A818BFB912233c491871b3d84c89A494BD9e (Base Sepolia)
 */
interface IERC8004Identity {
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

    /// @notice Register agent with URI and metadata, returns NFT tokenId
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId);

    /// @notice Register agent with URI only
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Register agent without URI
    function register() external returns (uint256 agentId);

    /// @notice Set a single metadata key-value pair
    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    ) external;

    /// @notice Read metadata value for a key
    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    ) external view returns (bytes memory metadataValue);

    /// @notice Update agentURI
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /// @notice Total registered agents
    function totalAgents() external view returns (uint256 count);

    /// @notice Check if agent exists
    function agentExists(uint256 agentId) external view returns (bool exists);

    /// @notice ERC-721 ownerOf
    function ownerOf(uint256 tokenId) external view returns (address owner);
}
