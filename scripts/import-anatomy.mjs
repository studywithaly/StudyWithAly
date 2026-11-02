// Reproducible extraction of selected original OBJ entries using HTTP ranges.
// Usage: node scripts/import-anatomy.mjs <directory containing entries.json, parts.tsv, elements.tsv>
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {structures,systems} from '../atlas/data.mjs';
const exec=promisify(execFile),dir=process.argv[2]||'work/anatomy-import';
const archive='https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip';
await fs.mkdir(dir,{recursive:true});
async function download(name,url,range){await exec('curl.exe',['-fsSL','--retry','3','--max-time','120',...(range?['--range',range]:[]),'--output',path.join(dir,name),url]);}
try{await fs.access(path.join(dir,'entries.json'));}catch{
 await download('tail.zip',archive,'-65536');
 const tail=await fs.readFile(path.join(dir,'tail.zip')),end=tail.lastIndexOf(Buffer.from([80,75,5,6]));
 if(end<0)throw Error('ZIP end directory not found.');
 const size=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16);
 await download('central.bin',archive,`${offset}-${offset+size-1}`);
 const central=await fs.readFile(path.join(dir,'central.bin')),index=[];
 for(let i=0;i+46<=central.length&&central.readUInt32LE(i)===0x02014b50;){const n=central.readUInt16LE(i+28),x=central.readUInt16LE(i+30),c=central.readUInt16LE(i+32);index.push({name:central.toString('utf8',i+46,i+46+n),size:central.readUInt32LE(i+20),offset:central.readUInt32LE(i+42)});i+=46+n+x+c;}
 await fs.writeFile(path.join(dir,'entries.json'),JSON.stringify(index));
}
for(const [name,source] of [['parts.tsv','isa_parts_list_e.txt'],['elements.tsv','isa_element_parts.txt']]){try{await fs.access(path.join(dir,name));}catch{await download(name,'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/'+source);}}
const entries=JSON.parse(await fs.readFile(path.join(dir,'entries.json'),'utf8'));
const parts=(await fs.readFile(path.join(dir,'parts.tsv'),'utf8')).split(/\r?\n/).map(l=>l.split('\t'));
const elements=(await fs.readFile(path.join(dir,'elements.tsv'),'utf8')).split(/\r?\n/).map(l=>l.split('\t'));
const models=[];
for(const s of structures){
 const concepts=parts.filter(p=>p[2]===s.en||(s.id==='white'&&/^(left|right) white matter/.test(p[2]))||s.id==='white'&&/^white matter of (left|right) cerebral hemisphere$/.test(p[2]));
 for(const concept of concepts){for(const e of elements.filter(e=>e[0]===concept[0])){
  if(models.some(m=>m.file===e[2]))continue;
  const entry=entries.find(x=>x.name.endsWith('/'+e[2]+'.obj'));if(!entry)continue;
  const left=elements.some(x=>x[2]===e[2]&&x[1]?.startsWith('left ')),right=elements.some(x=>x[2]===e[2]&&x[1]?.startsWith('right '));
  models.push({structure:s.id,file:e[2],fma:concept[0],layer:s.system,color:systems.find(x=>x.id===s.system)?.color||'#ddd',side:left?'left':right?'right':'midline',entry});
 }}
}
await fs.mkdir('atlas/models',{recursive:true});
const queue=models.slice();
await Promise.all(Array.from({length:4},async()=>{while(queue.length){const m=queue.shift(),temp=path.join(dir,m.file+'.bin');
 await exec('curl.exe',['-fsSL','--retry','3','--max-time','90','--range',`${m.entry.offset}-${m.entry.offset+30+200+m.entry.size}`,'--output',temp,archive]);
 const raw=await fs.readFile(temp);if(raw.readUInt32LE(0)!==0x04034b50)throw Error('Invalid ZIP local entry '+m.file);
 const start=30+raw.readUInt16LE(26)+raw.readUInt16LE(28),data=raw.subarray(start,start+m.entry.size);
 const obj=raw.readUInt16LE(8)===8?inflateRawSync(data):data;
 if(!/^v /m.test(obj.toString()))throw Error('No vertices '+m.file);
 await fs.writeFile(`atlas/models/${m.file}.obj`,obj);
 m.sha256=createHash('sha256').update(obj).digest('hex');m.bytes=obj.length;m.url=`/atlas/models/${m.file}.obj`;m.archiveEntry=m.entry.name;delete m.entry;
 console.log(m.file,m.structure,obj.length);
}}));
await fs.writeFile('atlas/models/registry.json',JSON.stringify({version:'BodyParts3D 4.0 / isa 99%',archive,imported:'2026-11-02',license:'CC-BY-4.0',licenseUrl:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',validation:'Source mappings verified; no independent clinical validation. Original coordinates and geometry retained.',models},null,2)+'\n');
