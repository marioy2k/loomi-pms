'use client';
import {useEffect,useRef,useState} from 'react';
import {Send,LoaderCircle} from 'lucide-react';
import Intelligence,{type IntelligenceProps} from './intelligence';
import {useLanguage} from './language';
import {readApiResponse} from '@/lib/api-response';
import {can} from '@/lib/permissions';
import styles from './intelligence-chat.module.css';

type Turn={question:string;answer?:any;error?:string};
export default function IntelligenceChat(props:IntelligenceProps){
 const {locale}=useLanguage(),nl=locale==='nl',t=(a:string,b:string)=>nl?a:b;
 const [overview,setOverview]=useState<any>(null),[question,setQuestion]=useState(''),[turns,setTurns]=useState<Turn[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[useAI,setUseAI]=useState(false),[tools,setTools]=useState(false);
 const alive=useRef(true),inFlight=useRef(false),end=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{alive.current=true;fetch('/api/intelligence?propertyId='+props.propertyId).then(readApiResponse<any>).then(data=>{if(alive.current){setOverview(data);setError('')}}).catch(e=>{if(alive.current)setError(e.message)});return()=>{alive.current=false}},[props.propertyId,tools]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'})},[turns,busy]);
 async function send(event:React.FormEvent){
  event.preventDefault();const text=question.trim();if(text.length<3||inFlight.current||!overview?.tools.includes('ask'))return;
  inFlight.current=true;setBusy(true);setError('');setQuestion('');setTurns(old=>[...old,{question:text}]);
  try{const answer=await readApiResponse<any>(await fetch('/api/intelligence?propertyId='+props.propertyId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ask',question:text,useAI:useAI&&!!overview.provider.configured&&!!overview.provider.externalEnabled})}));if(alive.current)setTurns(old=>old.map((turn,i)=>i===old.length-1?{...turn,answer}:turn))}
  catch(e){if(alive.current)setTurns(old=>old.map((turn,i)=>i===old.length-1?{...turn,error:e instanceof Error?e.message:'Request failed'}:turn))}
  finally{inFlight.current=false;if(alive.current){setBusy(false);input.current?.focus()}}
 }
 const providerReady=overview?.provider.configured&&overview?.provider.externalEnabled;
 const canOpen=can(props.access,'reservations')||can(props.access,'bookingPayments')||can(props.access,'bookingRates');
 return <div className={styles.root}>
  <div className={styles.heading}><div><strong>Loomi Intelligence</strong><small>{overview?.property||t('Hotelassistent','Hotel assistant')} · $50/{t('maand','month')}</small></div><button type="button" aria-expanded={tools} onClick={()=>setTools(!tools)}>{tools?t('Terug naar gesprek','Back to conversation'):t('Meer functies','More tools')}</button></div>
  {tools&&<div className={styles.tools}><Intelligence {...props} embedded/></div>}
  <div hidden={tools} className={styles.conversation}>
   <div className={styles.messages} role="log" aria-label={t('Gesprek met Loomi','Conversation with Loomi')} aria-live="polite" aria-busy={busy}>
    {!turns.length&&<div className={styles.welcome}><h3>{t('Wat wil je weten?','What would you like to know?')}</h3><p>{t('Vraag naar aankomsten, vertrekken, reserveringen, bezetting, saldi of kortingen.','Ask about arrivals, departures, reservations, occupancy, balances or discounts.')}</p>{[t('Wie komt vandaag aan?','Who arrives today?'),t('Wie checkt morgen uit?','Who checks out tomorrow?'),t('Welke saldi staan open?','Which balances are outstanding?')].map(q=><button key={q} type="button" onClick={()=>{setQuestion(q);input.current?.focus()}}>{q}</button>)}</div>}
    {turns.map((turn,i)=><div key={i} className={styles.turn}><p className={styles.question}><strong>{t('Jij','You')}</strong>{turn.question}</p><div className={styles.answer}>
     <strong>Loomi</strong>{turn.error?<p role="alert">{turn.error}</p>:!turn.answer?<p role="status">{t('Gegevens bekijken…','Checking records…')}</p>:turn.answer.unsupported?<p>{turn.answer.message}</p>:<>
      <p>{turn.answer.count} {t('reserveringen gevonden','reservations found')}{Object.entries(turn.answer.totals||{}).map(([currency,n])=>' · '+currency+' '+((n as number)/100).toFixed(2))}</p>
      {turn.answer.rows?.map((row:any)=><article className={styles.record} key={row.id}>{canOpen?<button type="button" onClick={()=>props.onOpenBooking(row.id)}>{row.guest||row.id} ↗</button>:<strong>{row.guest||row.id}</strong>}<span>{t('Kamer','Room')} {row.room} · {row.arrival} → {row.departure}</span>{row.currency&&<span>{turn.answer.plan.intent==='discounts'?t('Korting','Discount'):t('Openstaand','Outstanding')}: {row.currency} {((turn.answer.plan.intent==='discounts'?row.discount:row.balance)/100).toFixed(2)}</span>}</article>)}
      <small>{turn.answer.note}</small><small>{turn.answer.source}</small>
     </>}
    </div></div>)}<div ref={end}/>
   </div>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   <form onSubmit={send} className={styles.composer}>
    <label htmlFor="loomi-question">{t('Vraag Loomi','Ask Loomi')}</label><div><textarea ref={input} id="loomi-question" rows={2} maxLength={1500} value={question} disabled={busy||!overview?.tools.includes('ask')} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}} placeholder={t('Stel je vraag…','Ask your question…')}/><button type="submit" disabled={busy||question.trim().length<3||!overview?.tools.includes('ask')} aria-label={t('Vraag versturen','Send question')}>{busy?<LoaderCircle size={19}/>:<Send size={19}/>}</button></div>
    {providerReady?<label className={styles.ai}><input type="checkbox" checked={useAI} disabled={busy} onChange={e=>setUseAI(e.target.checked)}/>{t('AI gebruiken voor deze vraag','Use AI for this question')}</label>:<small>{t('Lokale antwoorden uit hotelgegevens. AI kan worden ingesteld bij Meer functies.','Local answers from hotel records. Configure AI under More tools.')}</small>}
    {useAI&&providerReady&&<small>{t('Deze vraag wordt voor interpretatie naar OpenAI gestuurd.','This question is sent to OpenAI for interpretation.')}</small>}
    {overview&&!overview.tools.includes('ask')&&<small>{t('Gebruik Meer functies voor de hulpmiddelen binnen jouw bevoegdheden.','Use More tools for the tools available to your role.')}</small>}
   </form>
  </div>
 </div>
}
