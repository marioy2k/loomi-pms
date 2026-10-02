import {moduleAccess} from '@/lib/module-access';
import {store,requireLicence} from '@/runtime/core.mjs';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/db/raw';
import {Access,allPermissions} from '@/lib/permissions';
export const ownerEmail=()=>store().setting('ownerEmail');
export async function access():Promise<Access|null>{const user=await getChatGPTUser();if(!user)return null;requireLicence();const email=user.email.toLowerCase();const features=await moduleAccess();if(email===ownerEmail())return {...features,email,name:user.displayName,role:'owner',permissions:allPermissions,propertyIds:null};const row=await database().prepare('SELECT * FROM staff WHERE email=? AND active=1').bind(email).first();if(!row)return null;return {...row,...features,permissions:row.role==='admin'?allPermissions:JSON.parse(row.permissions),propertyIds:row.role==='admin'?null:JSON.parse(row.property_ids)};}
