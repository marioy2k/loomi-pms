import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {generateKeyPairSync, sign} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {licencePlans, licencePricing} from '../runtime/plans.mjs';

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
          const values = names.split(',').filter(name => !['Access','State','Booking','Room','Permission','Staff','Transaction'].includes(name.trim()));
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
    const issue = (plan, maxProperties = 2, term = 'monthly', addOns) => {
      const p = licencePlans[plan];
      const now = Date.now();
      const bytes = Buffer.from(JSON.stringify({product: 'Loomi PMS', installationId: db.setting('installationId'), company: 'Test', term, maxProperties, plan, maxRooms: p.maxRooms, pricing: addOns === undefined ? {currency: 'USD', monthlyUsd: p.monthlyUsd, yearlyUsd: p.yearlyUsd} : licencePricing(plan, addOns), ...(addOns === undefined ? {} : {licenceVersion: 2, addOns}), issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + (term === 'demo' ? 21 : 1) * 86400000).toISOString()}));
      return {payload: bytes.toString('base64url'), signature: sign(null, bytes, keys.privateKey).toString('base64url')};
    };
    assert.equal((await licenseAPI.GET()).status, 200); // Owner can renew without an active licence.
    const demo = issue('standard', 2, 'demo');
    assert.equal((await licenseAPI.POST(request('/api/license', demo))).status, 200);
    const demoStatus = (await (await licenseAPI.GET()).json()).license;
    assert.equal(demoStatus.term, 'demo');
    assert.equal(demoStatus.daysRemaining, 21);
    assert.equal((await licenseAPI.GET()).headers.get('cache-control'), 'private, no-store');
    assert.equal(Date.parse(demoStatus.expiresAt) - Date.parse(demoStatus.issuedAt), 21 * 86400000);
    assert.equal((await licenseAPI.POST(request('/api/license', demo))).status, 200);
    assert.equal((await (await licenseAPI.GET()).json()).license.expiresAt, demoStatus.expiresAt);
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
    const accountingAPI = await import('../app/api/accounting/route.ts');
    const accountingRequest = () => new Request('https://loomi.test/api/accounting?propertyId=1');
    assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel', 2, 'monthly', [])))).status, 200);
    assert.equal((await accountingAPI.GET(accountingRequest())).status, 403);
    assert.equal((await accountingAPI.POST(request('/api/accounting?propertyId=1', {}))).status, 403);
    const coreInfo = await (await pmsAPI.GET(new Request('https://loomi.test/api/pms'))).json();
    assert.deepEqual(coreInfo.addOns, []);
    const existingState = coreInfo.state;
    const withPayment = {...existingState, bookings: [{id:'ADDON-1',guest:'Test guest',email:'',phone:'',room:existingState.rooms[0].id,arrival:'2026-10-10',departure:'2026-10-12',status:'Confirmed',rate:100,paid:50,paymentMethod:'Cash',notes:''}]};
    assert.equal((await pmsAPI.POST(request('/api/pms', {state: withPayment, previous: JSON.stringify(existingState)}))).status, 200);
    assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel', 2, 'monthly', ['accounting'])))).status, 200);
    assert.equal((await accountingAPI.GET(accountingRequest())).status, 200);
    const ledgerBefore = JSON.stringify(db.db.prepare('SELECT * FROM transactions ORDER BY id').all());
    assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel', 2, 'monthly', [])))).status, 200);
    assert.equal((await accountingAPI.GET(accountingRequest())).status, 403);
    assert.equal(JSON.stringify(db.db.prepare('SELECT * FROM transactions ORDER BY id').all()), ledgerBefore);
    assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel')))).status, 200);
    // Coverage checks must include properties beyond the currently selected one.
    db.db.prepare('UPDATE property SET data=? WHERE id=1').run(JSON.stringify({hotel: 'First', currency: 'USD', rooms: [], bookings: []}));
    db.db.prepare('INSERT INTO property(id,data) VALUES (2,?)').run(JSON.stringify({hotel: 'Second', currency: 'USD', rooms: Array(11).fill({}), bookings: []}));
    assert.equal((await licenseAPI.POST(request('/api/license', issue('small')))).status, 400);
    assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel', 1)))).status, 400);
    const resetAPI = await import('../app/api/reset/route.ts');
    const {initializeLedger} = await import('../lib/ledger.ts');
    const oldState = {hotel: 'First', currency: 'SRD', rooms: [{id: '101', type: 'King', rate: 100, housekeeping: 'Clean'}], bookings: [{id: 'B1', guest: 'Private guest', room: '101', arrival: '2026-01-01', departure: '2026-01-02', rate: 100, paid: 50, paymentMethod: 'Cash', status: 'Confirmed', email: 'guest@example.com', phone: '123', notes: 'Private note', identification: {type: 'Passport', number: 'private', country: 'SR', expiry: ''}}]};
    db.db.prepare('UPDATE property SET data=? WHERE id=1').run(JSON.stringify(oldState));
    db.db.prepare('UPDATE property SET data=? WHERE id=2').run(JSON.stringify({...oldState, hotel: 'Second', currency: 'EUR'}));
    db.db.prepare('DELETE FROM ledger_meta').run();
    db.db.prepare('DELETE FROM transactions').run();
    await initializeLedger(db, oldState, 1);
    await initializeLedger(db, oldState, 2);
    db.db.prepare('INSERT INTO staff(email,name,role,permissions,active,property_ids) VALUES (?,?,?,?,?,?)').run('keep@example.com','Kept staff','employee','["rooms"]',1,'[1,2]');
    db.setPassword('keep@example.com', 'staff-password-123', 'Kept staff');
    db.login('owner@example.com', 'owner-password-123');
    const kept = () => JSON.stringify({settings: db.db.prepare('SELECT * FROM settings WHERE key != ? ORDER BY key').all('clock'), staff: db.db.prepare('SELECT * FROM staff ORDER BY email').all(), accounts: db.db.prepare('SELECT * FROM accounts ORDER BY email').all(), sessions: db.db.prepare('SELECT * FROM sessions ORDER BY email').all()});
    const beforeKept = kept();
    const beforeData = () => JSON.stringify({properties: db.db.prepare('SELECT * FROM property ORDER BY id').all(), transactions: db.db.prepare('SELECT * FROM transactions ORDER BY id').all()});
    const populated = beforeData();
    assert.equal((await resetAPI.POST(request('/api/reset', {confirmation: 'yes'}))).status, 400);
    assert.equal((await resetAPI.POST(new Request('https://loomi.test/api/reset', {method: 'POST', headers: {Origin: 'https://evil.test', 'Content-Type': 'application/json'}, body: JSON.stringify({confirmation: 'RESET ALL HOTEL DATA'})}))).status, 400);
    assert.equal(beforeData(), populated);
    db.db.exec("CREATE TRIGGER reject_reset BEFORE INSERT ON audit WHEN NEW.event='hotel-data-reset' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
    assert.equal((await resetAPI.POST(request('/api/reset', {confirmation: 'RESET ALL HOTEL DATA'}))).status, 400);
    assert.equal(beforeData(), populated);
    db.db.exec('DROP TRIGGER reject_reset');
    const resetResponse = await resetAPI.POST(request('/api/reset', {confirmation: 'RESET ALL HOTEL DATA'}));
    assert.equal(resetResponse.status, 200);
    assert.deepEqual((await resetResponse.json()).removed, {properties: 2, rooms: 2, reservations: 2, transactions: 2});
    assert.equal(kept(), beforeKept);
    for (const row of db.db.prepare('SELECT id,data FROM property ORDER BY id').all()) {
      assert.deepEqual(JSON.parse(row.data), {hotel: row.id === 1 ? 'First' : 'Second', currency: row.id === 1 ? 'SRD' : 'EUR', rooms: [], bookings: []});
    }
    assert.equal(db.db.prepare('SELECT count(*) AS n FROM transactions').get().n, 0);
    assert.equal(db.db.prepare("SELECT count(*) AS n FROM audit WHERE event='hotel-data-reset'").get().n, 1);
    await initializeLedger(db, oldState, 1);
    assert.equal(db.db.prepare('SELECT count(*) AS n FROM transactions').get().n, 0);
    assert.equal((await pmsAPI.POST(request('/api/pms', {state: oldState, previous: JSON.stringify(oldState)}))).status, 409);
    for (const role of ['admin', 'employee']) {
      user = {email: role + '@example.com', displayName: role};
      db.db.prepare('INSERT INTO staff(email,name,role,permissions,active,property_ids) VALUES (?,?,?,?,?,?)').run(user.email, role, role, '[]', 1, '[1]');
      assert.equal((await resetAPI.POST(request('/api/reset', {confirmation: 'RESET ALL HOTEL DATA'}))).status, 403);
      const deniedLicence = await licenseAPI.GET();
      assert.equal(deniedLicence.status, 403);
      const deniedBody = await deniedLicence.json();
      assert.deepEqual(Object.keys(deniedBody), ['error']);
      assert.equal(deniedBody.daysRemaining, undefined);
      assert.equal(deniedBody.expiresAt, undefined);
      const staffState = await (await pmsAPI.GET(new Request('https://loomi.test/api/pms'))).json();
      assert.equal(staffState.daysRemaining, undefined);
      assert.equal(staffState.license, undefined);
      assert.equal(staffState.expiresAt, undefined);
      assert.equal((await licenseAPI.POST(request('/api/license', issue('hotel')))).status, 403);
    }
    user = null;
    assert.equal((await resetAPI.POST(request('/api/reset', {confirmation: 'RESET ALL HOTEL DATA'}))).status, 403);
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
