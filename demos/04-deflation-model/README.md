# Demo 4: Deflation Model Simulation

Numerical simulation showing how autonomous agents create two-layer deflation:

- **Layer 1**: Transfer fee burns reduce circulating supply permanently
- **Layer 2**: Agent staking locks tokens, removing them from circulation

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
ts-node demos/04-deflation-model/run.ts
```

## Sample output

```
--- Scenario: Moderate ---
Agent growth: +5/month | Assessments: 20/agent/month
Fee/assessment: 100 DPO2U | Stake/agent: 10K NIGHT
Burn rate: 25% of transfer fees

┌───────┬────────┬──────────────┬──────────────┬───────────────┬──────────┐
│ Month │ Agents │ Total burned │ Total staked │ Circulating   │ % supply │
├───────┼────────┼──────────────┼──────────────┼───────────────┼──────────┤
│     1 │     11 │          550 │       110000 │        99.89M │   99.9%  │
│    12 │     66 │        21.6K │       660000 │        99.32M │   99.3%  │
│    24 │    126 │        83.2K │      1260000 │        98.66M │   98.7%  │
└───────┴────────┴──────────────┴──────────────┴───────────────┴──────────┘
```

## Key insight

Agent staking creates a **floor** of locked tokens that grows linearly with adoption. Unlike speculative holders, agents cannot unstake without losing operational capacity — their holding is **functional, not speculative**.
