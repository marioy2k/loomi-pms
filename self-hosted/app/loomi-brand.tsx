export default function LoomiBrand({compact = false}: {compact?: boolean}) {
  return <div className={`loomi-brand${compact ? ' loomi-brand-compact' : ''}`}>
    <div className="loomi-logo-frame"><img className="loomi-logo" src="/loomi-logo.png" width="1536" height="1024" alt="Loomi — geometric lampshade with a light beam framing the wordmark"/></div>
    {!compact && <p className="loomi-slogan">Loomi: Turn on the brilliant way to manage stays.</p>}
  </div>;
}
