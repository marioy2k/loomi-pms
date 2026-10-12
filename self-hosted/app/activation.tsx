'use client';
import LoomiBrand from './loomi-brand';
import LicenseSettings from './license-settings';
import SupportFooter from './support-footer';

export default function Activation({license, superAdmin = false}: {license: {error?: string; installationId?: string}; superAdmin?: boolean}) {
  return <>
    <main className="loading">
      <LoomiBrand/>
      <h1>Activate Loomi PMS</h1>
      <p>{superAdmin ? license.error || 'A valid licence is required.' : 'Hotel access is unavailable. Please contact your super admin.'}</p>
      {superAdmin && <p>Installation ID: <code>{license.installationId}</code></p>}
      {superAdmin ? <LicenseSettings/> : <p>Ask your super admin to activate a Small, Standard or Hotel licence for this installation.</p>}
      <button onClick={async () => {
        await fetch('/api/logout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
        location.href = '/login';
      }}>Sign out</button>
    </main>
    <SupportFooter/>
  </>;
}
