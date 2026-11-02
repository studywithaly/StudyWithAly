// Import supplementary reference bodies separately. Never spatially overlay different individuals.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {Document,NodeIO,Logger} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt,simplify,cloneDocument} from '@gltf-transform/functions';import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';import draco from 'draco3dgltf';
import {regionAt,centerOf} from '../atlas/body-schema.mjs';
const dir=process.argv[2]||'work/anatomy-import';
await Promise.all([MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule(),'meshopt.encoder':MeshoptEncoder});
await fs.mkdir('atlas/assets/supplement',{recursive:true});
const models=[],exclusions=[];
async function convert(file,reference,system,prefix,sourceUrl,filter=()=>true){
 const raw=await fs.readFile(path.join(dir,file)),sourceHash=createHash('sha256').update(raw).digest('hex'),input=await io.readBinary(raw);
 let counter=0;
 for(const node of input.getRoot().listNodes()){
  const mesh=node.getMesh();if(!mesh)continue;const name=node.getExtras().za_name||node.getName();
  if(!filter(name)){exclusions.push({file,node:name,reason:'Not in the explicit peripheral/spinal whitelist; brain and inner-ear components excluded.'});continue;}
  counter++;const id=prefix+'-'+createHash('sha1').update(file+'|'+node.getName()).digest('hex').slice(0,10),matrix=node.getWorldMatrix(),doc=new Document().setLogger(new Logger(Logger.Verbosity.SILENT)),buffer=doc.createBuffer(),output=doc.createMesh(id);
  const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let triangles=0;
  for(const primitive of mesh.listPrimitives()){
   if(primitive.getMode()!==4)continue;const position=primitive.getAttribute('POSITION');if(!position)continue;
   const values=new Float32Array(position.getCount()*3);
   for(let i=0;i<position.getCount();i++){
    const v=position.getElement(i,[]),world=[matrix[0]*v[0]+matrix[4]*v[1]+matrix[8]*v[2]+matrix[12],matrix[1]*v[0]+matrix[5]*v[1]+matrix[9]*v[2]+matrix[13],matrix[2]*v[0]+matrix[6]*v[1]+matrix[10]*v[2]+matrix[14]];
    // Only change axis convention and units. Keep each reference body's own origin and alignment.
    const p=[world[0]*1000,world[2]*1000,world[1]*1000];for(let a=0;a<3;a++){values[i*3+a]=p[a];bounds[a]=Math.min(bounds[a],p[a]);bounds[a+3]=Math.max(bounds[a+3],p[a]);}
   }
   const original=primitive.getIndices()?.getArray()||Uint32Array.from({length:position.getCount()},(_,i)=>i),indices=new Uint32Array(original);
   // Compensate for the axis swap and any negative-scale source instances.
   const det=matrix[0]*(matrix[5]*matrix[10]-matrix[6]*matrix[9])-matrix[4]*(matrix[1]*matrix[10]-matrix[2]*matrix[9])+matrix[8]*(matrix[1]*matrix[6]-matrix[2]*matrix[5]);
   if(det>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
   output.addPrimitive(doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(values).setBuffer(buffer)).setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer)));
   triangles+=indices.length/3;
  }
  if(!triangles)continue;doc.createScene(reference).addChild(doc.createNode(id).setMesh(output));const low=triangles>600?cloneDocument(doc):null;
  await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));const fine=await io.writeBinary(doc),fineUrl=`/atlas/assets/supplement/${id}.glb`;await fs.writeFile('.'+fineUrl,fine);
  const variants={fine:{url:fineUrl,bytes:fine.length,triangles,sha256:createHash('sha256').update(fine).digest('hex')}};
  if(low){await low.transform(simplify({simplifier:MeshoptSimplifier,ratio:.35,error:.0001,lockBorder:true}));const count=low.getRoot().listMeshes()[0].listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0);await low.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));const bytes=await io.writeBinary(low),url=`/atlas/assets/supplement/${id}.low.glb`;await fs.writeFile('.'+url,bytes);variants.coarse={url,bytes:bytes.length,triangles:count,sha256:createHash('sha256').update(bytes).digest('hex')};}else variants.coarse=variants.fine;
  models.push({id,name,system,reference,source:reference,bounds,region:reference==='hra-female'?(file.startsWith('skin')?'body':file.startsWith('kidney')?'abdomen':'pelvis'):regionAt(centerOf(bounds).map((v,i)=>i===2?v*.96-20:v)),side:/\.l$|left/i.test(name)?'left':/\.r$|right/i.test(name)?'right':'midline',license:reference==='z-anatomy'?'CC-BY-SA-4.0':'CC-BY-4.0',sourceUrl,sourceFile:file,sourceSha256:sourceHash,sourceNode:node.getName(),variants});
 }
 console.log(file,counter,'nodes imported');
}
for(const [file,system] of [['skeletal','skeletal'],['muscular','muscular'],['cardiovascular','cardiovascular'],['joints','connective'],['lymphatic','lymphatic'],['nervous','nervous']]){
 await convert(`z-${file}.glb`,'z-anatomy',system,'za-'+file,`https://github.com/nqwrc/3d-anatomy/blob/master/public/models/${file}.glb`,file==='nervous'?name=>/nerve|plexus|gangli|spinal cord|cauda equina|conus medullaris|filum terminale/i.test(name)&&!/cochlea|vestibul|brain|cerebr|hippocamp|fornix|nucleus|nuclei/i.test(name):undefined);
}
const hra=JSON.parse(await fs.readFile(path.join(dir,'hra-sources.json'),'utf8'));
for(const row of hra){const system=row.id.startsWith('skin')?'skin':row.id.startsWith('pelvis')?'skeletal':/kidney|urinary/.test(row.id)?'urinary':'reproductive';await convert(row.file,'hra-female',system,'hra-'+row.id,row.url);}
await fs.writeFile('atlas/catalog/supplement.json',JSON.stringify({version:'supplement-2026-11-02',models,exclusions,hraSources:hra,referencePolicy:'Reference bodies remain separate. Z-Anatomy is not registered onto BodyParts3D; HRA female is not inserted into a male pelvis.'}));
console.log('Supplement total',models.length,'excluded',exclusions.length);
