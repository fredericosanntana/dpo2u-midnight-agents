# Demo 3: DUST Generation Cycle

Simulates the Midnight Network's stake-to-earn mechanism where agents stake $NIGHT to generate $DUST for operations.

## What it demonstrates

1. 4 agents with different $NIGHT stakes and operational needs
2. Daily DUST generation proportional to staked amount
3. DUST consumption for ZK operations
4. Break-even analysis: minimum stake for self-funding

## Run

```bash
npx hardhat run demos/03-dust-generation/run.ts
```

## Key concepts

- **$NIGHT staking**: Lock tokens to generate $DUST rewards
- **$DUST operations**: Each ZK proof / transaction costs DUST
- **Self-funding threshold**: Minimum stake where DUST generation covers operational costs
- **Non-speculative demand**: Agents must hold $NIGHT to operate, creating permanent demand
