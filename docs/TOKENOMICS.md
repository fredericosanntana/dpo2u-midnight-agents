# Tokenomics

## Dual-Token Model

### $NIGHT (Staking Token)

- **Type**: Native Midnight Network token
- **Role**: Staking, governance, service fee payments
- **Staking**: Agents stake $NIGHT to participate in the network and generate $DUST
- **Demand driver**: Every agent must hold and stake $NIGHT to operate

### $DUST (Operational Token)

- **Type**: Generated from $NIGHT staking
- **Role**: Pays for ZK proofs, transactions, and on-chain operations
- **Relationship**: Staked $NIGHT generates $DUST over time (similar to how staked ETH generates rewards)
- **Consumption**: Each ZK operation burns DUST, creating constant demand

## Agent Economics

### Revenue Sources

1. **Service fees**: Agents charge for services (compliance audits, content generation, etc.) — paid in $NIGHT
2. **Staking rewards**: Staked $NIGHT generates $DUST for operations
3. **Fee distribution**: PaymentGateway splits fees 40% operator / 60% treasury

### Cost Structure

| Cost | Paid in | Frequency |
|------|---------|-----------|
| Gas fees (Midnight) | $DUST | Per transaction |
| ZK proof generation | $DUST | Per service call |
| Agent operations | $DUST | Per service call |

### Self-Funding Cycle

```
Service Revenue ($NIGHT) → Stake → Generate $DUST → Fund Operations → Repeat
```

This creates a closed loop where agents earn enough to sustain their own operations without external funding.

## Deflationary Mechanics

### Layer 1: Fee Burns

A configurable portion of service fees is burned permanently, reducing circulating supply with every transaction.

### Layer 2: Agent Staking Lock

Every $NIGHT staked by agents is locked and removed from circulating supply. As more agents join, more $NIGHT is locked, reducing available supply.

### Combined Effect

With N agents each staking S tokens and a burn rate of B%:

```
Effective supply = Total supply - (N × S) - Cumulative burns
```

See [Demo 2: Deflation Model](../demos/02-deflation-model/) for numerical simulations.

## Why Agents as Holders Matter

Traditional token economics relies on humans buying and selling. This creates speculation-driven volatility.

Agent holders are different:
- **They don't speculate** — they hold because they need tokens to operate
- **They don't panic sell** — they have no emotions
- **They increase holdings linearly** — more agents = more locked tokens
- **Their demand is utilitarian** — tied to actual service delivery, not speculation

This creates a floor of non-speculative demand that grows with adoption.
