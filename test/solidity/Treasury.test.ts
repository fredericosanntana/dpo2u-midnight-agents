import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury, DPO2UToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Treasury", function () {
  let treasury: Treasury;
  let token: DPO2UToken;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let recipient: SignerWithAddress;
  let nobody: SignerWithAddress;

  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const GOVERNOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNOR_ROLE"));

  beforeEach(async function () {
    [owner, operator, recipient, nobody] = await ethers.getSigners();

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(owner.address);

    // Deploy Token with treasury as target
    const treasuryAddr = await treasury.getAddress();
    const TokenFactory = await ethers.getContractFactory("DPO2UToken");
    token = await TokenFactory.deploy(treasuryAddr);

    // Grant operator role
    await treasury.grantRole(OPERATOR_ROLE, operator.address);

    // Fund treasury with tokens
    await token.transfer(treasuryAddr, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set admin as DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN = ethers.ZeroHash;
      expect(await treasury.hasRole(DEFAULT_ADMIN, owner.address)).to.be.true;
    });

    it("Should set admin as GOVERNOR_ROLE", async function () {
      expect(await treasury.hasRole(GOVERNOR_ROLE, owner.address)).to.be.true;
    });

    it("Should accept ETH via receive", async function () {
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("1"),
      });
      const bal = await ethers.provider.getBalance(await treasury.getAddress());
      expect(bal).to.equal(ethers.parseEther("1"));
    });
  });

  describe("ERC-20 Withdrawal", function () {
    it("Should allow operator to withdraw tokens", async function () {
      // Set limits appropriate for 18-decimal tokens
      await treasury.setLimits(ethers.parseEther("500"), ethers.parseEther("2000"));
      const tokenAmount = ethers.parseEther("100");

      await treasury
        .connect(operator)
        .withdraw(await token.getAddress(), recipient.address, tokenAmount, "Test withdrawal");

      expect(await token.balanceOf(recipient.address)).to.equal(tokenAmount);
    });

    it("Should reject withdrawal exceeding per-tx limit", async function () {
      // Default maxPerTx is 500 * 1e6 = 500_000_000 (USDC 6 decimals)
      // But we're using 18-decimal tokens, so let's set limits appropriately
      await treasury.setLimits(ethers.parseEther("500"), ethers.parseEther("2000"));

      const tooMuch = ethers.parseEther("501");
      await expect(
        treasury
          .connect(operator)
          .withdraw(await token.getAddress(), recipient.address, tooMuch, "Too much")
      ).to.be.revertedWithCustomError(treasury, "ExceedsPerTxLimit");
    });

    it("Should reject withdrawal exceeding daily limit", async function () {
      await treasury.setLimits(ethers.parseEther("1000"), ethers.parseEther("2000"));

      // First withdrawal
      await treasury
        .connect(operator)
        .withdraw(await token.getAddress(), recipient.address, ethers.parseEther("1000"), "First");

      // Second withdrawal should exceed daily
      await treasury
        .connect(operator)
        .withdraw(await token.getAddress(), recipient.address, ethers.parseEther("999"), "Second");

      // Third should fail
      await expect(
        treasury
          .connect(operator)
          .withdraw(await token.getAddress(), recipient.address, ethers.parseEther("100"), "Overflow")
      ).to.be.revertedWithCustomError(treasury, "ExceedsDailyLimit");
    });

    it("Should reject zero amount", async function () {
      await expect(
        treasury.connect(operator).withdraw(await token.getAddress(), recipient.address, 0, "Zero")
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });

    it("Should reject unauthorized caller", async function () {
      await expect(
        treasury
          .connect(nobody)
          .withdraw(await token.getAddress(), recipient.address, ethers.parseEther("1"), "Unauth")
      ).to.be.reverted;
    });

    it("Should reset daily limit on new day", async function () {
      await treasury.setLimits(ethers.parseEther("1000"), ethers.parseEther("1500"));

      await treasury
        .connect(operator)
        .withdraw(await token.getAddress(), recipient.address, ethers.parseEther("1000"), "Day 1");

      // Advance 1 day
      await time.increase(86400);

      // Should work on new day
      await treasury
        .connect(operator)
        .withdraw(await token.getAddress(), recipient.address, ethers.parseEther("1000"), "Day 2");
    });
  });

  describe("ETH Withdrawal", function () {
    beforeEach(async function () {
      // Fund treasury with ETH
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });
      await treasury.setLimits(ethers.parseEther("5"), ethers.parseEther("20"));
    });

    it("Should allow operator to withdraw ETH", async function () {
      const before = await ethers.provider.getBalance(recipient.address);
      await treasury
        .connect(operator)
        .withdrawETH(recipient.address, ethers.parseEther("1"), "Gas refill");
      const after = await ethers.provider.getBalance(recipient.address);
      expect(after - before).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Limits Management", function () {
    it("Should allow governor to update limits", async function () {
      await treasury.setLimits(1000n, 5000n);
      expect(await treasury.maxPerTx()).to.equal(1000n);
      expect(await treasury.maxPerDay()).to.equal(5000n);
    });

    it("Should reject non-governor limit update", async function () {
      await expect(treasury.connect(nobody).setLimits(1000n, 5000n)).to.be.reverted;
    });
  });

  describe("Daily Remaining", function () {
    it("Should return full daily limit for new day", async function () {
      const remaining = await treasury.dailyRemaining(operator.address);
      expect(remaining).to.equal(await treasury.maxPerDay());
    });

    it("Should decrease after withdrawal", async function () {
      await treasury.setLimits(ethers.parseEther("1000"), ethers.parseEther("2000"));
      await treasury
        .connect(operator)
        .withdraw(await token.getAddress(), recipient.address, ethers.parseEther("500"), "Test");

      const remaining = await treasury.dailyRemaining(operator.address);
      expect(remaining).to.equal(ethers.parseEther("1500"));
    });
  });
});
