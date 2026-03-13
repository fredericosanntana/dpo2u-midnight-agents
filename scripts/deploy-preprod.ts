/**
 * deploy-preprod.ts — Deploy AgentRegistry to Midnight Network
 *
 * Usage:
 *   npx tsx scripts/deploy-preprod.ts [--network preprod|preview|standalone] [--seed <hex>] [--join <addr>] [--faucet] [--register-demo]
 *
 * Prerequisites:
 *   1. Proof server running locally on port 6300
 *   2. npm install
 *   3. compact compile compact/AgentRegistry.compact build/AgentRegistry
 */

import 'dotenv/config';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import {
  type MidnightProvider,
  type WalletProvider,
  type MidnightProviders,
} from '@midnight-ntwrk/midnight-js-types';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { CompiledContract, type ImpureCircuitId } from '@midnight-ntwrk/compact-js';

import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as ledgerLib from '@midnight-ntwrk/ledger-v7';

import * as AgentRegistry from '../build/AgentRegistry/contract/index.js';

import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';
import path from 'node:path';
import { parseArgs } from 'node:util';

// WebSocket polyfill for Node.js (required by GraphQL subscriptions)
// @ts-expect-error: needed for graphql-ws in Node
globalThis.WebSocket = WebSocket;

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type PrivateState = Record<string, never>;
type AgentRegistryContract = AgentRegistry.Contract<PrivateState>;
type CircuitIds = ImpureCircuitId<AgentRegistryContract>;

const PRIVATE_STATE_ID = 'agentRegistryPrivateState' as const;

type Providers = MidnightProviders<CircuitIds, typeof PRIVATE_STATE_ID, PrivateState>;

// ------------------------------------------------------------------
// Network Config
// ------------------------------------------------------------------
interface NetworkConfig {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  networkId: string;
  faucetUrl?: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  preprod: {
    indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
    networkId: 'preprod',
    faucetUrl: 'https://faucet.preprod.midnight.network/api/request-tokens',
  },
  preview: {
    indexer: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
    proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
    networkId: 'preview',
    faucetUrl: 'https://faucet.preview.midnight.network/api/request-tokens',
  },
  standalone: {
    indexer: 'http://127.0.0.1:8088/api/v3/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
    node: 'http://127.0.0.1:9944',
    proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
    networkId: 'undeployed',
  },
};

// ------------------------------------------------------------------
// ZK Assets Path
// ------------------------------------------------------------------
const ZK_CONFIG_PATH = path.resolve(
  new URL(import.meta.url).pathname,
  '..', '..', 'build', 'AgentRegistry',
);

// ------------------------------------------------------------------
// Compiled Contract
// ------------------------------------------------------------------
const compiledContract = CompiledContract.make(
  'AgentRegistry',
  AgentRegistry.Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
);

// ------------------------------------------------------------------
// HD Key Derivation
// ------------------------------------------------------------------
function deriveKeys(seed: string) {
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') throw new Error('Bad HD seed');

  const result = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hd.hdWallet.clear();
  return result.keys;
}

// ------------------------------------------------------------------
// Build Wallet via WalletFacade.init()
// ------------------------------------------------------------------
async function buildWallet(config: NetworkConfig, seed: string) {
  console.log('[1/6] Deriving HD keys from seed...');
  const keys = deriveKeys(seed);
  const shieldedSecretKeys = ledgerLib.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledgerLib.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], config.networkId);

  const walletConfig = {
    networkId: config.networkId,
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node.replace(/^http/, 'ws')),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  console.log('[2/6] Initializing WalletFacade...');
  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: any) => UnshieldedWallet(cfg).startWithPublicKey(
      PublicKey.fromKeyStore(unshieldedKeystore),
    ),
    dust: (cfg: any) => DustWallet(cfg).startWithSecretKey(
      dustSecretKey,
      ledgerLib.LedgerParameters.initialParameters().dust,
    ),
  });

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, seed };
}

// ------------------------------------------------------------------
// Wait for sync
// ------------------------------------------------------------------
async function waitForSync(wallet: WalletFacade) {
  console.log('[3/6] Syncing wallet with network...');
  await wallet.waitForSyncedState();
  console.log('  Wallet synced.');
}

// ------------------------------------------------------------------
// Check balance
// ------------------------------------------------------------------
async function checkBalance(wallet: WalletFacade): Promise<bigint> {
  const state = await wallet.waitForSyncedState();
  // unshielded balances keyed by token type
  const nativeToken = ledgerLib.unshieldedToken().raw;
  const balance = state.unshielded.balances[nativeToken] ?? 0n;

  if (balance > 0n) {
    console.log(`  tNIGHT balance: ${balance.toLocaleString()}`);
    return balance;
  }

  console.log('  No tNIGHT balance detected.');
  console.log('  Fund your wallet at: https://faucet.preprod.midnight.network/');
  console.log('  Waiting for incoming tokens...');

  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((s) => s.isSynced),
      Rx.map((s) => s.unshielded.balances[nativeToken] ?? 0n),
      Rx.filter((b) => b > 0n),
    ),
  );
}

// ------------------------------------------------------------------
// Create WalletProvider + MidnightProvider for midnight-js
// ------------------------------------------------------------------
async function createProviderBridge(ctx: Awaited<ReturnType<typeof buildWallet>>): Promise<WalletProvider & MidnightProvider> {
  const state = await ctx.wallet.waitForSyncedState();
  return {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx: any) {
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
}

// ------------------------------------------------------------------
// Configure providers
// ------------------------------------------------------------------
async function configureProviders(ctx: Awaited<ReturnType<typeof buildWallet>>, config: NetworkConfig): Promise<Providers> {
  const bridge = await createProviderBridge(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<CircuitIds>(ZK_CONFIG_PATH);

  return {
    privateStateProvider: levelPrivateStateProvider<typeof PRIVATE_STATE_ID>({
      privateStateStoreName: 'agent-registry-private-state',
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer),
    walletProvider: bridge,
    midnightProvider: bridge,
  };
}

// ------------------------------------------------------------------
// Deploy
// ------------------------------------------------------------------
async function deploy(providers: Providers) {
  console.log('[5/6] Deploying AgentRegistry...');
  console.log('  Generating ZK proof + submitting deploy tx (may take minutes)...\n');

  const contract = await deployContract(providers, {
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {} as PrivateState,
  });

  const addr = contract.deployTxData.public.contractAddress;
  console.log(`  Deployed!`);
  console.log(`  Address: ${addr}`);
  console.log(`  Block:   ${contract.deployTxData.public.blockHeight}`);
  console.log(`  Tx ID:   ${contract.deployTxData.public.txId}`);
  return contract;
}

// ------------------------------------------------------------------
// Join existing
// ------------------------------------------------------------------
async function join(providers: Providers, contractAddress: string) {
  console.log(`[5/6] Joining AgentRegistry at ${contractAddress}...`);
  const contract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {} as PrivateState,
  });
  console.log(`  Joined at: ${contract.deployTxData.public.contractAddress}`);
  return contract;
}

// ------------------------------------------------------------------
// Demo interaction
// ------------------------------------------------------------------
async function runDemo(contract: any) {
  console.log('\n--- Demo: Register Agent ---');
  const did = new Uint8Array(32);
  did[0] = 0x01;
  const role = new TextEncoder().encode('agent-factory'.padEnd(32, '\0'));

  console.log('Calling registerAgent...');
  const regResult = await contract.callTx.registerAgent(did, role);
  console.log(`  Tx: ${regResult.public.txId} (block ${regResult.public.blockHeight})`);

  console.log('Calling getAgentCount...');
  const countResult = await contract.callTx.getAgentCount();
  console.log(`  Agent count: ${countResult.data}`);

  console.log('Calling isActive...');
  const activeResult = await contract.callTx.isActive(did);
  console.log(`  Active: ${activeResult.data}`);
}

// ------------------------------------------------------------------
// Faucet
// ------------------------------------------------------------------
async function requestFaucet(url: string, address: string) {
  try {
    console.log(`  Requesting tNIGHT from faucet...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    console.log(res.ok ? '  Faucet OK.' : `  Faucet ${res.status}: ${await res.text()}`);
  } catch (e) {
    console.log(`  Faucet error: ${e}`);
  }
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  const { values } = parseArgs({
    options: {
      seed: { type: 'string' },
      join: { type: 'string' },
      network: { type: 'string', default: process.env.MIDNIGHT_NETWORK ?? 'preprod' },
      'register-demo': { type: 'boolean', default: false },
      faucet: { type: 'boolean', default: false },
    },
  });

  const net = values.network ?? 'preprod';
  const config = NETWORKS[net];
  if (!config) { console.error(`Unknown network: ${net}`); process.exit(1); }

  console.log('='.repeat(60));
  console.log(`  DPO2U AgentRegistry — Midnight ${net.toUpperCase()}`);
  console.log('='.repeat(60));
  console.log(`  Indexer:      ${config.indexer}`);
  console.log(`  Proof Server: ${config.proofServer}`);
  console.log(`  ZK Assets:    ${ZK_CONFIG_PATH}`);
  console.log('');

  setNetworkId(config.networkId);

  const seed = values.seed ?? process.env.MIDNIGHT_SEED ?? toHex(Buffer.from(generateRandomSeed()));
  console.log(`  Seed: ${seed}`);
  console.log('  (Save this seed to restore your wallet)\n');

  const ctx = await buildWallet(config, seed);
  const addr = ctx.unshieldedKeystore.getBech32Address();
  console.log(`  Address: ${addr}\n`);

  await waitForSync(ctx.wallet);

  if (values.faucet && config.faucetUrl) {
    await requestFaucet(config.faucetUrl, addr);
  }

  console.log('[4/6] Checking balance...');
  await checkBalance(ctx.wallet);

  const providers = await configureProviders(ctx, config);

  let contract;
  if (values.join) {
    contract = await join(providers, values.join);
  } else {
    contract = await deploy(providers);
  }

  if (values['register-demo']) {
    await runDemo(contract);
  }

  // Save deployment info
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Network:  ${net}`);
  console.log(`  Contract: ${contract.deployTxData.public.contractAddress}`);
  console.log(`  Seed:     ${seed}`);
  console.log(`  Address:  ${addr}`);
  console.log('='.repeat(60));

  const fs = await import('node:fs');
  const info = {
    network: net,
    contractAddress: contract.deployTxData.public.contractAddress,
    blockHeight: contract.deployTxData.public.blockHeight,
    txId: contract.deployTxData.public.txId,
    walletAddress: addr,
    timestamp: new Date().toISOString(),
  };
  const deployPath = path.resolve(new URL(import.meta.url).pathname, '..', '..', `deployment-${net}.json`);
  fs.writeFileSync(deployPath, JSON.stringify(info, null, 2));
  console.log(`\n  Saved to: ${deployPath}`);

  await ctx.wallet.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nDeploy failed:', err);
  process.exit(1);
});
