// Convert the official BodyParts3D archive to individually addressable, compressed, aligned GLB assets.
// node scripts/build-body-assets.mjs <source directory> [limit]
import fs from 'node:fs/promises';import path from 'node:path';import {inflateRawSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {Document,NodeIO,Logger} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt,simplify,cloneDocument} from '@gltf-transform/functions';import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import {inferSystem,regionAt,centerOf} from '../atlas/body-schema.mjs';
const dir=process.argv[2]||'work/anatomy-import',limit=Number(process.argv[3])||Infinity;
const zip=await fs.readFile(path.join(dir,'bodyparts.zip')),entries=JSON.parse(await fs.readFile(path.join(dir,'entries.json'),'utf8'));
const table=async f=>(await fs.readFile(path.join(dir,f),'utf8')).trim().split(/\r?\n/).slice(1).map(l=>l.split('\t'));
const isa=await table('elements.tsv'),part=await table('partof-elements.tsv');
const memberships=new Map();for(const [fma,name,file] of [...isa,...part]){if(!memberships.has(file))memberships.set(file,[]);memberships.get(file).push({fma,name});}
const counts=new Map();for(const rows of memberships.values())for(const r of rows)counts.set(r.fma,(counts.get(r.fma)||0)+1);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
await Promise.all([MeshoptEncoder.ready,MeshoptSimplifier.ready]);
await fs.mkdir('atlas/assets/body',{recursive:true});await fs.mkdir('atlas/catalog',{recursive:true});
const models=[];let total=0;
for(const e of entries.filter(e=>e.name.endsWith('.obj')).slice(0,limit)){
 const file=e.name.split('/').pop().replace('.obj',''),o=e.offset,start=o+30+zip.readUInt16LE(o+26)+zip.readUInt16LE(o+28);
 const raw=inflateRawSync(zip.subarray(start,start+e.size)),text=raw.toString(),field=key=>text.match(new RegExp('^#[ \\t]*'+key+'[ \\t]*:[ \\t]*([^\\r\\n]*)','m'))?.[1].trim();
 const parents=memberships.get(file)||[],fallback=parents.toSorted((a,b)=>counts.get(a.fma)-counts.get(b.fma))[0];
 const name=field('English name')||fallback?.name||`Source structure ${file}`,fma=field('Concept ID')||fallback?.fma||null;
 const p=[],indices=[];for(const line of text.split(/\r?\n/)){if(line.startsWith('v '))p.push(...line.slice(2).trim().split(/\s+/).map(Number));else if(line.startsWith('f ')){const v=line.slice(2).trim().split(/\s+/).map(x=>{const i=Number(x.split('/')[0]);return i<0?p.length/3+i:i-1;});for(let i=1;i<v.length-1;i++)indices.push(v[0],v[i],v[i+1]);}}
 if(!p.length||!indices.length)throw Error('Empty source '+file);
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++) {const a=i%3;bounds[a]=Math.min(bounds[a],p[i]);bounds[a+3]=Math.max(bounds[a+3],p[i]);}
 const doc=new Document().setLogger(new Logger(Logger.Verbosity.SILENT)),buffer=doc.createBuffer();
 const position=doc.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buffer);
 const index=doc.createAccessor().setType('SCALAR').setArray(p.length/3<65536?new Uint16Array(indices):new Uint32Array(indices)).setBuffer(buffer);
 const primitive=doc.createPrimitive().setAttribute('POSITION',position).setIndices(index),mesh=doc.createMesh(file).addPrimitive(primitive),node=doc.createNode(file).setMesh(mesh);doc.createScene('BodyParts3D').addChild(node);
 const low=indices.length>1800?cloneDocument(doc):null;
 await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
 const fine=await io.writeBinary(doc),finePath=`atlas/assets/body/${file}.glb`;await fs.writeFile(finePath,fine);
 const variants={fine:{url:'/'+finePath,bytes:fine.length,sha256:createHash('sha256').update(fine).digest('hex'),triangles:indices.length/3}};
 if(low){await low.transform(simplify({simplifier:MeshoptSimplifier,ratio:.35,error:.0001,lockBorder:true}));const triangles=low.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount()/3;await low.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));const bytes=await io.writeBinary(low),lowPath=`atlas/assets/body/${file}.low.glb`;await fs.writeFile(lowPath,bytes);variants.coarse={url:'/'+lowPath,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),triangles};}
 else variants.coarse=variants.fine;
 const row={id:file,name,fma,bounds,memberships:parents};const system=inferSystem(row);
 models.push({id:file,name,fma,bounds,system,region:regionAt(centerOf(bounds)),side:/^left /i.test(name)?'left':/^right /i.test(name)?'right':'midline',memberships:[...new Set(parents.map(p=>p.fma))],source:'bp4',sourceEntry:e.name,sourceSha256:createHash('sha256').update(raw).digest('hex'),sourceBytes:raw.length,variants});
 total+=fine.length+(variants.coarse===variants.fine?0:variants.coarse.bytes);
 if(models.length%100===0)console.log(`${models.length} meshes · ${(total/1e6).toFixed(1)} MB`);
}
await fs.writeFile('atlas/catalog/body.json',JSON.stringify({version:'bp4-body-2026-11-02',units:'mm',up:'Z',source:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',license:'CC-BY-4.0',licenseUrl:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',derived:'GLB/Meshopt, 16-bit quantization; coarse LOD simplified within 0.01% of source radius. No individual spatial repositioning.',models}));
console.log('Done',models.length,(total/1e6).toFixed(1)+' MB');
