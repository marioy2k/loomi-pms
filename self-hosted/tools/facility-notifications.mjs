import {advancedOperationsTick} from '../runtime/operations-hub.mjs';
import {Store} from '../runtime/core.mjs';
import {syncDiscordBridges} from '../runtime/discord-chat.mjs';
import {facilityTick} from '../runtime/notifications.mjs';
import {join} from 'node:path';
const s=new Store(join(process.env.DATA_DIR||'data','loomi.sqlite'),'drizzle');
try{advancedOperationsTick(s.db);const results=await Promise.allSettled([syncDiscordBridges(s.db),facilityTick(s.db)]);for(const result of results)if(result.status==='rejected')throw result.reason;console.log('Facility notification cycle complete')}finally{s.db.close()}
