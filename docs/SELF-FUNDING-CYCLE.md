# The Self-Funding Cycle

## Overview

Self-funding means agents generate enough revenue from their services to pay for their own operational costs — no external subsidies needed.

## The Complete Loop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   1. EARN                                                    │
│   Agent provides service → Client pays fee                   │
│   PaymentGateway splits: 40% agent / 60% treasury           │
│                                                              │
│   2. ACCUMULATE                                              │
│   Treasury collects fees from all agents                     │
│   DPO2UToken 1% transfer fee also flows to treasury         │
│                                                              │
│   3. CLAIM                                                   │
│   Operator (dpo2u-defi-ops) claims from treasury             │
│   Subject to: maxPerTx (500 USDC), maxPerDay (2000 USDC)    │
│                                                              │
│   4. SWAP                                                    │
│   SwapExecutor converts tokens via Uniswap V3               │
│   e.g., WETH → USDC for stable operations                   │
│   e.g., USDC → $NIGHT for staking                           │
│                                                              │
│   5. STAKE                                                   │
│   Agent stakes $NIGHT on Midnight Network                    │
│   Generates $DUST proportional to stake                      │
│                                                              │
│   6. OPERATE                                                 │
│   Agent uses $DUST to pay for:                               │
│   - ZK proof generation                                      │
│   - On-chain transactions                                    │
│   - Cross-chain bridge operations                            │
│                                                              │
│   7. REPEAT                                                  │
│   Back to step 1                                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Safety Mechanisms

### Spending Limits

The Treasury enforces two limits to prevent drain:

- **Per-transaction**: Max 500 USDC equivalent per withdrawal
- **Per-day**: Max 2000 USDC equivalent per operator per day

These are configurable by GOVERNOR_ROLE but provide default protection.

### Role Separation

- **DEPLOYER**: Initial setup only, can be renounced after deployment
- **OPERATOR**: Can withdraw within limits (assigned to dpo2u-defi-ops)
- **GOVERNOR**: Can change parameters (multi-sig recommended for mainnet)

### Fee Exemptions

Certain addresses are fee-exempt to prevent cascading fees:
- Treasury itself (receiving fees shouldn't generate more fees)
- Deployer (initial token distribution)
- LP pools (prevents impermanent loss amplification)
- Staking contracts

## Break-Even Analysis

For an agent to be self-funding, its share of fees must cover operational costs:

```
Monthly revenue = (Service fees × 0.40) + (Transfer fee share)
Monthly cost = Gas (Base) + Gas (Midnight) + Infrastructure

Self-funding when: Monthly revenue >= Monthly cost
```

With current gas costs on Base (~$0.001/tx) and Midnight (DUST-denominated), the break-even point is low — a few hundred transactions per month suffice.

## Current Status

| Component | Status |
|-----------|--------|
| Treasury with limits | Deployed (Base Sepolia) |
| Transfer fee (1%) | Active |
| SwapExecutor | Deployed, operational |
| PaymentGateway 40/60 | Compact contract ready |
| Stake → DUST cycle | Compact contract ready, RPC integration pending |
| Full loop automation | Cron job active (every 6h) |
