export const permissionLabels={reservations:'Create and update reservations',payments:'Manage accounting, payments and booking rates',housekeeping:'Update housekeeping status',rooms:'Manage rooms and standard rates',property:'Edit hotel name and currency'};
export type Permission=keyof typeof permissionLabels;
export type Access={email:string;name:string;role:'owner'|'admin'|'employee';permissions:Permission[];propertyIds:number[]|null};
export type Staff=Access&{active:boolean;password?:string};
export const allPermissions=Object.keys(permissionLabels) as Permission[];
export const can=(a:Access|null,p:Permission)=>!!a&&(a.role!=='employee'||a.permissions.includes(p));

export const canAccessProperty=(a:Access|null,id:number)=>!!a&&(a.role!=='employee'||!!a.propertyIds?.includes(id));
