/**
 * Deploy DPO2U Midnight contracts to preprod (or standalone), midnight-js 4.x / ledger-v8.
 * Rewritten 2026-05-29 for the current Midnight generation (was midnight-js 3.2.0 / ledger-v7,
 * which silently stalled syncing the v8 preprod chain).
 *
 *   npx tsx scripts/deploy-preprod.ts --network preprod --all   # deploy all 5
 *   npx tsx scripts/deploy-preprod.ts --network preprod         # AgentRegistry only
 *   flags: --seed <hex> (default $MIDNIGHT_SEED) --faucet --join <addr>
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Buffer } from 'buffer';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore, PublicKey, UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

import * as AgentRegistry from '../build/AgentRegistry/contract/index.js';
import * as AgentWalletFactory from '../build/AgentWalletFactory/contract/index.js';
import * as ComplianceRegistry from '../build/ComplianceRegistry/contract/index.js';
import * as FeeDistributor from '../build/FeeDistributor/contract/index.js';
import * as PaymentGateway from '../build/PaymentGateway/contract/index.js';

// @ts-expect-error WebSocket polyfill required for wallet sync (graphql-ws) in Node
globalThis.WebSocket = WebSocket;

const ALL_CONTRACTS: Array<{ name: string; mod: any }> = [
  { name: 'AgentRegistry', mod: AgentRegistry },
  { name: 'AgentWalletFactory', mod: AgentWalletFactory },
  { name: 'ComplianceRegistry', mod: ComplianceRegistry },
  { name: 'FeeDistributor', mod: FeeDistributor },
  { name: 'PaymentGateway', mod: PaymentGateway },
];

type NetCfg = { indexer: string; indexerWS: string; node: string; proofServer: string; faucetUrl?: string };
const NETWORKS: Record<string, { networkId: string; cfg: NetCfg }> = {
  preprod: {
    networkId: 'preprod',
    cfg: {
      indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
      indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
      node: 'https://rpc.preprod.midnight.network',
      proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
      faucetUrl: 'https://faucet.preprod.midnight.network/api/request-tokens',
    },
  },
  standalone: {
    networkId: 'undeployed',
    cfg: {
      indexer: 'http://localhost:8088/api/v4/graphql',
      indexerWS: 'ws://localhost:8088/api/v4/graphql/ws',
      node: 'ws://localhost:9944',
      proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
    },
  },
};

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const buildPath = (name: string) => path.resolve(__dirname, '..', 'build', name);

// ── Keys + wallet (midnight-js 4.x) ────────────────────────────────────────
function deriveKeys(seed: string) {
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hd.hdWallet.selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hd.hdWallet.clear();
  return result.keys;
}

async function createWallet(cfg: NetCfg, seed: string) {
  const keys = deriveKeys(seed);
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

  // facade 3.0.0: private constructor → build via WalletFacade.init({...callbacks}), then start().
  const walletConfig = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: cfg.indexer, indexerWsUrl: cfg.indexerWS },
    provingServerUrl: new URL(cfg.proofServer),
    relayURL: new URL(cfg.node.replace(/^http/, 'ws')),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };

  const wallet = await WalletFacade.init({
    configuration: walletConfig as any,
    shielded: (c: any) => ShieldedWallet(c).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (c: any) => UnshieldedWallet(c).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (c: any) => DustWallet(c).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  // SKIP-SHIELDED: the shielded full-history sync OOMs on preprod (no checkpoint knob in any SDK
  // gen) and we don't need shielded coins to deploy (fees = DUST, balancing = unshielded NIGHT).
  // Capture coin/encryption public keys from the first emission, then STOP the shielded scan.
  const first: any = await Rx.firstValueFrom(wallet.state());
  const coinPublicKey = first.shielded.coinPublicKey.toHexString();
  const encryptionPublicKey = first.shielded.encryptionPublicKey.toHexString();
  await wallet.shielded.stop();
  console.log('  [shielded] captured coin pubkey + stopped scan (skip-shielded mode)');
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, coinPublicKey, encryptionPublicKey };
}

// Sign unshielded transaction intents (required by the 4.x unproven-tx workflow).
function signTransactionIntents(
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => any,
  proofMarker: 'proof' | 'pre-proof',
): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize('signature', proofMarker, 'pre-binding', intent.serialize());
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: any, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: any, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
}

async function waitForUnshielded(wallet: any) {
  console.log('[sync] waiting for unshielded funds (shielded skipped)...');
  const nt = ledger.unshieldedToken().raw;
  const sub = wallet.state().pipe(Rx.throttleTime(8_000)).subscribe((s: any) => {
    console.log(`  [${new Date().toISOString().slice(11, 19)}] unshielded:${s.unshielded?.balances?.[nt] ?? 0n} | dust:${s.dust?.availableCoins?.length ?? 0}`);
  });
  const state = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s: any) => (s.unshielded?.balances?.[nt] ?? 0n) > 0n)),
  );
  sub.unsubscribe();
  console.log('[sync] unshielded funds visible.');
  return state;
}

function makeWalletProvider(ctx: Awaited<ReturnType<typeof createWallet>>, state: any) {
  return {
    getCoinPublicKey: () => ctx.coinPublicKey,
    getEncryptionPublicKey: () => ctx.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => ctx.wallet.submitTransaction(tx) as any,
  };
}

function makeProviders(walletProvider: any, cfg: NetCfg, zkPath: string, storeName: string) {
  const zkConfigProvider = new NodeZkConfigProvider(zkPath);
  return {
    privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: storeName, walletProvider }),
    publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(cfg.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

async function deployOne(walletProvider: any, cfg: NetCfg, entry: { name: string; mod: any }) {
  const zkPath = buildPath(entry.name);
  const compiled = CompiledContract.make(entry.name, entry.mod.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(zkPath),
  );
  const providers = makeProviders(walletProvider, cfg, zkPath, `${entry.name}-state`);
  console.log(`\n[deploy] ${entry.name} — proving + submitting...`);
  const contract = await deployContract(providers as any, {
    compiledContract: compiled,
    privateStateId: `${entry.name}PrivateState`,
    initialPrivateState: {},
  });
  const d = contract.deployTxData.public;
  console.log(`  ${entry.name}: ${d.contractAddress} (block ${d.blockHeight}, tx ${d.txId})`);
  return { name: entry.name, contractAddress: d.contractAddress, blockHeight: d.blockHeight, txId: d.txId };
}

async function requestFaucet(url: string, address: string) {
  try {
    console.log('[faucet] requesting tNIGHT...');
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }),
    });
    console.log(res.ok ? '  faucet OK' : `  faucet ${res.status}: ${await res.text()}`);
  } catch (e) { console.log(`  faucet error: ${e}`); }
}

async function main() {
  const { values } = parseArgs({
    options: {
      seed: { type: 'string' },
      network: { type: 'string', default: process.env.MIDNIGHT_NETWORK ?? 'preprod' },
      join: { type: 'string' },
      faucet: { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
    },
  });
  const net = String(values.network);
  const entry = NETWORKS[net];
  if (!entry) { console.error(`Unknown network: ${net}`); process.exit(1); }
  setNetworkId(entry.networkId);
  const cfg = entry.cfg;

  console.log('='.repeat(64));
  console.log(`  DPO2U Midnight deploy — ${net} (networkId=${entry.networkId})`);
  console.log(`  indexer: ${cfg.indexer}`);
  console.log(`  proof:   ${cfg.proofServer}`);
  console.log('='.repeat(64));

  const seed = values.seed ?? process.env.MIDNIGHT_SEED ?? toHex(Buffer.from(generateRandomSeed()));
  const ctx = await createWallet(cfg, seed);
  const addr = ctx.unshieldedKeystore.getBech32Address();
  console.log(`  wallet: ${addr}`);

  if (values.faucet && cfg.faucetUrl) await requestFaucet(cfg.faucetUrl, addr);

  const state = await waitForUnshielded(ctx.wallet);
  const nt = ledger.unshieldedToken().raw;
  console.log(`  tNIGHT balance: ${state.unshielded?.balances?.[nt] ?? 0n}`);
  const walletProvider = makeWalletProvider(ctx, state);

  const contracts = values.all ? ALL_CONTRACTS : [ALL_CONTRACTS[0]];
  const results: any[] = [];
  for (const c of contracts) {
    try { results.push(await deployOne(walletProvider, cfg, c)); }
    catch (e: any) { console.error(`  ${c.name} FAILED: ${e?.message ?? e}`); results.push({ name: c.name, error: String(e?.message ?? e) }); }
  }

  const ok = results.filter((r) => r.contractAddress);
  console.log('\n' + '='.repeat(64));
  console.log(`  SUMMARY — ${ok.length}/${contracts.length} deployed on ${net}`);
  for (const r of results) console.log(r.contractAddress ? `  OK    ${r.name}: ${r.contractAddress}` : `  FAIL  ${r.name}: ${r.error}`);
  console.log('='.repeat(64));

  const outPath = path.resolve(__dirname, '..', `deployment-${net}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    network: net, networkId: entry.networkId, walletAddress: addr,
    deployedAt: new Date().toISOString(), contracts: results,
  }, null, 2));
  console.log(`  saved: ${outPath}`);

  try { await ctx.wallet.close?.(); } catch { /* ignore */ }
  process.exit(ok.length === contracts.length ? 0 : 2);
}

main().catch((err) => { console.error('\nDeploy failed:', err); process.exit(1); });
