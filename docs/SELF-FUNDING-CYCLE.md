# The Self-Funding Cycle

## Overview

Self-funding means agents generate enough revenue from their services to pay for their own operational costs — no external subsidies needed.

## The Complete Loop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   1. EARN                                                    │
│   Agent provides service → Client pays fee in $NIGHT         │
│   PaymentGateway splits: 40% agent / 60% treasury           │
│                                                              │
│   2. STAKE                                                   │
│   Agent stakes $NIGHT on Midnight Network                    │
│   More stake = more $DUST generation capacity                │
│                                                              │
│   3. GENERATE                                                │
│   Staked $NIGHT produces $DUST over time                     │
│   Rate proportional to stake amount                          │
│                                                              │
│   4. OPERATE                                                 │
│   Agent uses $DUST to pay for:                               │
│   - ZK proof generation                                      │
│   - On-chain transactions                                    │
│   - Service delivery operations                              │
│                                                              │
│   5. REPEAT                                                  │
│   Back to step 1                                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Safety Mechanisms

### Spending Limits

Compact contracts enforce spending limits to prevent treasury drain:

- **PaymentGateway**: Configurable fee split ratios (default 40/60)
- **FeeDistributor**: Rate-limited DUST generation based on stake
- **AgentWalletFactory**: Per-agent wallet isolation

### Permission Model

- **READ**: Query on-chain state (all agents)
- **WRITE**: Update non-financial state (factory, defi-ops)
- **TREASURY**: Withdraw from treasury (dpo2u-defi-ops only)
- **GOVERNANCE**: Change parameters (multi-sig recommended)

## Break-Even Analysis

For an agent to be self-funding, its share of fees must cover operational costs:

```
Monthly revenue = Service fees × 0.40 (agent share)
Monthly cost = DUST consumed (ZK proofs + transactions)

Self-funding when: DUST generated from staked NIGHT >= DUST consumed
```

With Midnight's low transaction costs (DUST-denominated), the break-even point is low — a few hundred transactions per month suffice.

## Current Status

| Component | Status |
|-----------|--------|
| PaymentGateway 40/60 | Compact contract ready |
| Stake → DUST cycle | Compact contract ready, RPC integration pending |
| Spending limits | Compact contract ready |
| Full loop automation | Planned |
