import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/db/raw';
import {Access,allPermissions} from '@/lib/permissions';
export const ownerEmail='rdoorson@live.nl';
export async function access():Promise<Access|null>{const user=await getChatGPTUser();if(!user)return null;const email=user.email.toLowerCase();if(email===ownerEmail)return {email,name:user.displayName,role:'owner',permissions:allPermissions,propertyIds:null};const row=await database().prepare('SELECT * FROM staff WHERE email=? AND active=1').bind(email).first<{email:string;name:string;role:'admin'|'employee';permissions:string;property_ids:string}>();if(!row)return null;return {...row,permissions:row.role==='admin'?allPermissions:JSON.parse(row.permissions),propertyIds:row.role==='admin'?null:JSON.parse(row.property_ids)};}
