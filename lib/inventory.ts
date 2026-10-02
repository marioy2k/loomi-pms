import {Access,can} from '@/lib/permissions';
export const inventoryCategories=['Linens','Cleaning supplies','Amenities','Other'] as const;
export const canManageInventory=(a:Access)=>can(a,'inventoryManage');
export const canApproveInventory=(a:Access)=>can(a,'inventoryApprove');
export const canRequestInventory=(a:Access)=>can(a,'inventoryRequest')||can(a,'housekeeping')||canManageInventory(a)||canApproveInventory(a);
export const canViewInventory=canRequestInventory;
export type InventoryItem={id:string;property_id:number;name:string;category:string;unit:string;stock:number;minimum:number;active:number;version:number};
export type InventoryRequest={id:string;property_id:number;item_id:string;item_name:string;unit:string;quantity:number;returned:number;purpose:string;requester:string;requester_name:string;created:string;status:string;approver:string;approver_name:string;decided_at:string;decision_note:string;decision_id:string};
export type InventoryMovement={id:string;property_id:number;item_id:string;item_name:string;unit:string;kind:string;quantity:number;created:string;actor:string;actor_name:string;recipient:string;recipient_name:string;request_id:string;note:string};
export type InventoryData={items:InventoryItem[];requests:InventoryRequest[];movements:InventoryMovement[];recipients:{email:string;name:string}[]};
export function inventoryTime(value:string){return new Date(value).toLocaleString('en-US',{timeZone:'America/Paramaribo',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
