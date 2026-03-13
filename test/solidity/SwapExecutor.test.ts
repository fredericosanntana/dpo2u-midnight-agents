import { expect } from "chai";
import { ethers } from "hardhat";
import { SwapExecutor, Treasury, DPO2UToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SwapExecutor", function () {
  let swapExecutor: SwapExecutor;
  let treasury: Treasury;
  let token: DPO2UToken;
  let owner: SignerWithAddress;
  let nobody: SignerWithAddress;
  let treasuryAddr: string;

  beforeEach(async function () {
    [owner, nobody] = await ethers.getSigners();

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(owner.address);
    treasuryAddr = await treasury.getAddress();

    // Deploy Token
    const TokenFactory = await ethers.getContractFactory("DPO2UToken");
    token = await TokenFactory.deploy(treasuryAddr);

    // Deploy SwapExecutor
    const SwapFactory = await ethers.getContractFactory("SwapExecutor");
    swapExecutor = await SwapFactory.deploy(treasuryAddr);
  });

  describe("Deployment", function () {
    it("Should set treasury address", async function () {
      expect(await swapExecutor.treasury()).to.equal(treasuryAddr);
    });

    it("Should set owner", async function () {
      expect(await swapExecutor.owner()).to.equal(owner.address);
    });

    it("Should have correct constants", async function () {
      expect(await swapExecutor.WETH()).to.equal("0x4200000000000000000000000000000000000006");
      expect(await swapExecutor.USDC()).to.equal("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      expect(await swapExecutor.MAX_SLIPPAGE_BPS()).to.equal(300);
    });

    it("Should reject zero address treasury", async function () {
      const SwapFactory = await ethers.getContractFactory("SwapExecutor");
      await expect(SwapFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        swapExecutor,
        "ZeroAddress"
      );
    });
  });

  describe("Access Control", function () {
    it("Should reject swapETHtoUSDC from non-owner", async function () {
      await expect(
        swapExecutor.connect(nobody).swapETHtoUSDC(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(swapExecutor, "OwnableUnauthorizedAccount");
    });

    it("Should reject swapTokenToUSDC from non-owner", async function () {
      await expect(
        swapExecutor
          .connect(nobody)
          .swapTokenToUSDC(await token.getAddress(), ethers.parseEther("100"), 0, 3000)
      ).to.be.revertedWithCustomError(swapExecutor, "OwnableUnauthorizedAccount");
    });

    it("Should reject swapETHtoUSDC with zero value", async function () {
      await expect(swapExecutor.swapETHtoUSDC(0)).to.be.revertedWithCustomError(
        swapExecutor,
        "ZeroAmount"
      );
    });

    it("Should reject swapTokenToUSDC with zero amount", async function () {
      await expect(
        swapExecutor.swapTokenToUSDC(await token.getAddress(), 0, 0, 3000)
      ).to.be.revertedWithCustomError(swapExecutor, "ZeroAmount");
    });

    it("Should reject swapTokenToUSDC with zero token address", async function () {
      await expect(
        swapExecutor.swapTokenToUSDC(ethers.ZeroAddress, ethers.parseEther("100"), 0, 3000)
      ).to.be.revertedWithCustomError(swapExecutor, "ZeroAddress");
    });
  });

  describe("Treasury Management", function () {
    it("Should allow owner to update treasury", async function () {
      await swapExecutor.setTreasury(nobody.address);
      expect(await swapExecutor.treasury()).to.equal(nobody.address);
    });

    it("Should reject zero address", async function () {
      await expect(swapExecutor.setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        swapExecutor,
        "ZeroAddress"
      );
    });

    it("Should reject non-owner", async function () {
      await expect(
        swapExecutor.connect(nobody).setTreasury(nobody.address)
      ).to.be.revertedWithCustomError(swapExecutor, "OwnableUnauthorizedAccount");
    });
  });

  describe("Rescue", function () {
    it("Should allow owner to rescue stuck tokens", async function () {
      // Send tokens to SwapExecutor
      const swapAddr = await swapExecutor.getAddress();
      await token.transfer(swapAddr, ethers.parseEther("100"));

      const before = await token.balanceOf(owner.address);
      await swapExecutor.rescueTokens(await token.getAddress(), ethers.parseEther("100"));
      const after = await token.balanceOf(owner.address);

      expect(after - before).to.equal(ethers.parseEther("100"));
    });
  });

  // Note: swapETHtoUSDC and swapTokenToUSDC cannot be fully tested on Hardhat local network
  // because they call external Uniswap V3 SwapRouter which doesn't exist locally.
  // These should be tested on Base Sepolia fork or integration tests.
  describe("Integration Notes", function () {
    it("Swap functions require Base fork for full testing", async function () {
      // This is a placeholder to document that swap functions need fork testing
      // Enable forking in hardhat.config.ts and run with --network hardhat
      expect(true).to.be.true;
    });
  });
});
