// Fit chat to the visible screen, including browsers that overlay the software keyboard.
export function bindChatViewport({onChange,win=window,doc=document}){
 const media=win.matchMedia('(max-width: 767px)'),viewport=win.visualViewport;
 let previous;
 const restore=()=>{if(!previous)return;for(const [name,value] of Object.entries(previous.body))doc.body.style[name]=value;for(const [name,value] of Object.entries(previous.html))doc.documentElement.style[name]=value;previous=undefined};
 const measure=()=>{
  if(media.matches&&!previous){previous={body:{overflow:doc.body.style.overflow,overscrollBehavior:doc.body.style.overscrollBehavior},html:{overflow:doc.documentElement.style.overflow,overscrollBehavior:doc.documentElement.style.overscrollBehavior}};doc.body.style.overflow='hidden';doc.body.style.overscrollBehavior='none';doc.documentElement.style.overflow='hidden';doc.documentElement.style.overscrollBehavior='none'}
  if(!media.matches)restore();
  onChange({isMobile:media.matches,height:Math.round(viewport?.height||win.innerHeight),top:Math.max(0,Math.round(viewport?.offsetTop||0))});
 };
 win.addEventListener('resize',measure);media.addEventListener('change',measure);viewport?.addEventListener('resize',measure);viewport?.addEventListener('scroll',measure);measure();
 return ()=>{win.removeEventListener('resize',measure);media.removeEventListener('change',measure);viewport?.removeEventListener('resize',measure);viewport?.removeEventListener('scroll',measure);restore()};
}
