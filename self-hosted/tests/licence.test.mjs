import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyLicense} from '../runtime/core.mjs';
import {licencePlans, assertRoomLimit, assertLicenceCoverage, licencePricing, licenceAddOns, enabledAddOns, hasAddOn} from '../runtime/plans.mjs';

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
        assert.deepEqual(status.pricing, licencePricing(plan, term === 'demo' ? Object.keys(licenceAddOns) : []));
        assert.deepEqual(enabledAddOns(status), term === 'demo' ? Object.keys(licenceAddOns) : []);
      }
    }
  } finally {rmSync(dir, {recursive: true, force: true});}
});

test('add-ons are signed, validated, priced together and preserve existing licences', () => {
  const keys = generateKeyPairSync('ed25519');
  const pub = keys.publicKey.export({type: 'spki', format: 'pem'});
  const envelope = value => {const bytes = Buffer.from(JSON.stringify(value)); return {payload: bytes.toString('base64url'), signature: sign(null, bytes, keys.privateKey).toString('base64url')};};
  const value = {product: 'Loomi PMS', licenceVersion: 2, installationId: 'test', company: 'Hotel', term: 'permanent', maxProperties: 1, plan: 'small', maxRooms: 10, addOns: ['accounting'], pricing: licencePricing('small', ['accounting']), issuedAt: new Date().toISOString(), expiresAt: null};
  assert.deepEqual(value.pricing, {currency: 'USD', monthlyUsd: 69, yearlyUsd: 690});
  const status = verifyLicense(envelope(value), pub, 'test');
  assert.equal(status.valid, true);
  assert.equal(hasAddOn(status, 'accounting'), true);
  assert.equal(hasAddOn(status, 'pos'), false);
  const core = verifyLicense(envelope({...value, addOns: [], pricing: licencePricing('small')}), pub, 'test');
  assert.equal(core.valid, true);
  assert.equal(hasAddOn(core, 'accounting'), false);
  for (const change of [{addOns: ['unknown']}, {addOns: ['accounting', 'accounting']}, {addOns: 'accounting'}, {addOns: []}, {licenceVersion: 3}, {licenceVersion: undefined}, {pricing: {...value.pricing, monthlyUsd: 49}}, {addOns: ['pos'], pricing: licencePricing('small', ['pos'])}]) {
    assert.equal(verifyLicense(envelope({...value, ...change}), pub, 'test').valid, false);
  }
  const {licenceVersion, addOns, ...legacy} = value;
  assert.equal(hasAddOn(verifyLicense(envelope({...legacy, pricing: licencePricing('small')}), pub, 'test'), 'accounting'), true);
  assert.deepEqual(enabledAddOns({valid: false, term: 'demo'}), []);
  assert.deepEqual(licencePricing('small', Object.keys(licenceAddOns)), {currency: 'USD', monthlyUsd: 129, yearlyUsd: 1290});
});

test('issuer selects Accounting and refuses unavailable or duplicate paid add-ons', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loomi-addons-'));
  const keys = generateKeyPairSync('ed25519');
  const keyFile = join(dir, 'private.pem');
  writeFileSync(keyFile, keys.privateKey.export({type: 'pkcs8', format: 'pem'}), {mode: 0o600});
  try {
    for (const selection of ['accounting', 'none', 'pos', 'swimming', 'operations', 'accounting,accounting', 'unknown']) {
      const output = join(dir, selection + '.json');
      const result = spawnSync(process.execPath, ['tools/licence.mjs', 'issue', keyFile, 'test', 'Hotel', 'monthly', '2', 'small', output, selection], {encoding: 'utf8'});
      assert.equal(result.status === 0, ['accounting', 'none'].includes(selection), result.stderr);
      if (result.status === 0) {
        const status = verifyLicense(JSON.parse(readFileSync(output, 'utf8')), keys.publicKey.export({type: 'spki', format: 'pem'}), 'test');
        assert.equal(status.valid, true);
        assert.equal(hasAddOn(status, 'accounting'), selection === 'accounting');
        assert.match(result.stdout, new RegExp('Subscription total: USD \\$' + (selection === 'accounting' ? 138 : 98)));
      }
    }
  } finally {rmSync(dir, {recursive: true, force: true});}
});
