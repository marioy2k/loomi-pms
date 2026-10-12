import {test} from 'node:test';
import assert from 'node:assert/strict';
import {licenceDaysRemaining, activationDetails} from '../runtime/licence-display.mjs';

test('licence countdown rounds partial days up and handles expiry and permanent licences', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  const license = delta => ({valid: true, term: 'demo', expiresAt: new Date(now + delta).toISOString()});
  assert.equal(licenceDaysRemaining(license(21 * 86400000), now), 21);
  assert.equal(licenceDaysRemaining(license(86400000 + 1), now), 2);
  assert.equal(licenceDaysRemaining(license(1), now), 1);
  assert.equal(licenceDaysRemaining(license(0), now), 0);
  assert.equal(licenceDaysRemaining(license(-1), now), 0);
  assert.equal(licenceDaysRemaining({valid: true, term: 'permanent', expiresAt: null}, now), null);
  assert.equal(licenceDaysRemaining({valid: false, expiresAt: 'invalid'}, now), null);
});

test('activation page props never serialize licence dates or days to staff', () => {
  const privateLicense = {error: 'Licence expired', installationId: 'private-id', expiresAt: 'private-date', daysRemaining: 3, pricing: {monthlyUsd: 49}};
  assert.deepEqual(activationDetails(privateLicense, false), {});
  assert.deepEqual(activationDetails(privateLicense, true), {error: 'Licence expired', installationId: 'private-id'});
});
