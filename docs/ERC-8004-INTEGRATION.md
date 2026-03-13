# ERC-8004 Integration

## What is ERC-8004?

ERC-8004 (Trustless Agents) is a proposed standard for on-chain agent identity and reputation. It provides:

1. **Identity**: Each agent gets an ERC-721 NFT representing its on-chain identity
2. **Reputation**: A feedback system where anyone can rate agent performance
3. **Discovery**: Agents can be found by querying the identity registry
4. **Metadata**: Rich metadata (capabilities, protocols supported, region, etc.)

## How DPO2U Agents Use ERC-8004

### Registration Flow

```
1. Agent is registered in DPO2U AgentRegistry (internal ID)
2. DPO2UAgentBridge mints an ERC-8004 identity NFT
3. Bridge maps: DPO2U Agent ID <-> ERC-8004 NFT ID
4. Metadata is set on the identity registry
5. Agent can now be discovered by external systems
```

### Metadata Schema

Each DPO2U agent exposes:

| Key | Description | Example |
|-----|-------------|---------|
| `dpo2u:permissions` | Permission bitfield | `0x0000...0007` |
| `dpo2u:agentId` | Internal DPO2U ID | `0x96e9e856...` |
| `dpo2u:lastHeartbeat` | Last activity timestamp | `1739265420` |
| `platform:dpo2u` | Platform identifier | `compliance-as-a-service` |
| `protocol:a2a` | Agent-to-Agent support | `true` |
| `protocol:mcp` | Model Context Protocol | `true` |
| `region:latam` | Operating region | `brazil-primary` |

### Reputation System

After each operation, the system submits feedback:

```typescript
reputationRegistry.giveFeedback(
  erc8004Id,   // Agent's NFT ID
  100,         // Score: +100 (success) or -100 (failure)
  0,           // Decimals
  "defi-ops",  // Category tag
  "success",   // Result tag
  "",          // Endpoint
  "",          // Feedback URI
  ethers.ZeroHash
);
```

Reputation is queryable by anyone — external agents can check a DPO2U agent's track record before interacting.

### Heartbeat Sync

A daily cron job syncs agent activity from DPO2U to ERC-8004:

1. Read last heartbeat from DPO2U AgentRegistry
2. Update `dpo2u:lastHeartbeat` metadata on ERC-8004 Identity Registry
3. This proves the agent is still active and operational

## Contracts

| Contract | Address (Base Sepolia) | Role |
|----------|----------------------|------|
| `ERC8004IdentityRegistryMock` | `0x86c5...3433` | Identity NFTs |
| `ERC8004ReputationRegistryMock` | `0x0c22...7EA` | Feedback system |
| `DPO2UAgentBridge` | `0x6175...9e28` | ID mapping + sync |

## Registered Agents

| Agent | ERC-8004 NFT ID | Permissions |
|-------|-----------------|-------------|
| dpo2u-compliance-expert | 3 | READ (1) |
| dpo2u-defi-ops | 4 | READ+WRITE+TREASURY (7) |
| agent-factory | 5 | READ+WRITE (3) |
| knowledge-manager | 6 | READ (1) |
| content-creator | 7 | READ (1) |
| docker-vps-operator | 8 | READ (1) |

## Next Steps

- Upload agent URI JSONs to IPFS (currently local placeholders)
- Deploy real ERC-8004 registries (currently using mocks)
- Integrate with x402 payment protocol for agent-to-agent payments
