# Demo 2: Deflation Model Simulation

Numerical simulation showing how autonomous agents create deflation on Midnight Network:

- **Staking lock**: Agent staking locks $NIGHT, removing them from circulation
- **Fee burns**: A portion of service fees is burned permanently

## What it demonstrates

3 scenarios (Conservative, Moderate, Aggressive) modeling 24 months of:
- Agent growth (2-10 new agents per month)
- Transaction volume from compliance assessments
- Fee collection and partial burn
- Staking lock-up growing with agent count

## Run

```bash
npm run demo:deflation
# or
ts-node demos/02-deflation-model/run.ts
```

## Key insight

Agent staking creates a **floor** of locked $NIGHT that grows linearly with adoption. Unlike speculative holders, agents cannot unstake without losing operational capacity — their holding is **functional, not speculative**.
