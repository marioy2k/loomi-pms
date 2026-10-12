'use client';
import {useEffect,useState,type ComponentType} from 'react';
import {GripVertical} from 'lucide-react';
import {SidebarMenu,SidebarMenuItem,SidebarMenuButton} from '@/components/ui/sidebar';
type Item=readonly [string,ComponentType<{size?:number}>];
export default function FlexibleMenu({items,allNames,email,view,wholeHouse,onSelect}:{items:readonly Item[];allNames:string[];email:string;view:string;wholeHouse:boolean;onSelect:(name:string)=>void}){
 const [order,setOrder]=useState<string[]>(allNames),[editing,setEditing]=useState(false),[dragged,setDragged]=useState<string|null>(null),[storageError,setStorageError]=useState(false);
 const key='loomi:menu-order:'+email.toLowerCase();
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved)){const valid=saved.filter((n:unknown):n is string=>typeof n==='string'&&allNames.includes(n));setOrder([...new Set([...valid,...allNames])]);}}catch{setStorageError(true)}},[key]);
 const ordered=[...items].sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));
 const save=(next:string[])=>{setOrder(next);try{localStorage.setItem(key,JSON.stringify(next));setStorageError(false)}catch{setStorageError(true)}};
 const move=(name:string,target:string)=>{if(name===target)return;const next=[...order];const from=next.indexOf(name),to=next.indexOf(target);if(from<0||to<0)return;next.splice(from,1);next.splice(to,0,name);save(next)};
 const label=(name:string)=>name==='Room calendar'&&wholeHouse?'House calendar':name;
 return <><div className="menu-arrange-bar"><button className="menu-arrange-toggle" aria-pressed={editing} onClick={()=>setEditing(!editing)}><GripVertical size={14}/>{editing?'Done reordering':'Reorder menu'}</button>{editing&&<button className="menu-reset" onClick={()=>save(allNames)}>Reset</button>}</div>{editing&&<p className="menu-arrange-hint">Drag options up or down. Changes save automatically.</p>}{storageError&&<p className="menu-arrange-hint" role="status">Order changed for this session. Browser storage is unavailable.</p>}<SidebarMenu>{ordered.map(([name,Icon])=><SidebarMenuItem key={name} className={editing?'menu-arrange-item':''} draggable={editing} onDragStart={e=>{setDragged(name);e.dataTransfer.setData('text/plain',name);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragged(null)} onDragOver={e=>{if(editing&&dragged)e.preventDefault()}} onDrop={e=>{e.preventDefault();if(editing&&dragged)move(dragged,name);setDragged(null)}}><SidebarMenuButton isActive={view===name} onClick={()=>onSelect(name)}><Icon/><span>{label(name)}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></>
}
