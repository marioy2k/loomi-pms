import {Module,moduleEnabled} from '@/lib/modules';
export const permissionLabels={inventoryRequest:'Request inventory supplies',inventoryApprove:'Approve supply handovers and returns',inventoryManage:'Manage inventory items and stock receipts',dayPasses:'Sell swimming day passes',passCheck:'Check and redeem swimming vouchers',pos:'Use POS and take payments',posManage:'Manage POS products, refunds and daily closing',reservations:'Create and update reservations',payments:'Manage accounting, payments and booking rates',housekeeping:'Update housekeeping status',rooms:'Manage rooms and standard rates',property:'Edit hotel name and currency'};
export type Permission=keyof typeof permissionLabels;
export type Access={email:string;name:string;role:'owner'|'admin'|'employee';permissions:Permission[];propertyIds:number[]|null;enabledModules?:Module[];licensedModules?:Module[]};
export type Staff=Access&{active:boolean;password?:string};
export const allPermissions=Object.keys(permissionLabels) as Permission[];
const permissionModule:Partial<Record<Permission,Module>>={housekeeping:'housekeeping',pos:'pos',posManage:'pos',dayPasses:'swimming',passCheck:'swimming',inventoryRequest:'inventory',inventoryApprove:'inventory',inventoryManage:'inventory'};
export const can=(a:Access|null,p:Permission)=>!!a&&(!permissionModule[p]||moduleEnabled(a,permissionModule[p]!))&&(a.role!=='employee'||a.permissions.includes(p));

export const canAccessProperty=(a:Access|null,id:number)=>!!a&&(a.role!=='employee'||!!a.propertyIds?.includes(id));
