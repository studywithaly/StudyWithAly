import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {structures,searchStructures,systems} from '../atlas/data.mjs';
import {OBJLoader} from '../atlas/vendor/OBJLoader.js';
import {Box3,Vector3,Raycaster,MeshBasicMaterial,DoubleSide} from '../atlas/vendor/three.module.js';
test('Search covers accents, multilingual names, synonyms and filters',()=>{
 assert.equal(searchStructures('hippocampus')[0].id,'hippocampus');
 assert.equal(searchStructures('épiphyse')[0].id,'pineal');
 assert.equal(searchStructures('medulla oblongata')[0].id,'medulla');
 assert.equal(searchStructures('pneumogastrique')[0].id,'vagus');
 assert.equal(searchStructures('thalamus','stem').length,0);
 assert(searchStructures('','deep').every(s=>s.system==='deep'));
 assert.equal(searchStructures('','all','Temporal médial').length,2);
 assert.equal(searchStructures('<script>')[0],undefined);
});
test('Every registered mesh parses, preserves its hash, source identity and anatomical coordinates',async()=>{
 const registry=JSON.parse(await fs.readFile(new URL('../atlas/models/registry.json',import.meta.url),'utf8'));
 const ids=new Set();let triangles=0;
 for(const m of registry.models){
  assert(structures.some(s=>s.id===m.structure));assert(systems.some(s=>s.id===m.layer));
  assert(!ids.has(m.file));ids.add(m.file);
  const raw=await fs.readFile(new URL('..'+m.url,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),m.sha256);
  const text=raw.toString();assert(text.includes('# File ID : '+m.file));
  const header=text.match(/# Bounds\(mm\): \(([^)]+)\)-\(([^)]+)\)/);assert(header);
  const group=new OBJLoader().parse(text),box=new Box3().setFromObject(group);
  const declared=[...header[1].split(','),...header[2].split(',')].map(Number),actual=[...box.min.toArray(),...box.max.toArray()];
  // Header bounds describe the source before polygon reduction; reduced surfaces differ slightly.
  actual.forEach((v,i)=>assert(Math.abs(v-declared[i])<2,`${m.file} bounds ${i}`));
  assert(box.min.z>1400&&box.max.z<1900,'cranial coordinates retained in millimetres');
  group.traverse(mesh=>{if(mesh.isMesh){triangles+=mesh.geometry.attributes.position.count/3;mesh.geometry.dispose();mesh.material.dispose();}});
 }
 assert.equal(ids.size,35);assert.equal(new Set(registry.models.map(m=>m.structure)).size,19);assert(triangles>10000);
 assert(!registry.models.some(m=>m.structure==='vagus'));
});
test('Real hippocampal geometry supports triangle raycasting',async()=>{
 const text=await fs.readFile(new URL('../atlas/models/FJ1759.obj',import.meta.url),'utf8');
 const group=new OBJLoader().parse(text);group.updateMatrixWorld(true);const mesh=group.children.find(m=>m.isMesh);mesh.material=new MeshBasicMaterial({side:DoubleSide});
 const p=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0),normal=new Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,0);
 const ray=new Raycaster(p.clone().addScaledVector(normal,10),normal.negate());
 assert(ray.intersectObject(group,true).length>0);mesh.geometry.dispose();mesh.material.dispose();
});
