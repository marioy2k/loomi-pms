// Bound credential payloads before buffering or parsing them, including chunked requests.
export async function readJson(request,maxBytes=4096){
 const fail=(message,status)=>{throw Object.assign(Error(message),{status})};
 if(Number(request.headers.get('content-length'))>maxBytes)fail('Request body is too large',413);
 const reader=request.body?.getReader();if(!reader)fail('Enter valid request details',400);
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();fail('Request body is too large',413)}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{fail('Enter valid request details',400)}
 if(!value||typeof value!=='object'||Array.isArray(value))fail('Enter valid request details',400);
 return value;
}
