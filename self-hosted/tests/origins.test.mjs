import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedOrigin,secureSessionCookie} from '../runtime/origins.mjs';
const env={APP_URL:'https://loomi.bitwisesr.com',ALLOWED_ORIGINS:'http://10.10.111.47',COOKIE_SECURE:'auto'};
const req=origin=>new Request('http://internal/api/login',{headers:origin?{Origin:origin}:{}});
test('only the configured domain and IP may write',()=>{
 for(const origin of ['https://loomi.bitwisesr.com','http://10.10.111.47'])assert.equal(isAllowedOrigin(req(origin),env),true);
 for(const origin of [undefined,'null','https://evil.test','http://loomi.bitwisesr.com','https://loomi.bitwisesr.com.evil.test','http://10.10.111.47:3000'])assert.equal(isAllowedOrigin(req(origin),env),false);
});
test('auto cookies are secure on domain HTTPS and usable on allowed HTTP IP',()=>{
 assert.equal(secureSessionCookie(req(env.APP_URL),env),true);
 assert.equal(secureSessionCookie(req(env.ALLOWED_ORIGINS),env),false);
 assert.throws(()=>secureSessionCookie(req('https://evil.test'),env));
 assert.equal(secureSessionCookie(req(env.ALLOWED_ORIGINS),{...env,COOKIE_SECURE:'true'}),true);
});
