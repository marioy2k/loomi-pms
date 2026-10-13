'use client';
import {useEffect,useRef,useState} from 'react';

// Follow the visible surface, including property color previews and theme changes.
export function useLogoContrast(){
  const ref=useRef<HTMLImageElement>(null);
  const [light,setLight]=useState(false);
  useEffect(()=>{
    const image=ref.current;
    if(!image)return;
    let frame=0;
    const update=()=>{
      let background=[255,255,255];
      const surfaces:number[][]=[];
      for(let node:HTMLElement|null=image.parentElement;node;node=node.parentElement){
        const parts=getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number);
        if(parts&&parts.length>=3)surfaces.push([parts[0],parts[1],parts[2],parts[3]??1]);
      }
      for(const [r,g,b,a] of surfaces.reverse())background=background.map((v,i)=>[r,g,b][i]*a+v*(1-a));
      const luminance=(color:number[])=>color.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      const surface=luminance(background),green=luminance([1,66,40]);
      const greenContrast=(Math.max(surface,green)+.05)/(Math.min(surface,green)+.05);
      const whiteContrast=1.05/(surface+.05);
      setLight(whiteContrast>greenContrast);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)};
    update();
    const observer=new MutationObserver(schedule);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','class'],subtree:true});
    const scheme=matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change',schedule);
    window.addEventListener('resize',schedule);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);scheme.removeEventListener('change',schedule);window.removeEventListener('resize',schedule)};
  },[]);
  return {ref,filter:light?'brightness(0) invert(1)':'none'};
}
