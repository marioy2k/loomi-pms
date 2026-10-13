'use client';
import {createContext,useContext,useEffect,useState,forwardRef,type ReactNode,type InputHTMLAttributes,type TextareaHTMLAttributes,type ButtonHTMLAttributes,type ComponentProps} from 'react';
import {SelectValue} from '@/components/ui/select';
import {translateText} from '@/runtime/translations.mjs';
type Locale='en'|'nl';
const LanguageContext=createContext<{locale:Locale;setLocale:(locale:Locale)=>void}>({locale:'en',setLocale:()=>{}});
export const useLanguage=()=>useContext(LanguageContext);
export function LanguageProvider({children}:{children:ReactNode}){
 const [locale,setLocaleState]=useState<Locale>('en');
 useEffect(()=>{try{if(localStorage.getItem('loomi-language')==='nl')setLocaleState('nl')}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=locale},[locale]);
 const setLocale=(next:Locale)=>{setLocaleState(next);try{localStorage.setItem('loomi-language',next)}catch{}};
 return <LanguageContext.Provider value={{locale,setLocale}}>{children}<div className="language-switcher" role="group" aria-label="Language / Taal" onPointerDownCapture={event=>{event.preventDefault();event.stopPropagation()}}>{(['en','nl'] as Locale[]).map(code=><button key={code} type="button" onClick={()=>setLocale(code)} aria-pressed={locale===code} aria-label={code==='nl'?'Nederlands':'English'} title={code==='nl'?'Nederlands':'English'}><svg viewBox="0 0 60 40" aria-hidden="true" focusable="false">{code==='nl'?<><path fill="#ae1c28" d="M0 0h60v14H0z"/><path fill="#fff" d="M0 14h60v12H0z"/><path fill="#21468b" d="M0 26h60v14H0z"/></>:<><path fill="#012169" d="M0 0h60v40H0z"/><path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40"/><path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M60 0 0 40"/><path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60"/><path stroke="#c8102e" strokeWidth="7" d="M30 0v40M0 20h60"/></>}</svg><span>{code.toUpperCase()}</span></button>)}</div></LanguageContext.Provider>;
}
export function LocalizedText({text,children}:{text?:string;children?:ReactNode}){const {locale}=useLanguage();const value=text??children;return <>{typeof value==='string'?translateText(value,locale):value}</>}
export const LangInput=forwardRef<HTMLInputElement,InputHTMLAttributes<HTMLInputElement>>(function LangInput(props,ref){const {locale}=useLanguage();return <input {...props} ref={ref} placeholder={props.placeholder?translateText(props.placeholder,locale):undefined} aria-label={props['aria-label']?translateText(props['aria-label'],locale):undefined}/>});
export const LangTextarea=forwardRef<HTMLTextAreaElement,TextareaHTMLAttributes<HTMLTextAreaElement>>(function LangTextarea(props,ref){const {locale}=useLanguage();return <textarea {...props} ref={ref} placeholder={props.placeholder?translateText(props.placeholder,locale):undefined} aria-label={props['aria-label']?translateText(props['aria-label'],locale):undefined}/>});
export const LangButton=forwardRef<HTMLButtonElement,ButtonHTMLAttributes<HTMLButtonElement>>(function LangButton(props,ref){const {locale}=useLanguage();return <button {...props} ref={ref} title={props.title?translateText(props.title,locale):undefined} aria-label={props['aria-label']?translateText(props['aria-label'],locale):undefined}/>});
export function LangSelectValue(props:ComponentProps<typeof SelectValue>){const {locale}=useLanguage();return <SelectValue {...props} placeholder={typeof props.placeholder==='string'?translateText(props.placeholder,locale):props.placeholder}/>}
