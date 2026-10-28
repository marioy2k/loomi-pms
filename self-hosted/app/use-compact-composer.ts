'use client';
import {useLayoutEffect,type RefObject} from 'react';
export function useCompactComposer(ref:RefObject<HTMLTextAreaElement|null>,value:string){
 useLayoutEffect(()=>{
  const input=ref.current;if(!input)return;
  const media=window.matchMedia('(max-width: 767px)');
  let width=-1;
  const fit=()=>{
   if(!media.matches){input.style.removeProperty('height');input.style.removeProperty('overflow-y');return}
   if(!input.getClientRects().length)return;
   input.style.height='0px';
   const style=getComputedStyle(input),border=parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
   const needed=input.scrollHeight+border;
   input.style.height=Math.min(104,Math.max(40,needed))+'px';
   input.style.overflowY=needed>104?'auto':'hidden';
  };
  const observer=new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next!==width){width=next;fit()}});
  observer.observe(input);media.addEventListener('change',fit);fit();
  return()=>{observer.disconnect();media.removeEventListener('change',fit)};
 },[ref,value]);
}
