'use client';
import {LocalizedText,LangInput,LangTextarea,LangButton,LangSelectValue} from '@/app/language';

import {useLogoContrast} from './use-logo-contrast';
export default function LoomiBrand({compact = false}: {compact?: boolean}) {
  const {ref,filter}=useLogoContrast();
  return <div className={`loomi-brand${compact ? ' loomi-brand-compact' : ''}`}>
    <div className="loomi-logo-frame"><img ref={ref} style={{filter}} className="loomi-logo" src="/loomi-logo-transparent.png" width="1536" height="1024" alt="Loomi — geometric lampshade with a light beam framing the wordmark"/></div>
    {!compact && <p className="loomi-slogan"><LocalizedText text={"Loomi: Turn on the brilliant way to manage stays."}/></p>}
  </div>;
}
