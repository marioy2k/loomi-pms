// Explicit configured origins only. Never trust Host or forwarded headers.
export function isAllowedOrigin(request,env=process.env){
 const origin=request.headers.get('origin');
 if(!origin||origin==='null')return false;
 const configured=[env.APP_URL,...(env.ALLOWED_ORIGINS||'').split(',')].filter(Boolean);
 return configured.some(value=>{
  try{const url=new URL(value.trim());return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&url.origin===origin;}catch{return false;}
 });
}
export function secureSessionCookie(request,env=process.env){
 if(env.COOKIE_SECURE==='auto'){
  if(!isAllowedOrigin(request,env))throw Error('Request origin rejected');
  return new URL(request.headers.get('origin')).protocol==='https:';
 }
 return env.COOKIE_SECURE!=='false';
}
