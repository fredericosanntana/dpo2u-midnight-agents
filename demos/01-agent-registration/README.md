# Demo 1: Agent Registration

Registers an autonomous agent on-chain with identity, wallet, permissions, and metadata.

## What it demonstrates

1. Deploy an `AgentRegistry` contract
2. Register an agent with a dedicated wallet and permissions (READ + WRITE + TREASURY)
3. Read agent data back from the registry
4. Verify permission checks work correctly
5. Send a heartbeat (proof-of-life) from the agent's wallet

## Run

```bash
npx hardhat run demos/01-agent-registration/run.ts
```

## Key concepts

- **Agent ID**: `keccak256(name)` — deterministic, unique per agent name
- **Permission bitfield**: Composable permissions (1=READ, 2=WRITE, 4=TREASURY, 8=DEPLOY, 16=GOVERNANCE)
- **Heartbeat**: Agents call `heartbeat()` from their own wallet as proof-of-life
- **Metadata URI**: Points to a JSON file (local or IPFS) describing the agent's capabilities
