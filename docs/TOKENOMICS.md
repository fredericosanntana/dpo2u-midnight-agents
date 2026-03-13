# Tokenomics

## Dual-Token Model

### $DPO2U Token (Base Chain)

- **Type**: ERC-20 with transfer fee
- **Supply**: 100,000,000 (fixed, no mint function)
- **Transfer fee**: 1% (configurable, max 5%)
- **Fee destination**: Treasury contract
- **Burn**: ERC20Burnable — anyone can burn their tokens
- **Permit**: ERC20Permit — gasless approvals via signatures

### $NIGHT / $DUST (Midnight Network)

- **$NIGHT**: Native staking token. Agents stake $NIGHT to participate in the network
- **$DUST**: Operational token generated from $NIGHT staking. Used to pay for transactions and services
- **Relationship**: Staked $NIGHT generates $DUST over time (similar to how staked ETH generates rewards)

## Agent Economics

### Revenue Sources

1. **Transfer fees**: 1% of every $DPO2U transfer flows to Treasury
2. **Service fees**: Agents charge for services (compliance audits, content generation, etc.)
3. **Staking rewards**: Staked $NIGHT generates $DUST for operations

### Cost Structure

| Cost | Paid in | Frequency |
|------|---------|-----------|
| Gas fees (Base) | ETH | Per transaction |
| Gas fees (Midnight) | $DUST | Per transaction |
| Agent operations | $DUST | Per service call |
| Infrastructure | Fiat (via swap) | Monthly |

### Self-Funding Cycle

```
Service Revenue → Treasury → Swap to $NIGHT → Stake → Generate $DUST → Fund Operations → Repeat
```

This creates a closed loop where agents earn enough to sustain their own operations without external funding.

## Deflationary Mechanics

### Layer 1: Transfer Fee Burn

If governance decides to burn a portion of transfer fees (instead of sending 100% to treasury), circulating supply decreases with every transfer.

### Layer 2: Agent Staking Lock

Every $NIGHT staked by agents is locked and removed from circulating supply. As more agents join, more $NIGHT is locked, reducing available supply.

### Combined Effect

With N agents each staking S tokens and a burn rate of B%:

```
Effective supply = Total supply - (N × S) - Cumulative burns
```

See [Demo 4: Deflation Model](../demos/04-deflation-model/) for numerical simulations.

## Why Agents as Holders Matter

Traditional token economics relies on humans buying and selling. This creates speculation-driven volatility.

Agent holders are different:
- **They don't speculate** — they hold because they need tokens to operate
- **They don't panic sell** — they have no emotions
- **They increase holdings linearly** — more agents = more locked tokens
- **Their demand is utilitarian** — tied to actual service delivery, not speculation

This creates a floor of non-speculative demand that grows with adoption.
