/**
 * ComplianceRegistry — score-private / proof-public + anti-replay harness.
 *
 * Verifies the Stellar->Compact ZK port (SHIP #2):
 *   (a) a valid attestation (score >= threshold) succeeds and writes the public audit trail;
 *   (b) score < threshold is rejected (no proof for a false statement);
 *   (c) a reused `context` is rejected at the ledger (anti-replay);
 *   (d) score > 100 is rejected (hygiene);
 *   (e) the score is NEVER on the ledger — there is no `attestation_scores` state at all.
 *
 * Run: npx tsx test/compliance-registry.zk.test.ts
 */
import * as assert from 'node:assert/strict';
import { createCircuitContext, dummyContractAddress } from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../build/ComplianceRegistry/contract/index.js';

function padTo32Bytes(str: string): Uint8Array {
  const buf = Buffer.alloc(32);
  Buffer.from(str, 'utf-8').copy(buf, 0, 0, Math.min(str.length, 32));
  return new Uint8Array(buf);
}

function setup() {
  const contract = new Contract({});
  const coinPublicKey = '0'.repeat(64) as unknown as string;
  const { currentContractState, currentPrivateState } = contract.initialState({
    initialZswapLocalState: { coinPublicKey },
    initialPrivateState: new Map(),
  });
  const ctx = createCircuitContext(
    dummyContractAddress(),
    coinPublicKey,
    currentContractState.data,
    currentPrivateState ?? new Map(),
  );
  return { contract, ctx };
}

const COMPANY = padTo32Bytes('acme-corp-001');
const DID = padTo32Bytes('did:midnight:agent:01');
const CID = padTo32Bytes('bafybeigdyrzt5sfp7udm7hu76');
const CTX_A = padTo32Bytes('ctx:acme||LGPD||nonce-0001');
const CTX_B = padTo32Bytes('ctx:acme||LGPD||nonce-0002');

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

console.log('ComplianceRegistry — score-private / proof-public + anti-replay');

// (a) valid attestation: score 85 >= threshold 70, fresh context
check('(a) valid attestation (score>=threshold) writes verdict+context, not the score', () => {
  const { contract, ctx } = setup();
  const { context } = contract.circuits.attestCompliance(ctx, COMPANY, DID, CID, 70n, CTX_A, 85n);
  const L = ledger(context.currentQueryContext.state);
  assert.equal(L.attestation_verdicts.lookup(COMPANY), 1n, 'verdict should be 1 (pass)');
  assert.equal(L.attestation_thresholds.lookup(COMPANY), 70n, 'public threshold should be sealed');
  assert.equal(L.used_contexts.member(CTX_A), true, 'context should be marked used');
  assert.equal(L.attestation_count, 1n, 'count should increment');
});

// (b) below threshold rejected
check('(b) score < threshold is rejected', () => {
  const { contract, ctx } = setup();
  assert.throws(
    () => contract.circuits.attestCompliance(ctx, COMPANY, DID, CID, 70n, CTX_A, 50n),
    /Score below threshold/,
  );
});

// (c) anti-replay: reusing the same context throws, even for a different company
check('(c) reused context is rejected (anti-replay)', () => {
  const { contract, ctx } = setup();
  const r1 = contract.circuits.attestCompliance(ctx, COMPANY, DID, CID, 70n, CTX_A, 90n);
  assert.throws(
    () => contract.circuits.attestCompliance(
      r1.context, padTo32Bytes('other-corp'), DID, CID, 60n, CTX_A, 95n,
    ),
    /Replay: context already used/,
  );
  // a fresh context still works on the same evolving state
  const r2 = contract.circuits.attestCompliance(
    r1.context, padTo32Bytes('other-corp'), DID, CID, 60n, CTX_B, 95n,
  );
  const L = ledger(r2.context.currentQueryContext.state);
  assert.equal(L.attestation_count, 2n, 'a fresh context should still seal');
});

// (d) score > 100 rejected
check('(d) score > 100 is rejected', () => {
  const { contract, ctx } = setup();
  assert.throws(
    () => contract.circuits.attestCompliance(ctx, COMPANY, DID, CID, 70n, CTX_A, 101n),
    /Invalid compliance score/,
  );
});

// (e) the score never reaches the ledger — there is no attestation_scores state
check('(e) no attestation_scores ledger exists (score never disclosed)', () => {
  const { contract, ctx } = setup();
  const { context } = contract.circuits.attestCompliance(ctx, COMPANY, DID, CID, 0n, CTX_A, 100n);
  const L = ledger(context.currentQueryContext.state) as Record<string, unknown>;
  assert.equal('attestation_scores' in L, false, 'attestation_scores must not exist');
  // sanity: the public audit-trail ledgers DO exist
  assert.equal('attestation_verdicts' in L, true);
  assert.equal('attestation_contexts' in L, true);
});

// (f) generic attestUseCase stores verdict by evidence_hash; getUseCaseVerdict reads it back
check('(f) attestUseCase stores verdict, getUseCaseVerdict reads it back', () => {
  const { contract, ctx } = setup();
  const ucid = padTo32Bytes('lgpd_compliance_v1');
  const evh = padTo32Bytes('evidence-hash-001');
  const mdh = padTo32Bytes('metadata-hash-001');
  const { context } = contract.circuits.attestUseCase(ctx, ucid, 1n, evh, mdh); // 1 = PASS
  const v = contract.circuits.getUseCaseVerdict(context, evh);
  assert.equal(v.result, 1n, 'verdict should read back as PASS(1)');
  const L = ledger(context.currentQueryContext.state);
  assert.equal(L.usecase_attestation_count, 1n, 'usecase attestation count should increment');
});

// (g) invalid verdict (>2) is rejected
check('(g) attestUseCase rejects verdict > 2', () => {
  const { contract, ctx } = setup();
  assert.throws(
    () => contract.circuits.attestUseCase(ctx, padTo32Bytes('x'), 3n, padTo32Bytes('e'), padTo32Bytes('m')),
    /Invalid verdict/,
  );
});

console.log(`\n${passed}/7 checks passed`);
if (process.exitCode === 1) {
  console.log('RESULT: FAIL');
} else {
  console.log('RESULT: PASS');
}
