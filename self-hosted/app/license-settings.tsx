'use client';
import {useEffect, useState} from 'react';
import {readApiResponse} from '@/lib/api-response';

type Plan = {name: string; minRooms: number; maxRooms: number; monthlyUsd: number; yearlyUsd: number};
type AddOn = {name: string; monthlyUsd: number; yearlyUsd: number; available: boolean};
type LicenseData = {
  license: {valid: boolean; licenceVersion?: number; daysRemaining?: number | null; error?: string; installationId: string; company?: string; plan?: string; term?: string; maxRooms?: number; maxProperties?: number; expiresAt?: string | null; pricing?: {currency: string; monthlyUsd: number; yearlyUsd: number}};
  plans: Record<string, Plan>;
  addOns: Record<string, AddOn>;
  enabledAddOns: string[];
  properties: {id: number; name: string; rooms: number}[];
};
const usd = (amount: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(amount);

export default function LicenseSettings() {
  const [data, setData] = useState<LicenseData | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('small');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/license', {signal: controller.signal}).then(readApiResponse<LicenseData>).then(setData).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load licence');
    });
    return () => controller.abort();
  }, []);
  if (!data) return <section className="panel"><h2>Licence & pricing</h2><p role="status">{error || 'Loading licence…'}</p></section>;
  const {license, plans, properties, addOns, enabledAddOns} = data;
  const estimate = selectedAddOns.reduce((total, id) => ({monthly: total.monthly + addOns[id].monthlyUsd, yearly: total.yearly + addOns[id].yearlyUsd}), {monthly: plans[selectedPlan].monthlyUsd, yearly: plans[selectedPlan].yearlyUsd});
  const current = license.plan ? plans[license.plan] : undefined;
  const charge = license.pricing && license.maxProperties && ['monthly', 'yearly'].includes(license.term || '')
    ? (license.term === 'monthly' ? license.pricing.monthlyUsd : license.pricing.yearlyUsd) * license.maxProperties : null;
  return <section className="panel">
    <h2>Licence & pricing</h2>
    <p>Super admin only. All prices are in USD, per licensed property.</p>
    <p>Installation ID: <code>{license.installationId}</code></p>
    {license.valid ? <>
      <p><strong>{current?.name} licence</strong> · {license.company} · {license.term === 'demo' ? '21-day free demo' : license.term}</p>
      <p>Up to {license.maxRooms} rooms per property · {license.maxProperties} licensed properties.</p>
      <p>Enabled add-ons: {enabledAddOns.map(id => `${addOns[id].name}${addOns[id].available ? '' : ' (planned)'}`).join(', ') || 'None — core PMS only'}.</p>
      {license.licenceVersion !== 2 && license.term !== 'demo' && <p>Your existing licence retains Accounting until renewal. New licences select Accounting separately.</p>}
      {license.daysRemaining !== null && license.daysRemaining !== undefined && <p><strong>{license.daysRemaining} {license.daysRemaining === 1 ? 'day' : 'days'} remaining</strong></p>}
      <p>{license.expiresAt ? `Expires: ${new Date(license.expiresAt).toLocaleDateString()}` : 'Permanent licence — no expiry.'}</p>
      {license.pricing && <p>Prices on this signed licence: {usd(license.pricing.monthlyUsd)}/month or {usd(license.pricing.yearlyUsd)}/year per property.</p>}
      <p>{license.term === 'demo' ? 'Demo price: free for 21 days. No automatic billing. Activate a paid licence to continue after expiry.' : charge !== null ? `Subscription total: ${usd(charge)} per ${license.term === 'monthly' ? 'month' : 'year'}.` : 'Permanent licence price: custom quote.'}</p>
    </> : <p role="alert">{license.error}</p>}
    <div className="table-wrap"><table><caption>Available licence plans</caption><thead><tr><th>Plan</th><th>Room band</th><th>Maximum rooms per property</th><th>Monthly</th><th>Annual</th></tr></thead><tbody>
      {Object.entries(plans).map(([id, plan]) => <tr key={id}><td>{plan.name}</td><td>{plan.minRooms}–{plan.maxRooms}</td><td>{plan.maxRooms}</td><td>{usd(plan.monthlyUsd)}</td><td>{usd(plan.yearlyUsd)}</td></tr>)}
    </tbody></table></div>
    <p>Core PMS includes reservations, rooms, guests, basic housekeeping and recording guest payments. Choose your room package, then optional extras. Annual pricing gives two months free.</p>
    <div className="table-wrap"><table><caption>Optional add-ons — USD per property</caption><thead><tr><th>Add-on</th><th>Monthly</th><th>Annual</th><th>Availability</th></tr></thead><tbody>{Object.entries(addOns).map(([id, addOn]) => <tr key={id}><td>{addOn.name}</td><td>{usd(addOn.monthlyUsd)}</td><td>{usd(addOn.yearlyUsd)}</td><td>{addOn.available ? 'Available' : 'Planned — not sold yet'}</td></tr>)}</tbody></table></div>
    <p>Accounting adds the financial ledger, income and expense entries, and transaction filters. Operations is reserved for advanced task and maintenance workflows; basic housekeeping stays included.</p>
    <h3>Estimate your package</h3>
    <label>Room package <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>{Object.entries(plans).map(([id, plan]) => <option key={id} value={id}>{plan.name} · {plan.minRooms}–{plan.maxRooms} rooms</option>)}</select></label>
    {Object.entries(addOns).filter(([, addOn]) => addOn.available).map(([id, addOn]) => <label key={id}><input type="checkbox" checked={selectedAddOns.includes(id)} onChange={e => setSelectedAddOns(current => e.target.checked ? [...current, id] : current.filter(item => item !== id))}/>{addOn.name} · {usd(addOn.monthlyUsd)}/month or {usd(addOn.yearlyUsd)}/year</label>)}
    <p aria-live="polite"><strong>{usd(estimate.monthly)}/month or {usd(estimate.yearly)}/year per property</strong>. Estimate only; contact Bitwise MSP for one signed licence covering your room package and selected add-ons.</p>
    <p>A free 21-day demo uses the selected plan’s room cap and property allowance and includes all add-on entitlements. Planned modules become usable when released. The demo starts when the signed licence is issued; uploading it again does not restart the period.</p>
    <p>Room bands guide plan selection; only the maximum is enforced. Every configured room counts, including rooms marked out of service.</p>
    <ul>{properties.map(property => <li key={property.id}>{property.name}: {property.rooms}{license.maxRooms ? ` / ${license.maxRooms}` : ''} rooms</li>)}</ul>
    <label>Upload a renewal or upgraded licence<input type="file" accept=".json" disabled={saving} onChange={async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSaving(true); setError('');
      try {
        await readApiResponse(await fetch('/api/license', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(JSON.parse(await file.text()))}));
        location.reload();
      } catch (e) {setError(e instanceof Error ? e.message : 'Activation failed');}
      finally {setSaving(false);}
    }}/></label>
    {saving && <p role="status">Activating licence…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
