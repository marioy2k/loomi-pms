
import {LocalizedText,LangInput,LangTextarea,LangButton,LangSelectValue} from '@/app/language';
import {releaseLabel, releaseChanges} from '@/lib/release';
export default function AboutLoomi() {
  return <section className="panel" style={{padding: 24}}>
    <h2><LocalizedText text={"About Loomi"}/></h2>
    <p><strong>{releaseLabel}</strong></p>
    <p><LocalizedText text={"Loomi: Turn on the brilliant way to manage stays."}/></p>
    <h3><LocalizedText text={"What’s new"}/></h3>
    <ul style={{listStyle: 'disc', paddingLeft: 22}}>{releaseChanges.map(change => <li key={change}><LocalizedText>{change}</LocalizedText></li>)}</ul>
  </section>;
}
