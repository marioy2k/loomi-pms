'use client';
import {LocalizedText,LangInput,LangTextarea,LangButton,LangSelectValue} from '@/app/language';

import {useEffect,useState,type ComponentType} from 'react';
import {GripVertical} from 'lucide-react';
import {SidebarMenu,SidebarMenuItem,SidebarMenuButton,useSidebar} from '@/components/ui/sidebar';
type Item=readonly [string,ComponentType<{size?:number}>];
export default function FlexibleMenu({items,allNames,email,view,wholeHouse,onSelect}:{items:readonly Item[];allNames:string[];email:string;view:string;wholeHouse:boolean;onSelect:(name:string)=>void}){
 const {isMobile,setOpenMobile}=useSidebar();
 const [order,setOrder]=useState<string[]>(allNames),[editing,setEditing]=useState(false),[dragged,setDragged]=useState<string|null>(null),[storageError,setStorageError]=useState(false);
 const key='loomi:menu-order:'+email.toLowerCase();
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved)){const valid=saved.filter((n:unknown):n is string=>typeof n==='string'&&allNames.includes(n));setOrder([...new Set([...valid,...allNames])]);}}catch{setStorageError(true)}},[key]);
 const ordered=[...items].sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));
 const save=(next:string[])=>{setOrder(next);try{localStorage.setItem(key,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const move=(name:string,target:string)=>{if(name===target)return;const next=[...order];const from=next.indexOf(name),to=next.indexOf(target);if(from<0||to<0)return;next.splice(from,1);next.splice(to,0,name);save(next)};
 const label=(name:string)=>name==='Room calendar'&&wholeHouse?'House calendar':name;
 return <><div className="menu-arrange-bar"><LangButton className="menu-arrange-toggle" aria-pressed={editing} onClick={()=>setEditing(!editing)}><GripVertical size={14}/>{editing?<LocalizedText text={"Done reordering"}/>:<LocalizedText text={"Reorder menu"}/>}</LangButton>{editing&&<LangButton className="menu-reset" onClick={()=>save(allNames)}><LocalizedText text={"Reset"}/></LangButton>}</div>{editing&&<p className="menu-arrange-hint"><LocalizedText text={"Drag options up or down. Changes save automatically."}/></p>}{storageError&&<p className="menu-arrange-hint" role="status"><LocalizedText text={"Order changed for this session. Browser storage is unavailable."}/></p>}<SidebarMenu>{ordered.map(([name,Icon])=><SidebarMenuItem key={name} className={editing?'menu-arrange-item':''} draggable={editing} onDragStart={e=>{setDragged(name);e.dataTransfer.setData('text/plain',name);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragged(null)} onDragOver={e=>{if(editing&&dragged)e.preventDefault()}} onDrop={e=>{e.preventDefault();if(editing&&dragged)move(dragged,name);setDragged(null)}}><SidebarMenuButton isActive={view===name} onClick={()=>{onSelect(name);if(isMobile)setOpenMobile(false);requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'auto'}))}}><Icon/><span><LocalizedText>{label(name)}</LocalizedText></span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></>
}
