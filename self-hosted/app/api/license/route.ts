import {licenceDaysRemaining} from '@/runtime/licence-display.mjs';
import {readFileSync} from 'node:fs';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {checkOrigin, store, verifyLicense, licenceStatus} from '@/runtime/core.mjs';
import {assertLicenceCoverage, licencePlans} from '@/runtime/plans.mjs';

export async function GET() {
  const user = await getChatGPTUser();
  const db = store();
  if (!user || user.email !== db.setting('ownerEmail')) {
    return Response.json({error: 'Only the super admin can view licence details'}, {status: 403});
  }
  const properties = db.db.prepare("SELECT id, json_extract(data,'$.hotel') AS name, json_array_length(data,'$.rooms') AS rooms FROM property ORDER BY id").all();
  const license = licenceStatus();
  return Response.json({license: {...license, daysRemaining: licenceDaysRemaining(license)}, plans: licencePlans, properties}, {headers: {'Cache-Control': 'private, no-store'}});
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await getChatGPTUser();
    const db = store();
    if (!user || user.email !== db.setting('ownerEmail')) {
      return Response.json({error: 'Only the super admin can activate a licence'}, {status: 403});
    }
    const envelope = await req.json();
    const status = verifyLicense(envelope, readFileSync(process.env.LICENSE_PUBLIC_KEY_FILE || '/run/secrets/licence_public_key', 'utf8'), db.setting('installationId'));
    if (!status.valid) throw Error(status.error);
    const properties = db.db.prepare('SELECT data FROM property').all().map(row => JSON.parse(String(row.data)));
    assertLicenceCoverage(status, properties);
    db.setSetting('licence', JSON.stringify(envelope));
    db.audit('licence-activated', user.email, {term: status.term, plan: status.plan, maxRooms: status.maxRooms});
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: e instanceof Error ? e.message : 'Activation failed'}, {status: 400});
  }
}
