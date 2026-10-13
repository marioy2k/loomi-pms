import {releaseLabel, releaseChanges} from '@/lib/release';
export default function AboutLoomi() {
  return <section className="panel" style={{padding: 24}}>
    <h2>About Loomi</h2>
    <p><strong>{releaseLabel}</strong></p>
    <p>Loomi: Turn on the brilliant way to manage stays.</p>
    <h3>What’s new</h3>
    <ul style={{listStyle: 'disc', paddingLeft: 22}}>{releaseChanges.map(change => <li key={change}>{change}</li>)}</ul>
  </section>;
}
