'use client';
import {currencies,currencyLabels} from '@/lib/currency';
import {LocalizedText,LangSelect} from '@/app/language';
export default function CurrencySelect({value,onChange,disabled=false,fixed=false,available}:{value:string;onChange?:(value:string)=>void;disabled?:boolean;fixed?:boolean;available?:string[]}){return <label className="currency-control"><LocalizedText text="Currency"/><LangSelect value={value} disabled={disabled} onChange={e=>onChange?.(e.target.value)}>{currencies.map(c=><option key={c} value={c} disabled={(fixed&&c!==value)||!!available&&!available.includes(c)}>{currencyLabels[c]}</option>)}</LangSelect>{fixed&&<small><LocalizedText text="Payment and refund use the saved transaction currency."/></small>}</label>}
