// Lambda disables require(ESM). Compile the audited JOSE source to CommonJS
// without downgrading its cryptographic implementation or runtime protections.
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
let dir=path.dirname(require.resolve('jose'));
while(true){
 const manifest=path.join(dir,'package.json');
 try{
  const pkg=JSON.parse(await fs.readFile(manifest,'utf8'));
  if(pkg.name==='jose'){
   const root=pkg.exports['.'],entry=typeof root==='string'?root:root.import||root.default;
   await build({entryPoints:[path.join(dir,entry)],outfile:path.join(dir,'dist/cjs/index.cjs'),bundle:true,platform:'node',format:'cjs',target:'node22',legalComments:'eof'});
   pkg.exports['.']={...(root.types?{types:root.types}:{}),require:'./dist/cjs/index.cjs',import:entry,default:entry};
   await fs.writeFile(manifest,JSON.stringify(pkg,null,2)+'\n');
   break;
  }
 }catch(error){if(error.code!=='ENOENT')throw error;}
 const parent=path.dirname(dir);if(parent===dir)throw Error('JOSE package not found');dir=parent;
}
execFileSync(process.execPath,['--no-experimental-require-module','-e',`
 require('./server/firebase-admin.cjs').auth; require('./netlify/functions/site-api.js');
 (async()=>{
  const jose=require('jose');
  const {publicKey,privateKey}=await jose.generateKeyPair('RS256');
  const token=await new jose.SignJWT({test:true}).setProtectedHeader({alg:'RS256'}).setIssuer('local-build-test').setExpirationTime('1m').sign(privateKey);
  await jose.jwtVerify(token,publicKey,{issuer:'local-build-test',algorithms:['RS256']});
  let refused=false;try{await jose.jwtVerify(token.slice(0,-8)+'AAAAAAAA',publicKey,{algorithms:['RS256']});}catch{refused=true;}
  if(!refused)throw Error('Invalid signature accepted');
 })().catch(error=>{console.error(error.name);process.exitCode=1;});
`],{stdio:'inherit'});
console.log('Server cryptography prepared and verified with Lambda module restrictions.');
