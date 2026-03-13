import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);
const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY || "0x" + "0".repeat(64);
const COMPLIANCE_KEY = process.env.COMPLIANCE_PRIVATE_KEY || "0x" + "0".repeat(64);
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        enabled: false,
      },
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: [DEPLOYER_KEY, OPERATOR_KEY, COMPLIANCE_KEY],
      chainId: 84532,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: [DEPLOYER_KEY, OPERATOR_KEY, COMPLIANCE_KEY],
      chainId: 8453,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: BASESCAN_API_KEY,
      base: BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts/solidity",
    tests: "./test/solidity",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
