import {store} from '@/runtime/core.mjs';
export type Statement={bind:(...args:unknown[])=>Statement;first:<T=any>()=>Promise<T|null>;all:<T=any>()=>Promise<{results:T[]}>;run:()=>Promise<any>};
export type Database={prepare:(sql:string)=>Statement;batch:(statements:any[])=>Promise<any[]>};
export function database():Database{return store() as unknown as Database}
