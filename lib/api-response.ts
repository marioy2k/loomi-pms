export async function readApiResponse<T>(response:Response):Promise<T>{
 const text=await response.text();
 let result:unknown;
 try{result=JSON.parse(text);}catch{throw new Error(response.status===401||response.status===403||response.redirected?'Your session could not be verified. Open the hotel app in a new tab, sign in, and try again. Your form has been kept open.':'The server returned an unexpected response. Your form has been kept open; please try saving again.');}
 if(!response.ok)throw new Error(typeof result==='object'&&result!==null&&'error' in result&&typeof result.error==='string'?result.error:'Unable to complete the request. Please try again.');
 return result as T;
}
