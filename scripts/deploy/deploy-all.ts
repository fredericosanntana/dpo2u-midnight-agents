import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, operator] = await ethers.getSigners();

  console.log("=== DPO2U Deploy All Contracts ===");
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Operator:  ${operator.address}`);
  console.log(`Network:   ${(await ethers.provider.getNetwork()).name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);
  console.log("");

  // --- 1. Deploy Treasury ---
  console.log("[1/5] Deploying Treasury...");
  const Treasury = await ethers.getContractFactory("Treasury", deployer);
  const treasury = await Treasury.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`  Treasury deployed at: ${treasuryAddress}`);

  // --- 2. Deploy DPO2UToken ---
  console.log("[2/5] Deploying DPO2UToken...");
  const DPO2UToken = await ethers.getContractFactory("DPO2UToken", deployer);
  const token = await DPO2UToken.deploy(treasuryAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`  DPO2UToken deployed at: ${tokenAddress}`);

  // Note: DPO2UToken constructor already sets the treasury and makes it fee-exempt.
  // token.setTreasury() is available if the treasury address needs to change later.
  console.log("  Treasury already set in DPO2UToken constructor (fee-exempt).");

  // --- 3. Deploy AgentRegistry ---
  console.log("[3/5] Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry", deployer);
  const agentRegistry = await AgentRegistry.deploy(deployer.address);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log(`  AgentRegistry deployed at: ${agentRegistryAddress}`);

  // --- 4. Deploy SwapExecutor ---
  console.log("[4/5] Deploying SwapExecutor...");
  const SwapExecutor = await ethers.getContractFactory("SwapExecutor", deployer);
  const swapExecutor = await SwapExecutor.deploy(treasuryAddress);
  await swapExecutor.waitForDeployment();
  const swapExecutorAddress = await swapExecutor.getAddress();
  console.log(`  SwapExecutor deployed at: ${swapExecutorAddress}`);

  // --- 5. Grant Roles ---
  console.log("[5/5] Granting roles to operator...");

  // Grant OPERATOR_ROLE on Treasury
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const grantOpTx = await treasury.grantRole(OPERATOR_ROLE, operator.address);
  await grantOpTx.wait();
  console.log(`  Granted OPERATOR_ROLE on Treasury to ${operator.address}`);

  // Grant REGISTRAR_ROLE on AgentRegistry
  const REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REGISTRAR_ROLE"));
  const grantRegTx = await agentRegistry.grantRole(REGISTRAR_ROLE, operator.address);
  await grantRegTx.wait();
  console.log(`  Granted REGISTRAR_ROLE on AgentRegistry to ${operator.address}`);

  // --- Summary ---
  console.log("");
  console.log("=== Deployment Complete ===");
  console.log(`DPO2U_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`TREASURY_ADDRESS=${treasuryAddress}`);
  console.log(`AGENT_REGISTRY_ADDRESS=${agentRegistryAddress}`);
  console.log(`SWAP_EXECUTOR_ADDRESS=${swapExecutorAddress}`);

  // --- Save to .env-deployed ---
  const envContent = [
    `# DPO2U Deployed Addresses - ${new Date().toISOString()}`,
    `# Network: ${(await ethers.provider.getNetwork()).name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`,
    `# Deployer: ${deployer.address}`,
    `# Operator: ${operator.address}`,
    ``,
    `DPO2U_TOKEN_ADDRESS=${tokenAddress}`,
    `TREASURY_ADDRESS=${treasuryAddress}`,
    `AGENT_REGISTRY_ADDRESS=${agentRegistryAddress}`,
    `SWAP_EXECUTOR_ADDRESS=${swapExecutorAddress}`,
    ``,
  ].join("\n");

  const envPath = path.join(__dirname, "../..", ".env-deployed");
  fs.writeFileSync(envPath, envContent, "utf-8");
  console.log(`\nAddresses saved to ${envPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
