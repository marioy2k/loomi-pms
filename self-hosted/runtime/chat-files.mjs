import {createHash} from 'node:crypto';
export const MAX_CHAT_FILE=8*1024*1024,MAX_CHAT_MESSAGE_FILES=20*1024*1024;
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
export const chatFileId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const fileHash=b=>createHash('sha256').update(b).digest('hex');
export function inspectChatFile(name,bytes){if(typeof name!=='string'||!name.trim())fail(400,'Choose a file');const filename=[...name.normalize('NFC').replace(/[\/\\\x00-\x1f\x7f]/g,'_')].slice(0,180).join(''),ext=filename.split('.').at(-1).toLowerCase(),b=Buffer.from(bytes);if(!b.length||b.length>MAX_CHAT_FILE)fail(400,'Files must be between 1 byte and 8 MB');let mime='',valid=false;
if(['jpg','jpeg'].includes(ext)){mime='image/jpeg';valid=b[0]===255&&b[1]===216&&b[2]===255}
else if(ext==='png'){mime='image/png';valid=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))}
else if(ext==='webp'){mime='image/webp';valid=b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'}
else if(ext==='gif'){mime='image/gif';valid=['GIF87a','GIF89a'].includes(b.toString('ascii',0,6))}
else if(ext==='pdf'){mime='application/pdf';valid=b.toString('ascii',0,5)==='%PDF-'}
else if(['docx','xlsx','pptx'].includes(ext)){mime={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[ext];valid=b.subarray(0,4).equals(Buffer.from([80,75,3,4]))&&b.includes(Buffer.from('[Content_Types].xml'))&&b.includes(Buffer.from({docx:'word/',xlsx:'xl/',pptx:'ppt/'}[ext]))}
else if(['txt','csv'].includes(ext)){mime=ext==='csv'?'text/csv':'text/plain';try{const text=new TextDecoder('utf-8',{fatal:true}).decode(b);valid=!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)}catch{valid=false}}
else fail(400,'Use a photo, PDF, DOCX, XLSX, PPTX, TXT or CSV file');if(!valid)fail(400,'The file contents do not match its file type');return {filename,mime,size:b.length,bytes:b,sha256:fileHash(b)}}
export const chatFileMeta=r=>({id:r.id,name:r.filename,mime:r.mime,size:r.size,url:'/api/chat/attachment?id='+encodeURIComponent(r.id)});
