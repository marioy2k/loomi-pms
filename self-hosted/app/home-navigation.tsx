'use client';
import {useEffect,useState,type ComponentType} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {LocalizedText,useLanguage} from './language';
import styles from './home-navigation.module.css';
type Item=readonly [string,ComponentType<{size?:number;'aria-hidden'?:boolean}>];
const descriptions:Record<string,readonly [string,string]>={
 'Water tanks':['Daily water levels and tank checks','Dagelijkse waterstanden en tankcontroles'],
 'Technical department':['Repairs and everyday technical tasks','Reparaties en dagelijkse technische taken'],
 'Overview':['Today’s arrivals, departures and balances','Aankomsten, vertrekken en openstaande saldi'],
 'Reservations':['Create and manage guest stays','Reserveringen aanmaken en beheren'],
 'Room calendar':['See availability and plan stays','Beschikbaarheid bekijken en verblijven plannen'],
 'Rooms':['Check room readiness and tasks','Kamerstatus en taken bekijken'],
 'Guests':['Find guest details and stay history','Gastgegevens en verblijfsgeschiedenis'],
 'Housekeeping':['Keep rooms clean and ready','Kamers schoon en gereed houden'],
 'Vehicles':['Manage vehicles and rentals','Voertuigen en verhuur beheren'],
 'Security & keys':['Manage keys and security tasks','Sleutels en beveiliging beheren'],
 'Inventory':['Track stock and supply requests','Voorraad en aanvragen bijhouden'],
 'Swimming day passes':['Manage pool access and day passes','Zwembadtoegang en dagpassen beheren'],
 'Point of sale':['Open the register and manage sales','Kassa openen en verkopen beheren'],
 'Accounting':['Review accounts and finances','Boekhouding en financiën bekijken'],
 'Operations':['Organize daily work and requests','Dagelijkse werkzaamheden en aanvragen'],
 'All properties':['See all your properties together','Al je accommodaties in één overzicht'],
 'Activity history':['Review changes and recent activity','Wijzigingen en recente activiteiten bekijken'],
 'Settings':['Manage your property and preferences','Accommodatie en voorkeuren beheren'],
};
export default function HomeNavigation({items,email,wholeHouse,onSelect,propertyId}:{propertyId:number;items:readonly Item[];email:string;wholeHouse:boolean;onSelect:(name:string)=>void}){
 const {locale}=useLanguage();const [statuses,setStatuses]=useState<Record<string,any>>({}),[statusError,setStatusError]=useState(false);
 useEffect(()=>{const controller=new AbortController();const refresh=async()=>{try{const r=await fetch('/api/home-status?propertyId='+propertyId,{signal:controller.signal});if(!r.ok)throw Error();const x=await r.json();setStatuses(x.statuses);setStatusError(false)}catch{if(!controller.signal.aborted)setStatusError(true)}};refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh)}},[propertyId]);
 const [order,setOrder]=useState<string[]>([]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('loomi:menu-order:'+email.toLowerCase())||'[]');if(Array.isArray(saved))setOrder(saved.filter((n:unknown):n is string=>typeof n==='string'))}catch{}},[email]);
 const cards=items.filter(([name])=>name!=='Home').slice().sort((a,b)=>{const rank=(name:string)=>{const i=order.indexOf(name);return i<0?order.length:i};return rank(a[0])-rank(b[0])});
 return <nav className={styles.grid} aria-label={locale==='nl'?'Onderdelen':'Workspace sections'}>{cards.map(([name,Icon])=><button type="button" className={styles.card} key={name} onClick={()=>onSelect(name)}><span className={styles.icon}><Icon size={25} aria-hidden={true}/></span><span className={styles.copy}><strong><LocalizedText text={name==='Room calendar'&&wholeHouse?'House calendar':name}/></strong><span>{descriptions[name]?.[locale==='nl'?1:0]}</span><span className={styles.peek} data-alert={statuses[name]?.alert||undefined}>{statusError?(locale==='nl'?'Status niet beschikbaar':'Status unavailable'):statuses[name]?.[locale]||(locale==='nl'?'Status laden…':'Loading status…')}</span></span><ArrowUpRight size={18} className={styles.arrow} aria-hidden="true"/></button>)}</nav>;
}
