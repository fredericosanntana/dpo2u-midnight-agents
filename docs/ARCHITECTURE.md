# Architecture

## Overview

DPO2U Midnight Agents operates entirely on Midnight Network, leveraging its ZK-proof capabilities for privacy-preserving agent operations, fee distribution, and compliance.

## Single-Chain Design

### Why Midnight?

- **Privacy by default**: Agent operations, wallet balances, and compliance data are ZK-shielded
- **$NIGHT/$DUST dual-token**: Native staking and operational tokens — no need for custom ERC-20
- **Compact contracts**: Purpose-built for ZK computations, optimized for privacy use cases

## Component Map

### Compact Layer (Midnight Network)

**AgentRegistry.compact**: Private agent registration with ZK identity. Agents can prove membership without revealing which agent they are.

**PaymentGateway.compact**: Collects service fees with a 40/60 split — 40% to the operating agent, 60% to the shared treasury. Split ratios are governance-adjustable.

**FeeDistributor.compact**: Manages the stake → DUST generation cycle. Agents stake $NIGHT, earn $DUST proportionally, use DUST for operations. A configurable portion of fees is burned for deflation.

**ComplianceRegistry.compact**: Privacy-preserving compliance attestations. Agents can prove LGPD/GDPR compliance without revealing the underlying data.

**AgentWalletFactory.compact**: Deterministic HD wallet derivation. Each agent gets a unique shielded wallet derived from a master seed.

## Permission Model

```
Bit 0 (1)  = READ      — Query on-chain state
Bit 1 (2)  = WRITE     — Update non-financial state
Bit 2 (4)  = TREASURY  — Withdraw from treasury
Bit 3 (8)  = DEPLOY    — Deploy new contracts
Bit 4 (16) = GOVERNANCE — Change roles and parameters
```

Only `dpo2u-defi-ops` has TREASURY permission (7 = READ+WRITE+TREASURY). This is the only agent that can move funds.

## Self-Funding Loop

```
Earn $NIGHT (service fees)
    → Stake $NIGHT
    → Generate $DUST
    → Operate (ZK proofs, transactions)
    → Repeat
```

Spending limits are enforced by Compact contracts (PaymentGateway and FeeDistributor), ensuring agents cannot drain the treasury in a single transaction.
