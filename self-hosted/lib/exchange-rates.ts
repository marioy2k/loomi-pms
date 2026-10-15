import type {Database} from '@/db/raw';
import {exchangeRateFor} from '@/runtime/exchange-rates.mjs';
import {day} from '@/lib/pms';
export type ExchangeRate={id:number;created:string;effective_from:string;data:string;actor:string};
export async function readExchangeRates(db:Database){const history=(await db.prepare('SELECT * FROM exchange_rates ORDER BY effective_from DESC,id DESC').all<ExchangeRate>()).results;return {history,version:Math.max(0,...history.map(r=>r.id)),current:exchangeRateFor(history,day()) as ExchangeRate|null};}
