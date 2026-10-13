'use client';
import {useState} from 'react';
import {LogOut} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {readApiResponse} from '@/lib/api-response';
export default function AccountActions(){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');

  return <><div className="account-actions"><button className="account-button" onClick={()=>{setError('');setOpen(true)}} disabled={busy}>Change password</button>{error&&!open&&<span role="alert">{error}</span>}</div>
    <Dialog open={open} onOpenChange={v=>{if(!busy){setOpen(v);setError('')}}}><DialogContent><DialogHeader><DialogTitle>Change your password</DialogTitle><DialogDescription>Choose your own password. You will sign in again afterward, and your other sessions will be signed out.</DialogDescription></DialogHeader><form className="room-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget),newPassword=String(f.get('newPassword'));setError('');if(newPassword!==f.get('confirmation')){setError('New passwords do not match');return}setBusy(true);try{await readApiResponse(await fetch('/api/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:f.get('currentPassword'),newPassword})}));location.href='/login?passwordChanged=1'}catch(e){setError(e instanceof Error?e.message:'Unable to change password');setBusy(false)}}}>
    <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></label>
    <label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
    <label>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
    <p>Use 12–128 characters.</p>{error&&<p role="alert" className="operation-error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Updating…':'Save password'}</button></form></DialogContent></Dialog></>;
}

export function SignOutButton(){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function logout(){setBusy(true);setError('');try{await readApiResponse(await fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));location.href='/login'}catch(e){setError(e instanceof Error?e.message:'Unable to sign out');setBusy(false)}}
  return <div className="sidebar-signout"><button onClick={logout} disabled={busy}><LogOut size={18}/><span>{busy?'Signing out…':'Sign out'}</span></button>{error&&<p role="alert">{error}</p>}</div>;
}
