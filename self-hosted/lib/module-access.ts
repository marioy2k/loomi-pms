import {database} from '@/db/raw';
import {requireLicence} from '@/runtime/core.mjs';
import {ModuleEntitlements} from '@/lib/modules';
import {loadModuleSettings} from '@/lib/module-service';
export function moduleEntitlements():ModuleEntitlements{const s=requireLicence();return {licensed:s.modules,mode:'licensed',company:s.company,term:s.term,expiresAt:s.expiresAt,legacy:s.legacyModules};}
export async function moduleAccess(){const s=await loadModuleSettings(database(),moduleEntitlements());return {enabledModules:s.enabled,licensedModules:s.licensed,licenceSummary:{mode:s.mode,term:s.term,expiresAt:s.expiresAt}};}
