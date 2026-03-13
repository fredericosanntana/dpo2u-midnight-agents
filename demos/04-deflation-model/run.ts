/**
 * Demo 4: Deflation Model Simulation
 *
 * The killer demo — numerical simulation of two-layer deflation:
 *   Layer 1: Transfer fee burns reduce circulating supply
 *   Layer 2: Agent staking locks tokens out of circulation
 *
 * Models: N agents × M assessments → supply impact over time
 *
 * Run: ts-node demos/04-deflation-model/run.ts
 *   or: npx hardhat run demos/04-deflation-model/run.ts
 */

// === Configuration ===

interface Scenario {
  name: string;
  agentGrowthPerMonth: number;  // new agents joining per month
  assessmentsPerAgent: number;  // assessments per agent per month
  feePerAssessment: number;     // $DPO2U fee per assessment
  stakePerAgent: number;        // $NIGHT staked per agent
  burnRateBps: number;          // basis points of transfer fees burned (0 = all to treasury)
}

const TOTAL_SUPPLY = 100_000_000; // 100M DPO2U
const TRANSFER_FEE_BPS = 100;    // 1%
const MONTHS_TO_SIMULATE = 24;   // 2 years

const scenarios: Scenario[] = [
  {
    name: "Conservative",
    agentGrowthPerMonth: 2,
    assessmentsPerAgent: 10,
    feePerAssessment: 100,
    stakePerAgent: 5000,
    burnRateBps: 2500, // 25% of fees burned
  },
  {
    name: "Moderate",
    agentGrowthPerMonth: 5,
    assessmentsPerAgent: 20,
    feePerAssessment: 100,
    stakePerAgent: 10000,
    burnRateBps: 2500,
  },
  {
    name: "Aggressive",
    agentGrowthPerMonth: 10,
    assessmentsPerAgent: 30,
    feePerAssessment: 150,
    stakePerAgent: 15000,
    burnRateBps: 5000, // 50% of fees burned
  },
];

function simulate(scenario: Scenario) {
  const results: Array<{
    month: number;
    agents: number;
    totalBurned: number;
    totalStaked: number;
    circulatingSupply: number;
    circulatingPct: number;
    monthlyVolume: number;
    monthlyFees: number;
  }> = [];

  let totalBurned = 0;
  let agents = 6; // starting with 6 DPO2U agents

  for (let month = 1; month <= MONTHS_TO_SIMULATE; month++) {
    // New agents join
    agents += scenario.agentGrowthPerMonth;

    // Monthly transaction volume from assessments
    const monthlyAssessments = agents * scenario.assessmentsPerAgent;
    const monthlyVolume = monthlyAssessments * scenario.feePerAssessment;

    // Transfer fees collected
    const monthlyFees = (monthlyVolume * TRANSFER_FEE_BPS) / 10000;

    // Portion burned (Layer 1 deflation)
    const burned = (monthlyFees * scenario.burnRateBps) / 10000;
    totalBurned += burned;

    // Total staked (Layer 2 deflation)
    const totalStaked = agents * scenario.stakePerAgent;

    // Effective circulating supply
    const circulatingSupply = TOTAL_SUPPLY - totalBurned - totalStaked;
    const circulatingPct = (circulatingSupply / TOTAL_SUPPLY) * 100;

    results.push({
      month,
      agents,
      totalBurned: Math.round(totalBurned),
      totalStaked,
      circulatingSupply: Math.round(circulatingSupply),
      circulatingPct,
      monthlyVolume,
      monthlyFees: Math.round(monthlyFees),
    });
  }

  return results;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

// === Main ===

console.log("=== Demo 4: Deflation Model Simulation ===\n");
console.log(`Total supply: ${formatNumber(TOTAL_SUPPLY)} DPO2U`);
console.log(`Transfer fee: ${TRANSFER_FEE_BPS / 100}%`);
console.log(`Simulation: ${MONTHS_TO_SIMULATE} months\n`);

for (const scenario of scenarios) {
  const results = simulate(scenario);

  console.log(`\n--- Scenario: ${scenario.name} ---`);
  console.log(`Agent growth: +${scenario.agentGrowthPerMonth}/month | Assessments: ${scenario.assessmentsPerAgent}/agent/month`);
  console.log(`Fee/assessment: ${scenario.feePerAssessment} DPO2U | Stake/agent: ${formatNumber(scenario.stakePerAgent)} NIGHT`);
  console.log(`Burn rate: ${scenario.burnRateBps / 100}% of transfer fees\n`);

  // Header
  console.log("┌───────┬────────┬──────────────┬──────────────┬───────────────┬──────────┐");
  console.log("│ Month │ Agents │ Total burned │ Total staked │ Circulating   │ % supply │");
  console.log("├───────┼────────┼──────────────┼──────────────┼───────────────┼──────────┤");

  // Show every 3 months + final
  for (const r of results) {
    if (r.month % 3 === 0 || r.month === 1 || r.month === MONTHS_TO_SIMULATE) {
      console.log(
        `│ ${r.month.toString().padStart(5)} │ ${r.agents.toString().padStart(6)} │ ${formatNumber(r.totalBurned).padStart(12)} │ ${formatNumber(r.totalStaked).padStart(12)} │ ${formatNumber(r.circulatingSupply).padStart(13)} │ ${r.circulatingPct.toFixed(1).padStart(7)}% │`
      );
    }
  }

  console.log("└───────┴────────┴──────────────┴──────────────┴───────────────┴──────────┘");

  // Summary
  const final = results[results.length - 1];
  const deflation = ((TOTAL_SUPPLY - final.circulatingSupply) / TOTAL_SUPPLY) * 100;
  console.log(`\nAfter ${MONTHS_TO_SIMULATE} months: ${final.agents} agents, ${deflation.toFixed(1)}% supply removed from circulation`);
}

console.log("\n--- Key Insight ---");
console.log("Agent staking creates a FLOOR of locked tokens that grows linearly with adoption.");
console.log("Combined with burn mechanics, this creates compounding deflation.");
console.log("Unlike speculative holders, agents CANNOT unstake without losing operational capacity.");

console.log("\n=== Demo 4 Complete ===");
