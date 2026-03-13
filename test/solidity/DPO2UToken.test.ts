import { expect } from "chai";
import { ethers } from "hardhat";
import { DPO2UToken, Treasury } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DPO2UToken", function () {
  let token: DPO2UToken;
  let treasury: Treasury;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let treasuryAddr: string;

  const TOTAL_SUPPLY = ethers.parseEther("100000000"); // 100M
  const TRANSFER_AMOUNT = ethers.parseEther("10000"); // 10K

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy Treasury first
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(owner.address);
    treasuryAddr = await treasury.getAddress();

    // Deploy Token with treasury
    const TokenFactory = await ethers.getContractFactory("DPO2UToken");
    token = await TokenFactory.deploy(treasuryAddr);
  });

  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      expect(await token.name()).to.equal("DPO2U");
      expect(await token.symbol()).to.equal("DPO2U");
    });

    it("Should mint total supply to deployer", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
    });

    it("Should set treasury address", async function () {
      expect(await token.treasury()).to.equal(treasuryAddr);
    });

    it("Should set deployer and treasury as fee-exempt", async function () {
      expect(await token.feeExempt(owner.address)).to.be.true;
      expect(await token.feeExempt(treasuryAddr)).to.be.true;
    });

    it("Should set default fee to 100 bps (1%)", async function () {
      expect(await token.feeBps()).to.equal(100);
    });

    it("Should revert if treasury is zero address", async function () {
      const TokenFactory = await ethers.getContractFactory("DPO2UToken");
      await expect(TokenFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        token,
        "ZeroAddress"
      );
    });
  });

  describe("Transfer Fee", function () {
    beforeEach(async function () {
      // Owner sends tokens to alice (fee-exempt since owner is exempt)
      await token.transfer(alice.address, TRANSFER_AMOUNT);
    });

    it("Should charge 1% fee on non-exempt transfers", async function () {
      const amount = ethers.parseEther("1000");
      const expectedFee = amount / 100n; // 1%
      const expectedNet = amount - expectedFee;

      await token.connect(alice).transfer(bob.address, amount);

      expect(await token.balanceOf(bob.address)).to.equal(expectedNet);
      expect(await token.balanceOf(treasuryAddr)).to.equal(expectedFee);
    });

    it("Should not charge fee for fee-exempt sender", async function () {
      const amount = ethers.parseEther("1000");

      // Owner is fee-exempt
      await token.transfer(bob.address, amount);

      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });

    it("Should not charge fee for fee-exempt recipient", async function () {
      const amount = ethers.parseEther("1000");

      // Make bob fee-exempt
      await token.setFeeExempt(bob.address, true);
      await token.connect(alice).transfer(bob.address, amount);

      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });

    it("Should send fees to treasury", async function () {
      const amount = ethers.parseEther("5000");
      const expectedFee = amount / 100n;

      const treasuryBefore = await token.balanceOf(treasuryAddr);
      await token.connect(alice).transfer(bob.address, amount);
      const treasuryAfter = await token.balanceOf(treasuryAddr);

      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to change fee", async function () {
      await token.setFee(200); // 2%
      expect(await token.feeBps()).to.equal(200);
    });

    it("Should reject fee above MAX_FEE_BPS", async function () {
      await expect(token.setFee(501)).to.be.revertedWithCustomError(token, "FeeTooHigh");
    });

    it("Should allow setting fee to 0 (no fee)", async function () {
      await token.setFee(0);
      expect(await token.feeBps()).to.equal(0);

      // Transfer with 0 fee
      await token.transfer(alice.address, TRANSFER_AMOUNT);
      await token.connect(alice).transfer(bob.address, ethers.parseEther("100"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should reject non-owner fee change", async function () {
      await expect(token.connect(alice).setFee(200)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Treasury Management", function () {
    it("Should allow owner to change treasury", async function () {
      await token.setTreasury(bob.address);
      expect(await token.treasury()).to.equal(bob.address);
    });

    it("Should update fee exemptions on treasury change", async function () {
      await token.setTreasury(bob.address);
      expect(await token.feeExempt(bob.address)).to.be.true;
      expect(await token.feeExempt(treasuryAddr)).to.be.false;
    });

    it("Should reject zero address treasury", async function () {
      await expect(token.setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        token,
        "ZeroAddress"
      );
    });
  });

  describe("Burn", function () {
    it("Should allow token holders to burn", async function () {
      await token.transfer(alice.address, TRANSFER_AMOUNT);
      const aliceBal = await token.balanceOf(alice.address);
      const burnAmount = ethers.parseEther("100");
      await token.connect(alice).burn(burnAmount);
      expect(await token.balanceOf(alice.address)).to.equal(aliceBal - burnAmount);
    });
  });

  describe("Fee Exemption", function () {
    it("Should allow owner to set fee exemption", async function () {
      await token.setFeeExempt(alice.address, true);
      expect(await token.feeExempt(alice.address)).to.be.true;
    });

    it("Should allow owner to remove fee exemption", async function () {
      await token.setFeeExempt(alice.address, true);
      await token.setFeeExempt(alice.address, false);
      expect(await token.feeExempt(alice.address)).to.be.false;
    });
  });
});
