/**
 * Demo 2: Fee Distribution
 *
 * Demonstrates the self-funding fee mechanism:
 * - DPO2UToken charges 1% on every transfer
 * - Fees flow automatically to Treasury
 * - Treasury accumulates for agent operations
 *
 * Run: npx hardhat run demos/02-fee-distribution/run.ts
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer, alice, bob, operator] = await ethers.getSigners();

  console.log("=== Demo 2: Fee Distribution ===\n");

  // Deploy Treasury
  console.log("1. Deploying Treasury...");
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();
  console.log(`   Treasury at: ${treasuryAddr}`);

  // Deploy Token
  console.log("\n2. Deploying DPO2UToken (100M supply, 1% fee)...");
  const Token = await ethers.getContractFactory("DPO2UToken");
  const token = await Token.deploy(treasuryAddr);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`   Token at: ${tokenAddr}`);

  // Initial state
  const totalSupply = await token.totalSupply();
  console.log(`   Total supply: ${ethers.formatEther(totalSupply)} DPO2U`);
  console.log(`   Fee: ${await token.feeBps()} bps (1%)`);

  // Distribute tokens
  const amount = ethers.parseEther("100000"); // 100K tokens
  console.log(`\n3. Distributing ${ethers.formatEther(amount)} DPO2U to Alice...`);
  await token.transfer(alice.address, amount); // fee-exempt (deployer)
  console.log(`   Alice balance: ${ethers.formatEther(await token.balanceOf(alice.address))}`);

  // Alice sends to Bob (NOT fee-exempt → 1% fee)
  const sendAmount = ethers.parseEther("10000"); // 10K tokens
  console.log(`\n4. Alice sends ${ethers.formatEther(sendAmount)} DPO2U to Bob (1% fee applies)...`);

  const treasuryBefore = await token.balanceOf(treasuryAddr);
  await token.connect(alice).transfer(bob.address, sendAmount);
  const treasuryAfter = await token.balanceOf(treasuryAddr);
  const feeCollected = treasuryAfter - treasuryBefore;

  console.log(`   Bob received: ${ethers.formatEther(await token.balanceOf(bob.address))} DPO2U`);
  console.log(`   Fee collected: ${ethers.formatEther(feeCollected)} DPO2U`);
  console.log(`   Treasury balance: ${ethers.formatEther(treasuryAfter)} DPO2U`);

  // Simulate multiple transfers
  console.log("\n5. Simulating 10 transfers of 1000 DPO2U each...");
  for (let i = 0; i < 10; i++) {
    await token.connect(alice).transfer(bob.address, ethers.parseEther("1000"));
  }
  const treasuryFinal = await token.balanceOf(treasuryAddr);
  console.log(`   Treasury accumulated: ${ethers.formatEther(treasuryFinal)} DPO2U`);
  console.log(`   Total fees from 11 transfers: ${ethers.formatEther(treasuryFinal - treasuryBefore)} DPO2U`);

  // Show the 40/60 split concept
  console.log("\n6. Conceptual 40/60 split (PaymentGateway on Midnight):");
  const totalFees = treasuryFinal - treasuryBefore;
  const operatorShare = (totalFees * 40n) / 100n;
  const protocolShare = (totalFees * 60n) / 100n;
  console.log(`   Operator (40%): ${ethers.formatEther(operatorShare)} DPO2U`);
  console.log(`   Protocol (60%): ${ethers.formatEther(protocolShare)} DPO2U`);

  console.log("\n=== Demo 2 Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
