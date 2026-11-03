import fs from 'node:fs/promises';import path from 'node:path';
const root=process.cwd(),out=path.resolve(root,'dist');
// Publish an explicit public allowlist. Server code, secrets, tests and manifests stay outside it.
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unexpected publish directory');
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const files=['index.html','main.js','learning.js','atlas.js','install-app.js','service-worker.js','push-config.js','offline.html','manifest.webmanifest','assetlinks.json','vigie-audit.txt','app-icon-192.png','app-icon-512.png','app-icon-maskable.png'];
for(const name of files)await fs.copyFile(path.join(root,name),path.join(out,name));
for(const name of ['atlas','security','pdf','fiches','images','assets']){const source=path.join(root,name);try{await fs.access(source);}catch{continue;}await fs.cp(source,path.join(out,name),{recursive:true});}
await fs.mkdir(path.join(out,'security/vendor'),{recursive:true});
for(const [from,to] of [['node_modules/dompurify/dist/purify.min.js','purify.min.js'],['node_modules/dompurify/LICENSE','DOMPURIFY-LICENSE'],['node_modules/pdfjs-dist/legacy/build/pdf.mjs','pdf.mjs'],['node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs','pdf.worker.mjs'],['node_modules/pdfjs-dist/LICENSE','PDFJS-LICENSE']])await fs.copyFile(from,path.join(out,'security/vendor',to));
for(const dir of ['wasm','standard_fonts','cmaps'])await fs.cp('node_modules/pdfjs-dist/'+dir,path.join(out,'security/vendor',dir),{recursive:true});
console.log('Public site prepared in dist; server files are excluded.');
