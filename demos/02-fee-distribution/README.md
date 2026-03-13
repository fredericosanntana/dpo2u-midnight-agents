# Demo 2: Fee Distribution

Shows how the 1% transfer fee flows from DPO2UToken to Treasury, and the conceptual 40/60 split between operators and protocol.

## What it demonstrates

1. Deploy Treasury and DPO2UToken
2. Transfer tokens between non-exempt addresses (1% fee applies)
3. Watch fees accumulate in Treasury
4. Simulate multiple transfers and show total fee accumulation
5. Illustrate the 40/60 split (operator/protocol) that happens on Midnight

## Run

```bash
npx hardhat run demos/02-fee-distribution/run.ts
```

## Key concepts

- **Transfer fee**: 1% of every transfer (configurable, max 5%)
- **Fee-exempt**: Deployer, treasury, LP pools can be exempted
- **Treasury accumulation**: Fees grow with transaction volume
- **40/60 split**: On Midnight, PaymentGateway splits fees between the operating agent (40%) and the protocol treasury (60%)
