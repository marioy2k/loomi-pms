'use client';
import {LocalizedText,LangInput,LangButton,useLanguage} from '@/app/language';

import {useState,useEffect} from 'react';
import {ArrowRight,Eye,EyeOff,LockKeyhole,Mail} from 'lucide-react';
import LoomiBrand from '../loomi-brand';
import SupportFooter from '../support-footer';
import styles from './login.module.css';
import {DropdownMenu} from 'radix-ui';
import {ChevronDown} from 'lucide-react';

export default function Login(){
 const [changed,setChanged]=useState(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[showPassword,setShowPassword]=useState(false);
 useEffect(()=>{setChanged(new URLSearchParams(location.search).has('passwordChanged'))},[]);
 return <div className={styles.page}>
  <main className={styles.main}>
   <section className={styles.welcome} aria-label="Welcome to Loomi">
    <span className={styles.eyebrow}><LocalizedText text={"A LITTLE MORE ROOM FOR GREAT HOSPITALITY"}/></span>
    <h1><LocalizedText text={"Beautiful stays."}/><br/><em><LocalizedText text={"Brilliantly managed."}/></em></h1>
    <p><LocalizedText text={"From the first welcome to the last goodbye."}/><br/><LocalizedText text={"Make every stay feel effortless with Loomi."}/></p>
    <div className={styles.caption}><span/><LocalizedText text={"Your day, a little brighter."}/></div>
   </section>
   <section className={styles.card} aria-labelledby="login-heading">
    <LoginLanguage/>
    <div className={styles.brand}><LoomiBrand compact/></div>
    <div className={styles.cardHeading}><span className={styles.cardEyebrow}><LocalizedText text={"YOUR HOTEL WORKSPACE"}/></span><h2 id="login-heading"><LocalizedText text={"Welcome back."}/></h2><p><LocalizedText text={"Sign in to take care of your next great stay."}/></p></div>
    {changed&&<p className={styles.success} role="status"><LocalizedText text={"Password updated. Sign in with your new password."}/></p>}
    <form onSubmit={async e=>{
     e.preventDefault();setError('');setBusy(true);
     const f=new FormData(e.currentTarget);
     try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});const x=await r.json();if(!r.ok)throw Error(x.error||'Unable to sign in');location.href='/'}catch(e){setError(e instanceof Error?e.message:'Unable to sign in. Please try again.');setBusy(false)}
    }}>
     <label className={styles.label} htmlFor="login-email"><LocalizedText text={"Email address"}/></label>
     <div className={styles.inputWrap}><Mail size={18} aria-hidden="true"/><LangInput id="login-email" name="email" type="email" placeholder="you@yourhotel.com" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy}/></div>
     <label className={styles.label} htmlFor="login-password"><LocalizedText text={"Password"}/></label>
     <div className={styles.inputWrap}><LockKeyhole size={18} aria-hidden="true"/><LangInput id="login-password" name="password" type={showPassword?'text':'password'} placeholder="Enter your password" autoComplete="current-password" required disabled={busy} aria-describedby={error?'login-error':undefined}/><LangButton className={styles.showPassword} type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} disabled={busy}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</LangButton></div>
     {error&&<p id="login-error" className={styles.error} role="alert"><LocalizedText>{error}</LocalizedText></p>}
     <LangButton className={styles.submit} disabled={busy} type="submit">{busy?<LocalizedText text={"Signing in…"}/>:<LocalizedText text={"Sign in"}/>}<ArrowRight size={19} aria-hidden="true"/></LangButton>
    </form>
    <p className={styles.help}><LocalizedText text={"Need access? Contact your hotel administrator."}/></p>
   </section>
  </main>
  <div className={styles.footer}><SupportFooter/></div>
 </div>;
}

function LanguageFlag({code}:{code:string}){return <svg className={styles.flag} viewBox="0 0 60 40" aria-hidden="true" focusable="false">{code==='nl'?<><path fill="#ae1c28" d="M0 0h60v14H0z"/><path fill="#fff" d="M0 14h60v12H0z"/><path fill="#21468b" d="M0 26h60v14H0z"/></>:<><path fill="#012169" d="M0 0h60v40H0z"/><path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40"/><path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M60 0 0 40"/><path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60"/><path stroke="#c8102e" strokeWidth="7" d="M30 0v40M0 20h60"/></>}</svg>;}

function LoginLanguage(){const {locale,setLocale}=useLanguage();return <div className={styles.languageChoice}><DropdownMenu.Root><DropdownMenu.Trigger className={styles.languageTrigger} aria-label={locale==='nl'?'Taal kiezen':'Choose language'} title={locale==='nl'?'Taal kiezen':'Choose language'}><LanguageFlag code={locale}/><ChevronDown size={12} aria-hidden="true"/></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className={styles.languageMenu} align="end" sideOffset={6} aria-label="Language / Taal">{(['en','nl'] as const).map(code=><DropdownMenu.Item key={code} className={styles.languageOption} aria-label={code==='nl'?'Nederlands':'English'} title={code==='nl'?'Nederlands':'English'} data-selected={locale===code} onSelect={()=>setLocale(code)}><LanguageFlag code={code}/></DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>;}
