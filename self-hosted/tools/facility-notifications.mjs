import {Store} from '../runtime/core.mjs';
import {facilityTick} from '../runtime/notifications.mjs';
import {join} from 'node:path';
const s=new Store(join(process.env.DATA_DIR||'data','loomi.sqlite'),'drizzle');
try{await facilityTick(s.db);console.log('Facility notification cycle complete')}finally{s.db.close()}
