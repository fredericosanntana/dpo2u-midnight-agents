// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AgentRegistry
 * @notice On-chain registry for DPO2U agents with permissions and heartbeat
 * @dev Agents are registered with wallets, permission bitfields, and metadata URIs
 */
contract AgentRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    // Permission bits
    uint256 public constant PERM_READ = 1;
    uint256 public constant PERM_WRITE = 2;
    uint256 public constant PERM_TREASURY = 4;
    uint256 public constant PERM_DEPLOY = 8;
    uint256 public constant PERM_GOVERNANCE = 16;

    enum AgentStatus { Inactive, Active, Suspended }

    struct Agent {
        string name;
        address wallet;
        AgentStatus status;
        uint256 permissions;
        string metadataURI;
        uint256 registeredAt;
        uint256 lastHeartbeat;
        uint256 erc8004Id; // ERC-8004 Identity Registry ID (0 = not bridged)
    }

    mapping(bytes32 => Agent) public agents;
    mapping(address => bytes32) public walletToAgent;
    bytes32[] public agentIds;

    event AgentRegistered(bytes32 indexed id, string name, address wallet, uint256 permissions);
    event AgentUpdated(bytes32 indexed id, uint256 permissions, string metadataURI);
    event AgentStatusChanged(bytes32 indexed id, AgentStatus status);
    event Heartbeat(bytes32 indexed id, address wallet, uint256 timestamp);
    event ERC8004IdSet(bytes32 indexed id, uint256 erc8004Id);

    error AgentAlreadyExists(bytes32 id);
    error AgentNotFound(bytes32 id);
    error WalletAlreadyRegistered(address wallet);
    error NotAgentWallet(address caller);
    error ZeroAddress();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    /**
     * @notice Register a new agent
     * @param name Agent name (used to derive ID)
     * @param wallet Agent's dedicated EOA wallet
     * @param permissions Bitfield of permissions
     * @param metadataURI URI pointing to agent's .md file or IPFS
     * @return id The keccak256 hash of the agent name
     */
    function registerAgent(
        string calldata name,
        address wallet,
        uint256 permissions,
        string calldata metadataURI
    ) external onlyRole(REGISTRAR_ROLE) returns (bytes32 id) {
        if (wallet == address(0)) revert ZeroAddress();

        id = keccak256(abi.encodePacked(name));
        if (agents[id].wallet != address(0)) revert AgentAlreadyExists(id);
        if (walletToAgent[wallet] != bytes32(0)) revert WalletAlreadyRegistered(wallet);

        agents[id] = Agent({
            name: name,
            wallet: wallet,
            status: AgentStatus.Active,
            permissions: permissions,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            erc8004Id: 0
        });

        walletToAgent[wallet] = id;
        agentIds.push(id);

        emit AgentRegistered(id, name, wallet, permissions);
    }

    /**
     * @notice Agent sends heartbeat as proof-of-life (must call from own wallet)
     */
    function heartbeat() external {
        bytes32 id = walletToAgent[msg.sender];
        if (id == bytes32(0)) revert NotAgentWallet(msg.sender);

        agents[id].lastHeartbeat = block.timestamp;
        emit Heartbeat(id, msg.sender, block.timestamp);
    }

    /**
     * @notice Check if a wallet has a specific permission
     * @param wallet Agent wallet address
     * @param perm Permission bit to check
     */
    function hasPermission(address wallet, uint256 perm) external view returns (bool) {
        bytes32 id = walletToAgent[wallet];
        if (id == bytes32(0)) return false;
        if (agents[id].status != AgentStatus.Active) return false;
        return (agents[id].permissions & perm) == perm;
    }

    /**
     * @notice Update agent permissions and metadata
     */
    function updateAgent(
        bytes32 id,
        uint256 permissions,
        string calldata metadataURI
    ) external onlyRole(REGISTRAR_ROLE) {
        if (agents[id].wallet == address(0)) revert AgentNotFound(id);
        agents[id].permissions = permissions;
        agents[id].metadataURI = metadataURI;
        emit AgentUpdated(id, permissions, metadataURI);
    }

    /**
     * @notice Change agent status (activate, suspend, deactivate)
     */
    function setAgentStatus(bytes32 id, AgentStatus status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (agents[id].wallet == address(0)) revert AgentNotFound(id);
        agents[id].status = status;
        emit AgentStatusChanged(id, status);
    }

    /**
     * @notice Link agent to ERC-8004 Identity Registry
     * @param id The agent's bytes32 ID
     * @param _erc8004Id The ERC-8004 agent ID (NFT tokenId)
     */
    function setERC8004Id(bytes32 id, uint256 _erc8004Id) external onlyRole(REGISTRAR_ROLE) {
        if (agents[id].wallet == address(0)) revert AgentNotFound(id);
        agents[id].erc8004Id = _erc8004Id;
        emit ERC8004IdSet(id, _erc8004Id);
    }

    /**
     * @notice Get total number of registered agents
     */
    function agentCount() external view returns (uint256) {
        return agentIds.length;
    }

    /**
     * @notice Get agent details by wallet address
     */
    function getAgentByWallet(address wallet) external view returns (Agent memory) {
        bytes32 id = walletToAgent[wallet];
        if (id == bytes32(0)) revert NotAgentWallet(wallet);
        return agents[id];
    }
}
