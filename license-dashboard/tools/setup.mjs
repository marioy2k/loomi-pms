import {generateKeyPairSync,createPrivateKey,createPublicKey,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const [directory='secrets',existingKey]=process.argv.slice(2);
mkdirSync(directory,{recursive:true,mode:0o700});
for(const name of ['signing_key','admin_password','loomi-public.pem'])if(existsSync(join(directory,name)))throw Error('Setup will not overwrite existing secrets. Keep your original signing key.');
let privateKey,publicKey;if(existingKey){privateKey=readFileSync(existingKey);const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Existing key must be Ed25519');publicKey=createPublicKey(key).export({type:'spki',format:'pem'})}else{const keys=generateKeyPairSync('ed25519');privateKey=keys.privateKey.export({type:'pkcs8',format:'pem'});publicKey=keys.publicKey.export({type:'spki',format:'pem'})}
writeFileSync(join(directory,'signing_key'),privateKey,{mode:0o600,flag:'wx'});writeFileSync(join(directory,'admin_password'),randomBytes(24).toString('base64url')+'\n',{mode:0o600,flag:'wx'});writeFileSync(join(directory,'loomi-public.pem'),publicKey,{mode:0o644,flag:'wx'});
console.log('Secrets prepared. Read admin_password locally to sign in. Keep signing_key only on your Bitwise issuer. Never commit these files.');
