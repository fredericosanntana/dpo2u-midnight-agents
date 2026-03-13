/**
 * Demo 1: Agent Registration
 *
 * Demonstrates how to register an autonomous agent on-chain with:
 * - Unique identity (bytes32 ID derived from name)
 * - Dedicated wallet
 * - Permission bitfield
 * - Metadata URI
 *
 * Run: npx hardhat run demos/01-agent-registration/run.ts
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer, agentWallet] = await ethers.getSigners();

  console.log("=== Demo 1: Agent Registration ===\n");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Agent wallet: ${agentWallet.address}\n`);

  // Deploy AgentRegistry
  console.log("1. Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  console.log(`   AgentRegistry deployed at: ${await registry.getAddress()}\n`);

  // Register an agent
  const agentName = "demo-agent-alpha";
  const permissions = 7; // READ + WRITE + TREASURY
  const metadataURI = "ipfs://QmDemo.../agent-alpha.json";

  console.log("2. Registering agent...");
  console.log(`   Name: ${agentName}`);
  console.log(`   Wallet: ${agentWallet.address}`);
  console.log(`   Permissions: ${permissions} (READ + WRITE + TREASURY)`);
  console.log(`   Metadata: ${metadataURI}`);

  const tx = await registry.registerAgent(
    agentName,
    agentWallet.address,
    permissions,
    metadataURI
  );
  const receipt = await tx.wait();
  console.log(`   Tx hash: ${receipt?.hash}`);

  // Derive and display the agent ID
  const agentId = ethers.keccak256(ethers.toUtf8Bytes(agentName));
  console.log(`   Agent ID: ${agentId}\n`);

  // Read back the agent
  console.log("3. Reading agent from registry...");
  const agent = await registry.agents(agentId);
  console.log(`   Name: ${agent.name}`);
  console.log(`   Wallet: ${agent.wallet}`);
  console.log(`   Status: ${["Inactive", "Active", "Suspended"][Number(agent.status)]}`);
  console.log(`   Permissions: ${agent.permissions}`);
  console.log(`   Registered at: ${new Date(Number(agent.registeredAt) * 1000).toISOString()}`);
  console.log(`   Last heartbeat: ${new Date(Number(agent.lastHeartbeat) * 1000).toISOString()}`);

  // Check permissions
  console.log("\n4. Permission checks...");
  const canRead = await registry.hasPermission(agentWallet.address, 1);
  const canWrite = await registry.hasPermission(agentWallet.address, 2);
  const canTreasury = await registry.hasPermission(agentWallet.address, 4);
  const canDeploy = await registry.hasPermission(agentWallet.address, 8);
  console.log(`   READ: ${canRead}`);
  console.log(`   WRITE: ${canWrite}`);
  console.log(`   TREASURY: ${canTreasury}`);
  console.log(`   DEPLOY: ${canDeploy}`);

  // Send heartbeat from agent wallet
  console.log("\n5. Sending heartbeat from agent wallet...");
  const hbTx = await registry.connect(agentWallet).heartbeat();
  await hbTx.wait();
  const agentAfter = await registry.agents(agentId);
  console.log(`   Heartbeat updated: ${new Date(Number(agentAfter.lastHeartbeat) * 1000).toISOString()}`);

  // Total agents
  const count = await registry.agentCount();
  console.log(`\n6. Total registered agents: ${count}`);

  console.log("\n=== Demo 1 Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
