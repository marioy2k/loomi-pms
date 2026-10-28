// Auto-hide only pauses for interaction with this sidebar, including its portalled menus.
export function bindSidebarAutoHide({panel,isOpen,onChange,doc=document,win=window}){
 let timer,point;
 const cancel=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined};
 const inside=()=>{if(!point)return false;if(point.x>=0&&point.x<=16)return true;const rect=panel()?.getBoundingClientRect();return !!(isOpen()&&rect&&point.x>=rect.left&&point.x<=rect.right+8&&point.y>=rect.top&&point.y<=rect.bottom)};
 const ownedPopup=()=>[...(panel()?.querySelectorAll('[aria-expanded="true"][aria-controls]')||[])].some(trigger=>(trigger.getAttribute('aria-controls')||'').split(/\s+/).some(id=>!!doc.getElementById(id)?.getClientRects().length));
 const editing=()=>{const focused=doc.activeElement;return doc.hasFocus()&&panel()?.contains(focused)&&focused?.matches('input,select,textarea,:focus-visible')};
 const schedule=()=>{
  if(!isOpen()||timer!==undefined)return;
  timer=setTimeout(()=>{timer=undefined;if(!isOpen()||inside())return;if(editing()||ownedPopup()){schedule();return}onChange(false)},400);
 };
 const sync=()=>{if(!isOpen()||inside())cancel();else schedule()};
 const move=event=>{if(event.pointerType!=='mouse'&&event.pointerType!=='pen')return;point={x:event.clientX,y:event.clientY};if(inside()){cancel();if(!isOpen())onChange(true)}else schedule()};
 const focus=event=>{if(panel()?.contains(event.target)){cancel();if(!isOpen())onChange(true)}else sync()};
 const leave=()=>{point=undefined;sync()};
 const blur=()=>{point=undefined;cancel();if(isOpen())onChange(false)};
 const visibility=()=>{if(doc.visibilityState==='hidden')blur()};
 const escape=event=>{if(event.key!=='Escape'||event.defaultPrevented||!isOpen()||ownedPopup())return;const p=panel(),wasInside=p?.contains(doc.activeElement);cancel();onChange(false);if(wasInside)p?.closest('[data-slot="sidebar-wrapper"]')?.querySelector('[data-sidebar="trigger"]')?.focus()};
 doc.addEventListener('pointermove',move);doc.addEventListener('focusin',focus);doc.addEventListener('pointerleave',leave);doc.addEventListener('keydown',escape);doc.addEventListener('visibilitychange',visibility);win.addEventListener('blur',blur);
 sync();
 return {sync,dispose(){cancel();doc.removeEventListener('pointermove',move);doc.removeEventListener('focusin',focus);doc.removeEventListener('pointerleave',leave);doc.removeEventListener('keydown',escape);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',blur)}};
}
