import {Module,LicenceSummary,moduleEnabled} from '@/lib/modules';
export const permissionLabels={maintenance:'Manage maintenance tasks and accommodation blocks',audit:'View activity history',dashboard:'View multi-property performance',inventoryRequest:'Request inventory supplies',inventoryApprove:'Approve supply handovers and returns',inventoryManage:'Manage inventory items and stock receipts',dayPasses:'Sell swimming day passes',passCheck:'Check and redeem swimming vouchers',pos:'Use POS and take payments',posManage:'Manage POS products, refunds and daily closing',reservations:'Create and update reservations',payments:'Manage accounting, payments and booking rates',housekeeping:'Update housekeeping status',rooms:'Manage rooms and standard rates',property:'Edit hotel name and currency'};
export type Permission=keyof typeof permissionLabels;
export type Access={email:string;name:string;role:'owner'|'superadmin'|'admin'|'employee';permissions:Permission[];propertyIds:number[]|null;enabledModules?:Module[];licensedModules?:Module[];licenceSummary?:LicenceSummary};
export type Staff=Access&{active:boolean};
export const allPermissions=Object.keys(permissionLabels) as Permission[];
const permissionModule:Partial<Record<Permission,Module>>={reservations:'reservations',payments:'payments',rooms:'rooms',property:'property',maintenance:'maintenance',audit:'audit',dashboard:'dashboard',housekeeping:'housekeeping',pos:'pos',posManage:'pos',dayPasses:'swimming',passCheck:'swimming',inventoryRequest:'inventory',inventoryApprove:'inventory',inventoryManage:'inventory'};
export const hasPermission=(a:Access|null,p:Permission)=>!!a&&(isSuperAdmin(a)||a.permissions.includes(p));
export const can=(a:Access|null,p:Permission)=>hasPermission(a,p)&&(!permissionModule[p]||moduleEnabled(a,permissionModule[p]!));

export const canAccessProperty=(a:Access|null,id:number)=>!!a&&(a.role!=='employee'||!!a.propertyIds?.includes(id));

export const permissionGroups: {label:string;permissions:Permission[]}[]=[
 {label:'Operations & reports',permissions:['maintenance','audit','dashboard']},
 {label:'Inventory',permissions:['inventoryRequest','inventoryApprove','inventoryManage']},
 {label:'Point of sale',permissions:['pos','posManage']},
 {label:'Accounting & booking payments',permissions:['payments']},
 {label:'Reservations',permissions:['reservations']},
 {label:'Housekeeping',permissions:['housekeeping']},
 {label:'Swimming day passes',permissions:['dayPasses','passCheck']},
 {label:'Property & rooms',permissions:['rooms','property']},
];

export const isSuperAdmin=(a:Access|null|undefined)=>!!a&&(a.role==='owner'||a.role==='superadmin');
