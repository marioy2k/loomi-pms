self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('push',event=>event.waitUntil((async()=>{
 try{
  const {id,generic}=event.data.json();if(!Number.isSafeInteger(id))return;
  let notice;try{const response=await fetch('/api/chat/push?message='+id,{credentials:'include',cache:'no-store'});if(response.ok)notice=await response.json();else if(response.status!==401&&response.status!==403)return}catch{/* A remembered device may still show its generic alert while the website is unreachable. */}
  if(!notice){if(generic===true)await self.registration.showNotification('Loomi',{body:'New Loomi message. Sign in to read it.',icon:'/loomi-logo.png',badge:'/loomi-logo.png',tag:'loomi-chat-'+id,data:{id},renotify:false});return}
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)client.postMessage({type:'loomi-chat-message',notice});
  if(windows.some(c=>c.focused&&c.visibilityState==='visible'))return;
  await self.registration.showNotification('Loomi · '+notice.name,{body:notice.body,icon:'/loomi-logo.png',badge:'/loomi-logo.png',tag:'loomi-chat-'+id,data:{sender:notice.peer||notice.sender,id},renotify:false});
 }catch{/* Invalid payloads and unauthorized private message content are never displayed. */}
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL('/',self.location.origin),sender=event.notification.data?.sender;if(typeof sender==='string'&&sender)url.searchParams.set('chat',sender);const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true}),client=windows.find(c=>new URL(c.url).origin===self.location.origin);if(client){if(typeof sender==='string'&&sender)client.postMessage({type:'loomi-chat-open',sender});await client.focus()}else await self.clients.openWindow(url.href)})())});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
