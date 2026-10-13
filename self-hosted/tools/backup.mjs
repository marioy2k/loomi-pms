import {Store} from '../runtime/core.mjs';import {join} from 'node:path';
const [output]=process.argv.slice(2);if(!output)throw Error('Specify an output SQLite filename');const db=new Store(join(process.env.DATA_DIR||'data','loomi.sqlite'),'drizzle');await db.backup(output);db.db.close();console.log('Backup saved: '+output);

