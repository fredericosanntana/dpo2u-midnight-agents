# DPO2U Midnight Agents

[![Solidity Tests](https://github.com/fredericosanntana/dpo2u-midnight-agents/actions/workflows/test-solidity.yml/badge.svg)](https://github.com/fredericosanntana/dpo2u-midnight-agents/actions/workflows/test-solidity.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Midnight Ecosystem](https://img.shields.io/badge/Midnight-Ecosystem-purple)](https://midnight.network)

**Self-funding autonomous agents on Midnight Network using the $NIGHT/$DUST dual-token model.**

This is the first implementation of the **agents-as-permanent-holders** thesis: AI agents that earn, hold, and spend tokens autonomously — creating permanent demand pressure and deflationary dynamics through protocol participation.

## Why This Matters

Out of 60+ projects listed on [midnight-awesome-dapps](https://github.com/nickkatsios/midnight-awesome-dapps), **zero** implement autonomous agents as token holders with self-funding capabilities. This repo bridges that gap with working code, not just theory.

Key insight: When agents become permanent holders that stake $NIGHT to generate $DUST for operations, they create **non-speculative, utilitarian demand** that grows linearly with agent adoption.

## Architecture

```
                    BASE CHAIN (EVM)                    MIDNIGHT NETWORK (ZK)
              ┌─────────────────────────┐         ┌──────────────────────────┐
              │  DPO2UToken (ERC-20)    │         │  AgentRegistry.compact   │
              │  - 1% transfer fee      │         │  - ZK agent identities   │
              │  - 100M supply          │         │                          │
              │                         │         │  PaymentGateway.compact  │
              │  Treasury               │◄───────►│  - 40/60 fee split       │
              │  - Role-based access    │  Bridge │                          │
              │  - Daily spending limits│         │  FeeDistributor.compact  │
              │                         │         │  - Stake → DUST cycle    │
              │  AgentRegistry          │         │                          │
              │  - 6 agents registered  │         │  ComplianceRegistry      │
              │  - ERC-8004 integration │         │  - ZK compliance proofs  │
              │                         │         │                          │
              │  SwapExecutor           │         │  AgentWalletFactory      │
              │  - Uniswap V3 swaps     │         │  - HD wallet derivation  │
              └─────────────────────────┘         └──────────────────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │  AGENT SELF-FUNDING     │
              │  LOOP                   │
              │                         │
              │  1. Collect fees (1%)   │
              │  2. Treasury accumulates│
              │  3. Operators claim     │
              │  4. Swap to stables     │
              │  5. Fund operations     │
              │  6. Repeat              │
              └─────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests (97 tests)
npx hardhat test

# Run a specific demo
npm run demo:registration    # Agent registration on-chain
npm run demo:fees            # PaymentGateway 40/60 split
npm run demo:dust            # Stake → DUST generation cycle
npm run demo:deflation       # Deflationary model simulation
```

## Contracts

### Solidity (Base Chain)

| Contract | Description | Deployed (Base Sepolia) |
|----------|-------------|------------------------|
| `DPO2UToken` | ERC-20 with 1% transfer fee | `0x84F3...afc8A` |
| `Treasury` | Multi-token treasury with daily limits | `0x188d...7E13` |
| `AgentRegistry` | On-chain agent registry with ERC-8004 | `0xAdce...6621` |
| `SwapExecutor` | Uniswap V3 swap automation | `0x793B...7E13` |
| `DPO2UAgentBridge` | DPO2U <> ERC-8004 bridge | `0x6175...9e28` |
| `ZKComplianceVerifier` | ZK proof verification for compliance | — |

### Compact (Midnight Network)

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
| 1 | [Agent Registration](demos/01-agent-registration/) | Register an agent on-chain with DID + wallet | `npm run demo:registration` |
| 2 | [Fee Distribution](demos/02-fee-distribution/) | PaymentGateway distributes fees 40/60 | `npm run demo:fees` |
| 3 | [DUST Generation](demos/03-dust-generation/) | Simulate the stake → DUST reward cycle | `npm run demo:dust` |
| 4 | [Deflation Model](demos/04-deflation-model/) | Numerical simulation: N agents x M assessments → supply impact | `npm run demo:deflation` |

## Agents

6 autonomous agents registered on-chain with ERC-8004 identity NFTs:

| Agent | Role | ERC-8004 ID | Permissions |
|-------|------|-------------|-------------|
| `dpo2u-compliance-expert` | LGPD/GDPR compliance | 3 | READ |
| `dpo2u-defi-ops` | Treasury operations | 4 | READ+WRITE+TREASURY |
| `agent-factory` | Creates new agents | 5 | READ+WRITE |
| `knowledge-manager` | Knowledge base | 6 | READ |
| `content-creator` | Content generation | 7 | READ |
| `docker-vps-operator` | Infrastructure | 8 | READ |

## Learning Log

Daily check-ins documenting what was built, learned, and planned: [Issues with `learning-log` label](https://github.com/fredericosanntana/dpo2u-midnight-agents/labels/learning-log)

Also archived in [`docs/learning-log/`](docs/learning-log/).

## Docs

- [Architecture](docs/ARCHITECTURE.md) — System design and component interactions
- [Tokenomics](docs/TOKENOMICS.md) — Dual-token model and agent economics
- [Self-Funding Cycle](docs/SELF-FUNDING-CYCLE.md) — The complete self-funding loop
- [ERC-8004 Integration](docs/ERC-8004-INTEGRATION.md) — How agents register and interact

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Ensure tests pass (`npx hardhat test`)
4. Submit a PR with a clear description

## Related

- [Agents as Permanent Holders](https://dpo2u.com/blog/agents-permanent-holders) — The thesis behind this implementation
- [midnight-awesome-dapps](https://github.com/nickkatsios/midnight-awesome-dapps) — Midnight ecosystem projects
- [Midnight Network](https://midnight.network) — Privacy-preserving blockchain
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — Trustless Agent standard

## License

MIT
