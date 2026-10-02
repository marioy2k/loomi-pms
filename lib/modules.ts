export const moduleCatalog={housekeeping:{name:'Housekeeping',description:'Cleaning dashboard, room readiness and cleaning alerts.'},accounting:{name:'Accounting',description:'Expenses, categories, profit and loss, and financial reports.'},pos:{name:'Point of sale',description:'Bar and restaurant sales, room charges and daily closing.'},swimming:{name:'Swimming passes',description:'Pool day passes, vouchers, payments and admission.'},inventory:{name:'Inventory',description:'Supply stock, requests, supervisor approvals and returns.'},integrations:{name:'Integrations & AI',description:'n8n API tokens, approved actions and webhooks.'}} as const;
export type Module=keyof typeof moduleCatalog;
export const allModules=Object.keys(moduleCatalog) as Module[];
export type ModuleAccess={enabledModules?:Module[];licensedModules?:Module[]};
export function moduleEnabled(a:ModuleAccess|null|undefined,key:Module){return !!a&&(a.enabledModules===undefined||a.enabledModules.includes(key));}
export type ModuleSettings={licensed:Module[];enabled:Module[];version:number;mode:'demo'|'licensed';company:string;term:string;expiresAt:string|null;legacy:boolean};
export type ModuleEntitlements=Omit<ModuleSettings,'enabled'|'version'>;
