import {getChatGPTUser} from '@/app/chatgpt-auth';
import {checkOrigin, store, requireLicence} from '@/runtime/core.mjs';

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await getChatGPTUser();
    const db = store();
    if (!user || user.email !== db.setting('ownerEmail')) {
      return Response.json({error: 'Only the super admin can reset hotel data'}, {status: 403});
    }
    requireLicence();
    const body = await req.json();
    if (body?.confirmation !== 'RESET ALL HOTEL DATA') {
      return Response.json({error: 'Type RESET ALL HOTEL DATA to confirm'}, {status: 400});
    }
    db.db.exec('BEGIN IMMEDIATE');
    try {
      const properties = db.db.prepare('SELECT id, data FROM property').all();
      const removed = {properties: properties.length, rooms: 0, reservations: 0,
        transactions: Number(db.db.prepare('SELECT count(*) AS n FROM transactions').get().n)};
      for (const property of properties) {
        const state = JSON.parse(String(property.data));
        removed.rooms += state.rooms.length;
        removed.reservations += state.bookings.length;
        db.db.prepare('UPDATE property SET data=? WHERE id=?').run(
          JSON.stringify({hotel: state.hotel, currency: state.currency, rooms: [], bookings: []}), property.id);
        // Keep the opening-ledger marker: a request holding pre-reset records must not re-import balances.
        db.db.prepare('INSERT OR IGNORE INTO ledger_meta(id) VALUES (?)').run(property.id);
      }
      db.db.prepare('DELETE FROM transactions').run();
      db.audit('hotel-data-reset', user.email, removed);
      db.db.exec('COMMIT');
      return Response.json({ok: true, removed});
    } catch (e) {
      db.db.exec('ROLLBACK');
      throw e;
    }
  } catch (e) {
    return Response.json({error: e instanceof Error ? e.message : 'Unable to reset hotel data'}, {status: 400});
  }
}
