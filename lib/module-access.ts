import {database} from '@/db/raw';
import {licenceEntitlements,readLicence} from '@/lib/licence';
import {loadModuleSettings} from '@/lib/module-service';
export async function moduleEntitlements(){const licence=await readLicence(database());return licenceEntitlements(licence.config,licence.version);}
export async function moduleAccess(){const s=await loadModuleSettings(database(),await moduleEntitlements());return {enabledModules:s.enabled,licensedModules:s.licensed,licenceSummary:{mode:s.mode,term:s.term,expiresAt:s.expiresAt,status:s.status,plan:s.plan,startsOn:s.startsOn}};}
