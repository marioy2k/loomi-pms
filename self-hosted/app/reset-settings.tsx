'use client';
import {useState} from 'react';

export default function ResetSettings() {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function reset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || confirmation !== 'RESET ALL HOTEL DATA') return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/reset', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({confirmation})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to reset hotel data');
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to reset hotel data');
      setBusy(false);
    }
  }
  return <section className="panel">
    <h2>Reset hotel data</h2>
    <p>Remove all rooms, reservations, guest history and accounting transactions across every property. This cannot be undone in the app.</p>
    <p>Property names and currencies, staff accounts, permissions, audit history and your licence are kept. Save a backup before resetting. Other open sessions must reload.</p>
    {!confirming ? <button className="primary" onClick={() => setConfirming(true)}>Reset hotel data</button> :
      <form onSubmit={reset}>
        <label htmlFor="reset-confirmation">Type RESET ALL HOTEL DATA to confirm</label>
        <input id="reset-confirmation" autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy}/>
        <div className="flex gap-3 mt-4">
          <button type="submit" className="primary" disabled={busy || confirmation !== 'RESET ALL HOTEL DATA'}>{busy ? 'Resetting…' : 'Permanently remove hotel data'}</button>
          <button type="button" disabled={busy} onClick={() => {setConfirming(false);setConfirmation('');setError('')}}>Cancel</button>
        </div>
      </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
