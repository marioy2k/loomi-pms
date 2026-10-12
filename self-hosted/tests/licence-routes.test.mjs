import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {generateKeyPairSync, sign} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {licencePlans} from '../runtime/plans.mjs';

test('licence and room API handlers enforce owner privacy, caps and downgrade coverage', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loomi-licence-routes-'));
  const root = new URL('../', import.meta.url), authURL = new URL('app/chatgpt-auth.ts', root).href;
  let user = {email: 'owner@example.com', displayName: 'Owner'};
  // Substitute only Next's cookie-backed identity; all licence, access and database code is real.
  globalThis.__loomiLicenceTestUser = () => user;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('@/')) {
        let url = new URL(specifier.slice(2), root);
        if (!existsSync(fileURLToPath(url))) url = new URL(specifier.slice(2) + '.ts', root);
        return next(url.href, context);
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url === authURL) return {format: 'module', source: 'export async function getChatGPTUser(){return globalThis.__loomiLicenceTestUser()}', shortCircuit: true};
      if (url.endsWith('.ts')) {
        // Mirror TypeScript's removal of imports used only as types in these existing modules.
        const source = readFileSync(new URL(url), 'utf8').replace(/import \{([^}]+)\} from/g, (match, names) => {
          const values = names.split(',').filter(name => !['Access','State','Booking','Room','Permission','Staff'].includes(name.trim()));
          return values.length ? `import {${values.join(',')}} from` : 'import {} from';
        });
        return {format: 'module-typescript', source, shortCircuit: true};
      }
      return next(url, context);
    },
  });
  const originalEnv = {...process.env};
  let db;
  try {
    const keys = generateKeyPairSync('ed25519');
    writeFileSync(join(dir, 'password'), 'owner-password-123');
    writeFileSync(join(dir, 'public'), keys.publicKey.export({type: 'spki', format: 'pem'}));
    Object.assign(process.env, {DATA_DIR: dir, ADMIN_EMAIL: user.email, ADMIN_PASSWORD_FILE: join(dir, 'password'), LICENSE_PUBLIC_KEY_FILE: join(dir, 'public'), APP_URL: 'https://loomi.test'});
    const core = await import('../runtime/core.mjs');
    db = core.store();
    const licenseAPI = await import('../app/api/license/route.ts');
    const pmsAPI = await import('../app/api/pms/route.ts');
    const request = (path, body) => new Request('https://loomi.test' + path, {method: 'POST', headers: {Origin: 'https://loomi.test', 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const issue = (plan, maxProperties = 2) => {
      const p = licencePlans[plan];
      const bytes = Buffer.from(JSON.stringify({product: 'Loomi PMS', installationId: db.setting('installationId'), company: 'Test', term: 'monthly', maxProperties, plan, maxRooms: p.maxRooms, pricing: {currency: 'USD', monthlyUsd: p.monthlyUsd, yearlyUsd: p.yearlyUsd}, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString()}));
      return {payload: bytes.toString('base64url'), signature: sign(null, bytes, keys.privateKey).toString('base64url')};
    };
    assert.equal((await licenseAPI.GET()).status, 200); // Owner can renew without an active licence.
    for (const plan of Object.keys(licencePlans)) {
      const cap = licencePlans[plan].maxRooms;
      db.db.prepare('DELETE FROM property').run();
      db.db.prepare('INSERT INTO property(id,data) VALUES (1,?)').run(JSON.stringify({hotel: 'Test', currency: 'USD', rooms: [], bookings: []}));
      assert.equal((await licenseAPI.POST(request('/api/license', issue(plan)))).status, 200);
      const info = await (await licenseAPI.GET()).json();
      assert.equal(info.license.maxRooms, cap);
      assert.equal(info.license.pricing.monthlyUsd, licencePlans[plan].monthlyUsd);
      const state = {hotel: 'Test', currency: 'USD', rooms: Array.from({length: cap}, (_, i) => ({id: String(i + 1), type: 'Standard', rate: 100, housekeeping: 'Clean'})), bookings: []};
      const initial = await (await pmsAPI.GET(new Request('https://loomi.test/api/pms'))).json();
      assert.equal(initial.maxRooms, cap);
      assert.equal((await pmsAPI.POST(request('/api/pms', {state, previous: JSON.stringify(initial.state)}))).status, 200);
      const over = {...state, rooms: [...state.rooms, {id: 'extra', type: 'Standard', rate: 100, housekeeping: 'Out of service'}]};
      const rejected = await pmsAPI.POST(request('/api/pms', {state: over, previous: JSON.stringify(state)}));
      assert.equal(rejected.status, 400);
      assert.match((await rejected.json()).error, /rooms per property/);
      assert.equal(JSON.parse(db.db.prepare('SELECT data FROM property WHERE id=1').get().data).rooms.length, cap);
      if (plan !== 'small') {
        const previous = db.setting('licence');
        assert.equal((await licenseAPI.POST(request('/api/license', issue('small')))).status, 400);
        assert.equal(db.setting('licence'), previous);
      }
    }
    // Coverage checks must include properties beyond the currently selected one.
    db.db.prepare('UPDATE property SET data=? WHERE id=1').run(JSON.stringify({hotel: 'First', currency: 'USD', rooms: [], bookings: []}));
    db.db.prepare('INSERT INTO property(id,data) VALUES (2,?)').run(JSON.stringify({hotel: 'Second', currency: 'USD', rooms: Array(11).fill({}), bookings: []}));
    assert.equal((await licenseAPI.POST(request('/api/license', issue('small')))).status, 400);
    assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel', 1)))).status, 400);
    for (const role of ['admin', 'employee']) {
      user = {email: role + '@example.com', displayName: role};
      db.db.prepare('INSERT INTO staff(email,name,role,permissions,active,property_ids) VALUES (?,?,?,?,?,?)').run(user.email, role, role, '[]', 1, '[1]');
      assert.equal((await licenseAPI.GET()).status, 403);
      assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel')))).status, 403);
    }
    user = null;
    assert.equal((await licenseAPI.GET()).status, 403);
  } finally {
    hooks.deregister();
    delete globalThis.__loomiLicenceTestUser;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    db?.db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});
