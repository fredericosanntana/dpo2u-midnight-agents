# DPO2U Midnight Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Midnight Ecosystem](https://img.shields.io/badge/Midnight-Ecosystem-purple)](https://midnight.network)

**Self-funding autonomous agents on Midnight Network using the $NIGHT/$DUST dual-token model.**

This is the first implementation of the **agents-as-permanent-holders** thesis: AI agents that earn, hold, and spend tokens autonomously — creating permanent demand pressure and deflationary dynamics through protocol participation.

## Why This Matters

Out of 60+ projects listed on [midnight-awesome-dapps](https://github.com/nickkatsios/midnight-awesome-dapps), **zero** implement autonomous agents as token holders with self-funding capabilities. This repo bridges that gap with working code, not just theory.

Key insight: When agents become permanent holders that stake $NIGHT to generate $DUST for operations, they create **non-speculative, utilitarian demand** that grows linearly with agent adoption.

## Architecture

```
                         MIDNIGHT NETWORK (ZK)
              ┌──────────────────────────────────────┐
              │  AgentRegistry.compact                │
              │  - ZK agent identities                │
              │                                       │
              │  PaymentGateway.compact                │
              │  - Service fee collection              │
              │  - 40/60 split (operator/treasury)     │
              │                                       │
              │  FeeDistributor.compact                │
              │  - Stake $NIGHT → Generate $DUST       │
              │  - Fee burns for deflation             │
              │                                       │
              │  ComplianceRegistry.compact             │
              │  - ZK compliance proofs (LGPD/GDPR)    │
              │                                       │
              │  AgentWalletFactory.compact             │
              │  - HD wallet derivation for agents     │
              └──────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────────────┐
              │  AGENT SELF-FUNDING LOOP              │
              │                                       │
              │  1. Earn $NIGHT (service fees)         │
              │  2. Stake $NIGHT                       │
              │  3. Generate $DUST                     │
              │  4. Operate (ZK proofs, transactions)  │
              │  5. Repeat                             │
              └──────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Run demos
npm run demo:dust            # Stake → DUST generation cycle
npm run demo:deflation       # Deflationary model simulation
```

## Contracts (Compact — Midnight Network)

| Contract | Description |
|----------|-------------|
| `AgentRegistry` | ZK-private agent identity registry |
| `PaymentGateway` | Fee collection with 40/60 split (operator/treasury) |
| `FeeDistributor` | Distributes fees and manages stake rewards |
| `ComplianceRegistry` | Privacy-preserving compliance attestations |
| `AgentWalletFactory` | Deterministic HD wallet derivation for agents |

## Demos

| # | Demo | What it shows | Command |
|---|------|---------------|---------|
| 1 | [DUST Generation](demos/01-dust-generation/) | Simulate the stake → DUST reward cycle | `npm run demo:dust` |
| 2 | [Deflation Model](demos/02-deflation-model/) | Numerical simulation: N agents x M assessments → supply impact | `npm run demo:deflation` |

## Agents

6 autonomous agents operating on Midnight Network:

| Agent | Role | Permissions |
|-------|------|-------------|
| `dpo2u-compliance-expert` | LGPD/GDPR compliance | READ |
| `dpo2u-defi-ops` | Treasury operations | READ+WRITE+TREASURY |
| `agent-factory` | Creates new agents | READ+WRITE |
| `knowledge-manager` | Knowledge base | READ |
| `content-creator` | Content generation | READ |
| `docker-vps-operator` | Infrastructure | READ |

## Learning Log

Daily check-ins documenting what was built, learned, and planned: [Issues with `learning-log` label](https://github.com/fredericosanntana/dpo2u-midnight-agents/labels/learning-log)

Also archived in [`docs/learning-log/`](docs/learning-log/).

## Docs

- [Architecture](docs/ARCHITECTURE.md) — System design and component interactions
- [Tokenomics](docs/TOKENOMICS.md) — Dual-token model and agent economics
- [Self-Funding Cycle](docs/SELF-FUNDING-CYCLE.md) — The complete self-funding loop

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Submit a PR with a clear description

## Related

- [Agents as Permanent Holders](https://dpo2u.com/blog/agents-permanent-holders) — The thesis behind this implementation
- [midnight-awesome-dapps](https://github.com/nickkatsios/midnight-awesome-dapps) — Midnight ecosystem projects
- [Midnight Network](https://midnight.network) — Privacy-preserving blockchain

## License

MIT
