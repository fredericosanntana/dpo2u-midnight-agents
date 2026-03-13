import { expect } from "chai";
import { ethers } from "hardhat";
import { DPO2UAgentBridge, AgentRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DPO2UAgentBridge", function () {
  let bridge: DPO2UAgentBridge;
  let agentRegistry: AgentRegistry;
  let mockIdentity: any;
  let mockReputation: any;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let agentWallet: SignerWithAddress;
  let nobody: SignerWithAddress;

  const BRIDGE_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_OPERATOR_ROLE"));
  const REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REGISTRAR_ROLE"));

  beforeEach(async function () {
    [owner, operator, agentWallet, nobody] = await ethers.getSigners();

    // Deploy mock ERC-8004 registries
    const MockIdentityFactory = await ethers.getContractFactory("MockIdentityRegistry");
    mockIdentity = await MockIdentityFactory.deploy();

    const MockReputationFactory = await ethers.getContractFactory("MockReputationRegistry");
    mockReputation = await MockReputationFactory.deploy();

    // Deploy AgentRegistry
    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await RegistryFactory.deploy(owner.address);

    // Deploy Bridge
    const BridgeFactory = await ethers.getContractFactory("DPO2UAgentBridge");
    bridge = await BridgeFactory.deploy(
      owner.address,
      await mockIdentity.getAddress(),
      await mockReputation.getAddress()
    );

    // Grant roles
    await agentRegistry.grantRole(REGISTRAR_ROLE, operator.address);
    await bridge.grantRole(BRIDGE_OPERATOR_ROLE, operator.address);

    // Register an agent in DPO2U AgentRegistry
    await agentRegistry.connect(operator).registerAgent(
      "test-agent",
      agentWallet.address,
      7, // READ + WRITE + TREASURY
      "ipfs://test-metadata"
    );
  });

  describe("Deployment", function () {
    it("Should set identity and reputation registry addresses", async function () {
      expect(await bridge.identityRegistry()).to.equal(await mockIdentity.getAddress());
      expect(await bridge.reputationRegistry()).to.equal(await mockReputation.getAddress());
    });

    it("Should have zero bridged agents initially", async function () {
      expect(await bridge.bridgedAgentCount()).to.equal(0);
    });

    it("Should set admin and operator roles", async function () {
      expect(await bridge.hasRole(ethers.ZeroHash, owner.address)).to.be.true;
      expect(await bridge.hasRole(BRIDGE_OPERATOR_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Registration on ERC-8004", function () {
    it("Should register agent and return ERC-8004 ID", async function () {
      const dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));

      await bridge.connect(operator).registerOnERC8004(
        dpo2uId,
        "https://dpo2u.com/agents/test-agent.json",
        []
      );

      const erc8004Id = await bridge.getERC8004Id(dpo2uId);
      expect(erc8004Id).to.be.gt(0);
      expect(await bridge.getDPO2UId(erc8004Id)).to.equal(dpo2uId);
      expect(await bridge.bridgedAgentCount()).to.equal(1);
    });

    it("Should emit AgentBridged event", async function () {
      const dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));

      await expect(
        bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/agent.json", [])
      ).to.emit(bridge, "AgentBridged");
    });

    it("Should reject duplicate registration", async function () {
      const dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", []);

      await expect(
        bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/b.json", [])
      ).to.be.revertedWithCustomError(bridge, "AlreadyBridged");
    });

    it("Should reject unauthorized caller", async function () {
      const dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));

      await expect(
        bridge.connect(nobody).registerOnERC8004(dpo2uId, "https://example.com/a.json", [])
      ).to.be.reverted;
    });

    it("Should register with metadata entries", async function () {
      const dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      const metadata = [
        {
          metadataKey: "dpo2u:permissions",
          metadataValue: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [7]),
        },
        {
          metadataKey: "protocol:mcp",
          metadataValue: ethers.toUtf8Bytes("true"),
        },
      ];

      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", metadata);

      const erc8004Id = await bridge.getERC8004Id(dpo2uId);
      expect(erc8004Id).to.be.gt(0);

      // Verify metadata was stored in mock
      const storedPerms = await mockIdentity.getMetadata(erc8004Id, "dpo2u:permissions");
      expect(storedPerms).to.equal(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [7]));
    });

    it("Should register multiple agents sequentially", async function () {
      // Register second agent in DPO2U first
      await agentRegistry.connect(operator).registerAgent(
        "test-agent-2", nobody.address, 1, "ipfs://test2"
      );

      const id1 = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      const id2 = ethers.keccak256(ethers.toUtf8Bytes("test-agent-2"));

      await bridge.connect(operator).registerOnERC8004(id1, "https://a.json", []);
      await bridge.connect(operator).registerOnERC8004(id2, "https://b.json", []);

      expect(await bridge.bridgedAgentCount()).to.equal(2);
      expect(await bridge.getERC8004Id(id1)).to.equal(1);
      expect(await bridge.getERC8004Id(id2)).to.equal(2);
    });
  });

  describe("Heartbeat Sync", function () {
    let dpo2uId: string;

    beforeEach(async function () {
      dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", []);
    });

    it("Should sync heartbeat to ERC-8004 metadata", async function () {
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        bridge.connect(operator).syncHeartbeat(dpo2uId, timestamp)
      ).to.emit(bridge, "HeartbeatSynced");

      // Verify metadata was updated in mock
      const erc8004Id = await bridge.getERC8004Id(dpo2uId);
      const stored = await mockIdentity.getMetadata(erc8004Id, "dpo2u:lastHeartbeat");
      expect(stored).to.not.equal("0x");
    });

    it("Should reject sync for non-bridged agent", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));

      await expect(
        bridge.connect(operator).syncHeartbeat(fakeId, 12345)
      ).to.be.revertedWithCustomError(bridge, "NotBridged");
    });
  });

  describe("Permissions Sync", function () {
    let dpo2uId: string;

    beforeEach(async function () {
      dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", []);
    });

    it("Should sync permissions to ERC-8004 metadata", async function () {
      await expect(
        bridge.connect(operator).syncPermissions(dpo2uId, 7)
      ).to.emit(bridge, "PermissionsSynced");
    });

    it("Should reject for non-bridged agent", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(
        bridge.connect(operator).syncPermissions(fakeId, 7)
      ).to.be.revertedWithCustomError(bridge, "NotBridged");
    });
  });

  describe("Feedback", function () {
    let dpo2uId: string;
    let erc8004Id: bigint;

    beforeEach(async function () {
      dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", []);
      erc8004Id = await bridge.getERC8004Id(dpo2uId);
    });

    it("Should submit positive feedback", async function () {
      await expect(
        bridge.connect(operator).submitFeedback(erc8004Id, 100, 0, "claim-swap", "success")
      ).to.emit(bridge, "FeedbackSubmitted");
    });

    it("Should submit negative feedback", async function () {
      await bridge.connect(operator).submitFeedback(erc8004Id, -100, 0, "claim-swap", "failure");
    });

    it("Should reject unauthorized feedback", async function () {
      await expect(
        bridge.connect(nobody).submitFeedback(erc8004Id, 100, 0, "test", "test")
      ).to.be.reverted;
    });
  });

  describe("Agent URI Update", function () {
    let dpo2uId: string;

    beforeEach(async function () {
      dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", []);
    });

    it("Should update agentURI", async function () {
      await bridge.connect(operator).updateAgentURI(dpo2uId, "ipfs://new-uri");
    });

    it("Should reject for non-bridged agent", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(
        bridge.connect(operator).updateAgentURI(fakeId, "ipfs://new")
      ).to.be.revertedWithCustomError(bridge, "NotBridged");
    });
  });

  describe("Arbitrary Metadata", function () {
    let dpo2uId: string;

    beforeEach(async function () {
      dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", []);
    });

    it("Should set arbitrary metadata key-value", async function () {
      await bridge.connect(operator).setMetadata(
        dpo2uId,
        "protocol:a2a",
        ethers.toUtf8Bytes("true")
      );

      const erc8004Id = await bridge.getERC8004Id(dpo2uId);
      const stored = await mockIdentity.getMetadata(erc8004Id, "protocol:a2a");
      expect(ethers.toUtf8String(stored)).to.equal("true");
    });
  });

  describe("View Functions", function () {
    it("Should return 0 for non-bridged agent", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      expect(await bridge.getERC8004Id(fakeId)).to.equal(0);
    });

    it("Should return zero bytes32 for unmapped ERC-8004 ID", async function () {
      expect(await bridge.getDPO2UId(999)).to.equal(ethers.ZeroHash);
    });

    it("Should return reputation summary via bridge", async function () {
      const dpo2uId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));
      await bridge.connect(operator).registerOnERC8004(dpo2uId, "https://example.com/a.json", []);
      const erc8004Id = await bridge.getERC8004Id(dpo2uId);

      const [count, value, decimals] = await bridge.getAgentReputation(erc8004Id, "", "");
      expect(count).to.equal(0);
      expect(value).to.equal(0);
    });
  });
});

describe("AgentRegistry — ERC-8004 Extension", function () {
  let registry: AgentRegistry;
  let owner: SignerWithAddress;
  let registrar: SignerWithAddress;
  let agentWallet: SignerWithAddress;
  let nobody: SignerWithAddress;

  const REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REGISTRAR_ROLE"));

  beforeEach(async function () {
    [owner, registrar, agentWallet, nobody] = await ethers.getSigners();
    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = await RegistryFactory.deploy(owner.address);
    await registry.grantRole(REGISTRAR_ROLE, registrar.address);

    await registry.connect(registrar).registerAgent(
      "erc-agent", agentWallet.address, 7, "ipfs://test"
    );
  });

  it("Should initialize erc8004Id to 0", async function () {
    const id = ethers.keccak256(ethers.toUtf8Bytes("erc-agent"));
    const agent = await registry.agents(id);
    expect(agent.erc8004Id).to.equal(0);
  });

  it("Should set erc8004Id", async function () {
    const id = ethers.keccak256(ethers.toUtf8Bytes("erc-agent"));
    await registry.connect(registrar).setERC8004Id(id, 42);
    const agent = await registry.agents(id);
    expect(agent.erc8004Id).to.equal(42);
  });

  it("Should emit ERC8004IdSet event", async function () {
    const id = ethers.keccak256(ethers.toUtf8Bytes("erc-agent"));
    await expect(
      registry.connect(registrar).setERC8004Id(id, 42)
    ).to.emit(registry, "ERC8004IdSet").withArgs(id, 42);
  });

  it("Should reject setERC8004Id for non-existent agent", async function () {
    const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
    await expect(
      registry.connect(registrar).setERC8004Id(fakeId, 42)
    ).to.be.revertedWithCustomError(registry, "AgentNotFound");
  });

  it("Should reject unauthorized setERC8004Id", async function () {
    const id = ethers.keccak256(ethers.toUtf8Bytes("erc-agent"));
    await expect(
      registry.connect(nobody).setERC8004Id(id, 42)
    ).to.be.reverted;
  });
});
