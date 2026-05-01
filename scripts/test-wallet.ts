import 'dotenv/config';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as ledgerLib from '@midnight-ntwrk/ledger-v7';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Buffer } from 'buffer';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
// @ts-expect-error
globalThis.WebSocket = WebSocket;

async function main() {
  setNetworkId('undeployed');

  const seed = toHex(Buffer.from(generateRandomSeed()));
  console.log('Seed:', seed.substring(0, 16) + '...');

  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') throw new Error('Bad seed');
  const result = hd.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  const keys = result.keys;
  hd.hdWallet.clear();

  const shieldedSecretKeys = ledgerLib.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledgerLib.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], 'undeployed');
  console.log('Address:', unshieldedKeystore.getBech32Address());

  console.log('Calling WalletFacade.init()...');
  const wallet = await WalletFacade.init({
    configuration: {
      networkId: 'undeployed',
      indexerClientConnection: {
        indexerHttpUrl: 'http://127.0.0.1:8088/api/v3/graphql',
        indexerWsUrl: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
      },
      provingServerUrl: new URL('http://127.0.0.1:6300'),
      relayURL: new URL('ws://127.0.0.1:9944'),
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
    },
    shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: any) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg: any) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledgerLib.LedgerParameters.initialParameters().dust),
  });
  console.log('Wallet init success!');

  // Monitor state every 3 seconds for 30 seconds
  let count = 0;
  const sub = wallet.state().pipe(Rx.throttleTime(3000)).subscribe((state: any) => {
    count++;
    console.log(`[${new Date().toISOString().slice(11,19)}] #${count} isSynced=${state.isSynced}`);
    console.log(`  shielded: ${JSON.stringify(state.shielded ? { synced: state.shielded.isSynced ?? 'N/A', coins: state.shielded.availableCoins?.length ?? 0 } : 'null')}`);
    console.log(`  unshielded: ${JSON.stringify(state.unshielded ? { synced: state.unshielded.isSynced ?? 'N/A', balances: state.unshielded.balances ?? {} } : 'null')}`);
    console.log(`  dust: ${JSON.stringify(state.dust ? { synced: state.dust.isSynced ?? 'N/A', coins: state.dust.availableCoins?.length ?? 0 } : 'null')}`);
    if (state.isSynced || count >= 10) {
      sub.unsubscribe();
      console.log('\nDone monitoring.');
      wallet.stop().then(() => process.exit(0));
    }
  });

  // Timeout after 45 seconds
  setTimeout(() => {
    console.log('Timeout reached.');
    sub.unsubscribe();
    wallet.stop().then(() => process.exit(1));
  }, 45000);
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
