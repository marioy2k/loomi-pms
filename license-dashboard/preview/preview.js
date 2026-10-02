// Static interface preview: no credentials, database or cryptographic signing.
(()=>{
 const now=new Date(),day=n=>new Date(now.getTime()+n*86400000).toISOString();
 const customers=[{id:'sample-hotel',name:'Palm Hotel NV',email:'manager@example.com',created:day(-90),version:1},{id:'sample-house',name:'Riverside Holiday House',email:'owner@example.com',created:day(-60),version:1},{id:'sample-resort',name:'Sunset Resort',email:'office@example.com',created:day(-40),version:1}];
 const modules={housekeeping:'Housekeeping',accounting:'Accounting & reports',pos:'POS / bar & restaurant',swimming:'Swimming day passes',inventory:'Supply inventory',integrations:'API & integrations'};
 const licences=customers.map((c,i)=>({id:`sample-licence-${i}`,customer_id:c.id,company:c.name,installation_id:`00000000-0000-4000-8000-00000000000${i+1}`,term:['monthly','yearly','permanent'][i],max_properties:[2,1,5][i],modules:i===1?['housekeeping','accounting','inventory']:Object.keys(modules),created:day(-20-i*10),expires:i===2?null:day(i===0?12:300),renewal_of:null}));
 licences.push({...licences[0],id:'sample-expired',installation_id:'00000000-0000-4000-8000-000000000004',created:day(-90),expires:day(-60)});
 const overview={customers,licences,modules,issuer:{email:'preview@bitwise.example',fingerprint:'PREVIEW — no signing key loaded'},audit:[{created:day(-1),event:'sample-licence-issued',actor:'preview@bitwise.example'},{created:day(-2),event:'sample-customer-created',actor:'preview@bitwise.example'}]};
 const original=window.fetch.bind(window);
 window.fetch=async(input,options={})=>{const path=typeof input==='string'?input:input.url;if(!path.startsWith('/api/'))return original(input,options);let body,status=200;if(path==='/api/session')body={authenticated:true,email:'preview@bitwise.example',role:'super-admin'};else if(path==='/api/overview'&&(!options.method||options.method==='GET'))body=overview;else{status=403;body={error:'Interface preview only. Real changes and licence generation require your Bitwise server.'}}return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})};
 document.addEventListener('click',e=>{const a=e.target.closest('a[href^="/api/"]');if(a){e.preventDefault();alert('Sample preview: no real licence files or signing keys are available.')}});
})();
