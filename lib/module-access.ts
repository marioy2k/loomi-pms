import {database} from '@/db/raw';
import {allModules,ModuleEntitlements} from '@/lib/modules';
import {loadModuleSettings} from '@/lib/module-service';
export function moduleEntitlements():ModuleEntitlements{return {licensed:allModules,mode:'demo',company:'Loomi demonstration',term:'Demo',expiresAt:null,legacy:false};}
export async function moduleAccess(){const s=await loadModuleSettings(database(),moduleEntitlements());return {enabledModules:s.enabled,licensedModules:s.licensed,licenceSummary:{mode:s.mode,term:s.term,expiresAt:s.expiresAt}};}
