/**
 * Demo 3: DUST Generation Cycle
 *
 * Simulates the stake → DUST generation → operate cycle:
 * - Agent stakes $NIGHT tokens
 * - DUST is generated proportionally over time
 * - Agent uses DUST for operations
 * - Cycle repeats
 *
 * This is a simulation — actual DUST generation happens on Midnight Network.
 *
 * Run: npx hardhat run demos/03-dust-generation/run.ts
 */

import { ethers } from "hardhat";

// Simulation parameters (based on Midnight Network economics)
const DUST_PER_NIGHT_PER_DAY = 0.1; // 0.1 DUST per staked NIGHT per day
const OPERATION_COST_DUST = 0.5; // 0.5 DUST per ZK operation
const DAYS_TO_SIMULATE = 30;

interface AgentState {
  name: string;
  nightStaked: number;
  dustBalance: number;
  operationsPerDay: number;
  totalOperations: number;
}

async function main() {
  console.log("=== Demo 3: DUST Generation Cycle ===\n");
  console.log("Simulation of the Midnight Network stake → DUST → operate cycle.\n");

  // Define agents
  const agents: AgentState[] = [
    { name: "dpo2u-defi-ops", nightStaked: 10000, dustBalance: 0, operationsPerDay: 4, totalOperations: 0 },
    { name: "compliance-expert", nightStaked: 5000, dustBalance: 0, operationsPerDay: 2, totalOperations: 0 },
    { name: "content-creator", nightStaked: 3000, dustBalance: 0, operationsPerDay: 6, totalOperations: 0 },
    { name: "knowledge-manager", nightStaked: 2000, dustBalance: 0, operationsPerDay: 8, totalOperations: 0 },
  ];

  console.log("Initial stakes:");
  console.log("┌─────────────────────┬──────────────┬────────────┐");
  console.log("│ Agent               │ $NIGHT staked│ Ops/day    │");
  console.log("├─────────────────────┼──────────────┼────────────┤");
  for (const a of agents) {
    console.log(`│ ${a.name.padEnd(19)} │ ${a.nightStaked.toString().padStart(12)} │ ${a.operationsPerDay.toString().padStart(10)} │`);
  }
  console.log("└─────────────────────┴──────────────┴────────────┘\n");

  console.log(`Parameters: ${DUST_PER_NIGHT_PER_DAY} DUST/NIGHT/day, ${OPERATION_COST_DUST} DUST/operation\n`);

  // Simulate days
  console.log(`Simulating ${DAYS_TO_SIMULATE} days...\n`);

  for (let day = 1; day <= DAYS_TO_SIMULATE; day++) {
    for (const agent of agents) {
      // Generate DUST from staked NIGHT
      const dustGenerated = agent.nightStaked * DUST_PER_NIGHT_PER_DAY;
      agent.dustBalance += dustGenerated;

      // Consume DUST for operations
      const dustNeeded = agent.operationsPerDay * OPERATION_COST_DUST;
      const canAfford = Math.min(agent.operationsPerDay, Math.floor(agent.dustBalance / OPERATION_COST_DUST));
      agent.dustBalance -= canAfford * OPERATION_COST_DUST;
      agent.totalOperations += canAfford;
    }
  }

  // Results
  console.log(`Results after ${DAYS_TO_SIMULATE} days:`);
  console.log("┌─────────────────────┬──────────────┬───────────────┬────────────────┬──────────────┐");
  console.log("│ Agent               │ $NIGHT staked│ DUST balance  │ Total ops      │ Self-funding │");
  console.log("├─────────────────────┼──────────────┼───────────────┼────────────────┼──────────────┤");
  for (const a of agents) {
    const maxOps = a.operationsPerDay * DAYS_TO_SIMULATE;
    const selfFunding = a.totalOperations >= maxOps ? "YES" : `${((a.totalOperations / maxOps) * 100).toFixed(0)}%`;
    console.log(
      `│ ${a.name.padEnd(19)} │ ${a.nightStaked.toString().padStart(12)} │ ${a.dustBalance.toFixed(1).padStart(13)} │ ${(a.totalOperations + "/" + maxOps).padStart(14)} │ ${selfFunding.padStart(12)} │`
    );
  }
  console.log("└─────────────────────┴──────────────┴───────────────┴────────────────┴──────────────┘\n");

  // Break-even analysis
  console.log("Break-even analysis (minimum $NIGHT stake for self-funding):");
  console.log("┌─────────────────────┬────────────┬───────────────────┐");
  console.log("│ Agent               │ Ops/day    │ Min $NIGHT stake  │");
  console.log("├─────────────────────┼────────────┼───────────────────┤");
  for (const a of agents) {
    const minStake = Math.ceil((a.operationsPerDay * OPERATION_COST_DUST) / DUST_PER_NIGHT_PER_DAY);
    console.log(`│ ${a.name.padEnd(19)} │ ${a.operationsPerDay.toString().padStart(10)} │ ${minStake.toString().padStart(17)} │`);
  }
  console.log("└─────────────────────┴────────────┴───────────────────┘");

  console.log("\n=== Demo 3 Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
