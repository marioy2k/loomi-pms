
'use client';
import {toast as baseToast} from 'sonner';
import {translateText} from '@/runtime/translations.mjs';
function message(value:Parameters<typeof baseToast>[0]){let locale='en';try{locale=localStorage.getItem('loomi-language')||'en'}catch{}return typeof value==='string'?translateText(value,locale):value}
export const toast={success:(value:Parameters<typeof baseToast.success>[0],options?:Parameters<typeof baseToast.success>[1])=>baseToast.success(message(value),options),error:(value:Parameters<typeof baseToast.error>[0],options?:Parameters<typeof baseToast.error>[1])=>baseToast.error(message(value),options),info:(value:Parameters<typeof baseToast.info>[0],options?:Parameters<typeof baseToast.info>[1])=>baseToast.info(message(value),options)};
