import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentRegistry", function () {
  let registry: AgentRegistry;
  let owner: SignerWithAddress;
  let registrar: SignerWithAddress;
  let agentWallet1: SignerWithAddress;
  let agentWallet2: SignerWithAddress;
  let nobody: SignerWithAddress;

  const REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REGISTRAR_ROLE"));
  const PERM_READ = 1n;
  const PERM_WRITE = 2n;
  const PERM_TREASURY = 4n;
  const PERM_DEPLOY = 8n;
  const PERM_GOVERNANCE = 16n;

  beforeEach(async function () {
    [owner, registrar, agentWallet1, agentWallet2, nobody] = await ethers.getSigners();

    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = await RegistryFactory.deploy(owner.address);

    // Grant registrar role
    await registry.grantRole(REGISTRAR_ROLE, registrar.address);
  });

  describe("Deployment", function () {
    it("Should set admin roles", async function () {
      expect(await registry.hasRole(ethers.ZeroHash, owner.address)).to.be.true;
      expect(await registry.hasRole(REGISTRAR_ROLE, owner.address)).to.be.true;
    });

    it("Should have zero agents initially", async function () {
      expect(await registry.agentCount()).to.equal(0);
    });
  });

  describe("Agent Registration", function () {
    it("Should register an agent", async function () {
      const perms = PERM_READ | PERM_WRITE; // 3
      const tx = await registry
        .connect(registrar)
        .registerAgent("agent-factory", agentWallet1.address, perms, "ipfs://metadata1");

      const receipt = await tx.wait();
      expect(await registry.agentCount()).to.equal(1);

      const id = ethers.keccak256(ethers.toUtf8Bytes("agent-factory"));
      const agent = await registry.agents(id);
      expect(agent.name).to.equal("agent-factory");
      expect(agent.wallet).to.equal(agentWallet1.address);
      expect(agent.permissions).to.equal(3n);
      expect(agent.status).to.equal(1); // Active
    });

    it("Should emit AgentRegistered event", async function () {
      const perms = PERM_READ;
      await expect(
        registry
          .connect(registrar)
          .registerAgent("test-agent", agentWallet1.address, perms, "ipfs://test")
      ).to.emit(registry, "AgentRegistered");
    });

    it("Should set walletToAgent mapping", async function () {
      await registry
        .connect(registrar)
        .registerAgent("agent-1", agentWallet1.address, PERM_READ, "ipfs://1");

      const id = ethers.keccak256(ethers.toUtf8Bytes("agent-1"));
      expect(await registry.walletToAgent(agentWallet1.address)).to.equal(id);
    });

    it("Should reject duplicate agent name", async function () {
      await registry
        .connect(registrar)
        .registerAgent("agent-dup", agentWallet1.address, PERM_READ, "ipfs://1");

      await expect(
        registry
          .connect(registrar)
          .registerAgent("agent-dup", agentWallet2.address, PERM_READ, "ipfs://2")
      ).to.be.revertedWithCustomError(registry, "AgentAlreadyExists");
    });

    it("Should reject duplicate wallet", async function () {
      await registry
        .connect(registrar)
        .registerAgent("agent-a", agentWallet1.address, PERM_READ, "ipfs://a");

      await expect(
        registry
          .connect(registrar)
          .registerAgent("agent-b", agentWallet1.address, PERM_READ, "ipfs://b")
      ).to.be.revertedWithCustomError(registry, "WalletAlreadyRegistered");
    });

    it("Should reject zero address wallet", async function () {
      await expect(
        registry
          .connect(registrar)
          .registerAgent("agent-zero", ethers.ZeroAddress, PERM_READ, "ipfs://zero")
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("Should reject unauthorized registrar", async function () {
      await expect(
        registry
          .connect(nobody)
          .registerAgent("agent-unauth", agentWallet1.address, PERM_READ, "ipfs://unauth")
      ).to.be.reverted;
    });
  });

  describe("Heartbeat", function () {
    beforeEach(async function () {
      await registry
        .connect(registrar)
        .registerAgent("hb-agent", agentWallet1.address, PERM_READ, "ipfs://hb");
    });

    it("Should update lastHeartbeat", async function () {
      await registry.connect(agentWallet1).heartbeat();
      const id = ethers.keccak256(ethers.toUtf8Bytes("hb-agent"));
      const agent = await registry.agents(id);
      expect(agent.lastHeartbeat).to.be.gt(0);
    });

    it("Should emit Heartbeat event", async function () {
      await expect(registry.connect(agentWallet1).heartbeat()).to.emit(registry, "Heartbeat");
    });

    it("Should reject heartbeat from non-agent wallet", async function () {
      await expect(registry.connect(nobody).heartbeat()).to.be.revertedWithCustomError(
        registry,
        "NotAgentWallet"
      );
    });
  });

  describe("Permission Checks", function () {
    beforeEach(async function () {
      // Register agent with READ+WRITE+TREASURY (7)
      await registry
        .connect(registrar)
        .registerAgent(
          "perm-agent",
          agentWallet1.address,
          PERM_READ | PERM_WRITE | PERM_TREASURY,
          "ipfs://perm"
        );
    });

    it("Should return true for granted permissions", async function () {
      expect(await registry.hasPermission(agentWallet1.address, PERM_READ)).to.be.true;
      expect(await registry.hasPermission(agentWallet1.address, PERM_WRITE)).to.be.true;
      expect(await registry.hasPermission(agentWallet1.address, PERM_TREASURY)).to.be.true;
    });

    it("Should return false for non-granted permissions", async function () {
      expect(await registry.hasPermission(agentWallet1.address, PERM_DEPLOY)).to.be.false;
      expect(await registry.hasPermission(agentWallet1.address, PERM_GOVERNANCE)).to.be.false;
    });

    it("Should return false for unregistered wallet", async function () {
      expect(await registry.hasPermission(nobody.address, PERM_READ)).to.be.false;
    });

    it("Should return false for suspended agent", async function () {
      const id = ethers.keccak256(ethers.toUtf8Bytes("perm-agent"));
      await registry.setAgentStatus(id, 2); // Suspended
      expect(await registry.hasPermission(agentWallet1.address, PERM_READ)).to.be.false;
    });
  });

  describe("Agent Management", function () {
    let agentId: string;

    beforeEach(async function () {
      await registry
        .connect(registrar)
        .registerAgent("managed-agent", agentWallet1.address, PERM_READ, "ipfs://v1");
      agentId = ethers.keccak256(ethers.toUtf8Bytes("managed-agent"));
    });

    it("Should update agent permissions and metadata", async function () {
      await registry
        .connect(registrar)
        .updateAgent(agentId, PERM_READ | PERM_WRITE, "ipfs://v2");

      const agent = await registry.agents(agentId);
      expect(agent.permissions).to.equal(3n);
      expect(agent.metadataURI).to.equal("ipfs://v2");
    });

    it("Should change agent status", async function () {
      await registry.setAgentStatus(agentId, 2); // Suspended
      const agent = await registry.agents(agentId);
      expect(agent.status).to.equal(2);
    });

    it("Should reject update of non-existent agent", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(
        registry.connect(registrar).updateAgent(fakeId, 1n, "ipfs://fake")
      ).to.be.revertedWithCustomError(registry, "AgentNotFound");
    });
  });

  describe("Queries", function () {
    it("Should get agent by wallet", async function () {
      await registry
        .connect(registrar)
        .registerAgent("query-agent", agentWallet1.address, PERM_READ, "ipfs://query");

      const agent = await registry.getAgentByWallet(agentWallet1.address);
      expect(agent.name).to.equal("query-agent");
    });

    it("Should revert getAgentByWallet for unregistered", async function () {
      await expect(registry.getAgentByWallet(nobody.address)).to.be.revertedWithCustomError(
        registry,
        "NotAgentWallet"
      );
    });

    it("Should iterate all agents via agentIds", async function () {
      await registry
        .connect(registrar)
        .registerAgent("agent-x", agentWallet1.address, 1n, "ipfs://x");
      await registry
        .connect(registrar)
        .registerAgent("agent-y", agentWallet2.address, 3n, "ipfs://y");

      expect(await registry.agentCount()).to.equal(2);

      const id0 = await registry.agentIds(0);
      const id1 = await registry.agentIds(1);
      const a0 = await registry.agents(id0);
      const a1 = await registry.agents(id1);

      expect(a0.name).to.equal("agent-x");
      expect(a1.name).to.equal("agent-y");
    });
  });
});
