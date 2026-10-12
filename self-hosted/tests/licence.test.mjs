import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyLicense} from '../runtime/core.mjs';
import {licencePlans, assertRoomLimit, assertLicenceCoverage} from '../runtime/plans.mjs';

test('signed plans enforce all boundaries and reject invalid or legacy licences', () => {
  const keys = generateKeyPairSync('ed25519');
  const pub = keys.publicKey.export({type: 'spki', format: 'pem'});
  const envelope = value => {
    const bytes = Buffer.from(JSON.stringify(value));
    return {payload: bytes.toString('base64url'), signature: sign(null, bytes, keys.privateKey).toString('base64url')};
  };
  for (const [plan, p] of Object.entries(licencePlans)) {
    const value = {product: 'Loomi PMS', installationId: 'test', company: 'Hotel', term: 'permanent', maxProperties: 2, plan, maxRooms: p.maxRooms, pricing: {currency: 'USD', monthlyUsd: p.monthlyUsd, yearlyUsd: p.yearlyUsd}, issuedAt: new Date().toISOString(), expiresAt: null};
    const licence = envelope(value), status = verifyLicense(licence, pub, 'test');
    assert.equal(status.valid, true);
    assert.equal(status.maxRooms, p.maxRooms);
    assert.deepEqual(status.pricing, value.pricing);
    assert.doesNotThrow(() => assertRoomLimit(status, []));
    assert.doesNotThrow(() => assertRoomLimit(status, Array(p.maxRooms).fill({housekeeping: 'Out of service'})));
    assert.throws(() => assertRoomLimit(status, Array(p.maxRooms + 1).fill({})), /rooms per property/);
    assert.doesNotThrow(() => assertLicenceCoverage(status, [{rooms: Array(p.maxRooms).fill({})}, {rooms: Array(p.maxRooms).fill({})}]));
    assert.throws(() => assertLicenceCoverage(status, [{rooms: []}, {rooms: []}, {rooms: []}]), /property count/);
    assert.throws(() => assertLicenceCoverage(status, [{rooms: []}, {rooms: Array(p.maxRooms + 1).fill({})}]), /rooms per property/);
    assert.equal(verifyLicense(envelope({...value, maxRooms: p.maxRooms + 1}), pub, 'test').valid, false);
    assert.equal(verifyLicense(envelope({...value, plan: 'unknown'}), pub, 'test').valid, false);
    assert.equal(verifyLicense(envelope({...value, pricing: {...value.pricing, monthlyUsd: -1}}), pub, 'test').valid, false);
    const changed = Buffer.from(JSON.stringify({...value, maxRooms: 500, pricing: {...value.pricing, monthlyUsd: 1}})).toString('base64url');
    assert.equal(verifyLicense({...licence, payload: changed}, pub, 'test').valid, false);
    const {plan: _, maxRooms: __, pricing: ___, ...legacy} = value;
    assert.match(verifyLicense(envelope(legacy), pub, 'test').error, /reissue/);
  }
});

test('issuer embeds the selected cap and USD prices for each term and plan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loomi-issuer-'));
  const keys = generateKeyPairSync('ed25519');
  const keyFile = join(dir, 'private.pem');
  writeFileSync(keyFile, keys.privateKey.export({type: 'pkcs8', format: 'pem'}), {mode: 0o600});
  try {
    for (const [plan, p] of Object.entries(licencePlans)) {
      for (const term of ['demo', 'monthly', 'yearly', 'permanent']) {
        const output = join(dir, `${plan}-${term}.json`);
        const issued = spawnSync(process.execPath, ['tools/licence.mjs', 'issue', keyFile, 'test', 'Hotel', term, '2', plan, output], {encoding: 'utf8'});
        assert.equal(issued.status, 0, issued.stderr);
        const status = verifyLicense(JSON.parse(readFileSync(output, 'utf8')), keys.publicKey.export({type: 'spki', format: 'pem'}), 'test');
        assert.equal(status.valid, true);
        if (term === 'demo') {
          const start = Date.parse(status.issuedAt), end = Date.parse(status.expiresAt);
          assert.equal(end - start, 21 * 86400000);
          const demo = JSON.parse(readFileSync(output, 'utf8'));
          assert.equal(verifyLicense(demo, keys.publicKey.export({type: 'spki', format: 'pem'}), 'test', end - 1).valid, true);
          assert.equal(verifyLicense(demo, keys.publicKey.export({type: 'spki', format: 'pem'}), 'test', end).valid, false);
          const changed = {...status, expiresAt: new Date(end + 86400000).toISOString()};
          delete changed.valid;
          const bytes = Buffer.from(JSON.stringify(changed));
          assert.equal(verifyLicense({payload: bytes.toString('base64url'), signature: sign(null, bytes, keys.privateKey).toString('base64url')}, keys.publicKey.export({type: 'spki', format: 'pem'}), 'test').valid, false);
        }
        assert.equal(status.plan, plan);
        assert.equal(status.maxRooms, p.maxRooms);
        assert.deepEqual(status.pricing, {currency: 'USD', monthlyUsd: p.monthlyUsd, yearlyUsd: p.yearlyUsd});
      }
    }
  } finally {rmSync(dir, {recursive: true, force: true});}
});
