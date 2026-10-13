import {access} from '@/lib/access';
import {isSuperAdmin} from '@/lib/permissions';
import {moduleEnabled} from '@/lib/modules';
import {readBackupStatus} from '@/runtime/backup-status.mjs';
export async function GET(){
 const user=await access();
 if(!user||!isSuperAdmin(user)||!moduleEnabled(user,'backups'))return Response.json({error:'Super Admin access required'},{status:403,headers:{'Cache-Control':'no-store'}});
 return Response.json(await readBackupStatus(process.env.BACKUP_STATUS_FILE||'/run/loomi-backups/status.json'),{headers:{'Cache-Control':'no-store'}});
}
