'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ThemeProvider,useTheme} from 'next-themes';
import {Moon,Sun} from 'lucide-react';
import {LangButton,LocalizedText} from './language';

export function ColorModeProvider({children}:{children:ReactNode}){
 return <ThemeProvider attribute="class" storageKey="loomi-color-mode" defaultTheme="system" enableSystem disableTransitionOnChange>{children}<ColorModeToggle/></ThemeProvider>;
}
function ColorModeToggle(){
 const {resolvedTheme,setTheme}=useTheme();
 const [mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 const dark=mounted&&resolvedTheme==='dark';
 const label=dark?'Switch to light mode':'Switch to dark mode';
 return <LangButton type="button" className="color-mode-toggle" aria-label={label} title={label} disabled={!mounted} onClick={()=>setTheme(dark?'light':'dark')}>
  {dark?<Sun size={21} aria-hidden="true"/>:<Moon size={21} aria-hidden="true"/>}
  <span className="sr-only"><LocalizedText text={label}/></span>
 </LangButton>;
}
