 'use client';
import LoomiBrand from '../loomi-brand';
import {useState} from 'react';import SupportFooter from '../support-footer';
export default function Login(){const [error,setError]=useState(''),[busy,setBusy]=useState(false);return <><main className="loading"><LoomiBrand/><form onSubmit={async e=>{e.preventDefault();setBusy(true);const f=new FormData(e.currentTarget);try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});const x=await r.json();if(!r.ok)throw Error(x.error);location.href='/'}catch(e){setError(String(e));setBusy(false)}}}><label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><p role="alert">{error}</p><button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form></main><SupportFooter/></>}

