'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {bindChatViewport} from '@/runtime/chat-viewport.mjs';
type Viewport={isMobile:boolean;height:number;top:number};
export function useChatViewport(open:boolean){
 const [viewport,setViewport]=useState<Viewport|null>(null);
 useEffect(()=>{if(!open){setViewport(null);return}return bindChatViewport({onChange:(next:Viewport)=>setViewport(old=>old?.isMobile===next.isMobile&&old?.height===next.height&&old?.top===next.top?old:next)})},[open]);
 return {isMobile:!!viewport?.isMobile,style:(viewport?.isMobile?{'--chat-viewport-height':viewport.height+'px','--chat-viewport-top':viewport.top+'px'}:{}) as CSSProperties};
}
