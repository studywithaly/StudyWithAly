import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {OBJLoader} from './vendor/OBJLoader.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';
import {AnatomicalAssetCache} from './asset-cache.mjs';
import {bodySystems,canonicalSystem} from './body-schema.mjs';

export function createViewer(host,{onHover=()=>{},onSelect=()=>{},onExplore=()=>{},onZoom=()=>{},onStatus=()=>{}}={}){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.localClippingEnabled=true;
 const canvas=renderer.domElement;canvas.tabIndex=0;
 canvas.setAttribute('aria-label','Atlas 3D : glisser pour tourner, molette pour explorer la région visée, double-clic pour entrer. Flèches : rotation ; + et − : zoom ; R : caméra. Les listes permettent une navigation au clavier.');host.prepend(canvas);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.01,20000);camera.up.set(0,0,1);
 scene.add(new T.HemisphereLight(0xffffff,0x524365,2.5));
 const keyLight=new T.DirectionalLight(0xffffff,3);keyLight.position.set(1,-2,3);scene.add(keyLight);
 const fill=new T.DirectionalLight(0x89bfff,1.5);fill.position.set(-2,1,-2);scene.add(fill);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.zoomToCursor=true;
 const cache=new AnatomicalAssetCache(),gltf=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),obj=new OBJLoader();
 const raycaster=new T.Raycaster(),pointer=new T.Vector2();
 let dead=false,root=new T.Group(),groups=new Map(),sceneBounds=null,clip=null,contextPlanes=[],selected=null,hovered=null,isolated=null,generation=0,animation=0,initialized=false;
 scene.add(root);let selection=new Set(),isolation=null;const state={layers:{},hidden:new Set(),hemisphere:'all'};
 function disposeRoot(group){const geometry=new Set(),materials=new Set();group.traverse(m=>{if(m.isMesh){geometry.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(group);}
 function finishAnimation(){cancelAnimationFrame(animation);animation=0;}
 function render(){if(!dead)renderer.render(scene,camera);}
 function resize(){if(dead||!host.clientWidth||!host.clientHeight)return;renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();render();}
 const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',render);controls.addEventListener('start',finishAnimation);
 function each(fn,map=groups){map.forEach((group,id)=>group.traverse(m=>{if(m.isMesh)fn(m,id,group);}));}
 function apply(){const planes=contextPlanes.concat(clip?[clip]:[]);each((mesh,id,group)=>{const layer=state.layers[canonicalSystem(group.userData.layer)]||state.layers[group.userData.layer]||{visible:true,opacity:1};mesh.visible=layer.visible&&layer.opacity>0&&!state.hidden.has(id)&&(!isolation||isolation.has(id))&&(state.hemisphere==='all'||mesh.userData.side!==state.hemisphere);mesh.material.opacity=layer.opacity*(mesh.userData.baseOpacity??1);mesh.material.transparent=mesh.material.opacity<.999;mesh.material.depthWrite=mesh.material.opacity>=.999;mesh.material.emissive.setHex(selection.has(id)?0x604a96:id===hovered?0x47436b:0x000000);mesh.material.clippingPlanes=planes;});render();}
 function framedView(box){const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),fov=T.MathUtils.degToRad(camera.fov/2),distance=Math.max(size.z/(2*Math.tan(fov)),size.x/(2*Math.tan(fov)*Math.max(camera.aspect,.3)),size.y*1.6,.3)*1.2;const direction=initialized?camera.position.clone().sub(controls.target).normalize():new T.Vector3(0,-1,.08).normalize();return {position:center.clone().addScaledVector(direction,distance).toArray(),target:center.toArray()};}
 function moveTo(view,box,smooth=true){
  finishAnimation();const diagonal=Math.max(box.getSize(new T.Vector3()).length(),.1);camera.near=Math.max(diagonal/10000,.001);camera.far=Math.max(diagonal*50,3000);camera.updateProjectionMatrix();controls.minDistance=diagonal*.003;controls.maxDistance=diagonal*15;
  const fromPosition=camera.position.clone(),fromTarget=controls.target.clone(),toPosition=new T.Vector3().fromArray(view.position),toTarget=new T.Vector3().fromArray(view.target);
  if(!smooth||!initialized){camera.position.copy(toPosition);controls.target.copy(toTarget);controls.update();initialized=true;render();return;}
  const start=performance.now();const step=now=>{if(dead)return;const t=Math.min(1,(now-start)/650),k=t*t*(3-2*t);camera.position.lerpVectors(fromPosition,toPosition,k);controls.target.lerpVectors(fromTarget,toTarget,k);controls.update();if(t<1)animation=requestAnimationFrame(step);else animation=0;render();};animation=requestAnimationFrame(step);
 }
 function focus(id){const group=groups.get(id);if(!group)return;const box=new T.Box3().setFromObject(group);if(!box.isEmpty())moveTo(framedView(box),box);}
 function focusMembers(ids){const box=new T.Box3();for(const id of ids){const group=groups.get(id);if(group)box.union(new T.Box3().setFromObject(group));}if(!box.isEmpty())moveTo(framedView(box),box);}
 function reset(){if(sceneBounds)moveTo(framedView(sceneBounds),sceneBounds);}
 function pick(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const meshes=[];each(m=>{if(m.visible)meshes.push(m);});const planes=contextPlanes.concat(clip?[clip]:[]),hits=raycaster.intersectObjects(meshes,false).filter(hit=>planes.every(p=>p.distanceToPoint(hit.point)>=0));const hit=hits.find(h=>h.object.material.opacity>=.45)||hits[0];return hit?{id:hit.object.userData.structure,point:hit.point.toArray()}:null;}
 let down=null,gesture=false,lastTap=null,lastHit=null;const pointers=new Set();
 const move=e=>{if(e.pointerType==='touch'||pointers.size)return;const hit=pick(e);hovered=hit?.id||null;lastHit=hit?{...hit,x:e.clientX,y:e.clientY,time:performance.now()}:null;apply();onHover(hit?.id||null,e,hit?.point);};
 const leave=()=>{hovered=null;apply();onHover(null);};
 const start=e=>{pointers.add(e.pointerId);if(pointers.size>1){gesture=true;down=null;}else down={id:e.pointerId,x:e.clientX,y:e.clientY};};
 const end=e=>{if(!gesture&&down?.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const hit=pick(e);if(hit){onSelect(hit.id,{point:hit.point,fromCanvas:true});if(e.pointerType==='touch'&&lastTap?.id===hit.id&&performance.now()-lastTap.time<330)onExplore(hit.id,hit.point);lastTap={id:hit.id,time:performance.now()};}}pointers.delete(e.pointerId);down=null;if(!pointers.size)gesture=false;};
 const cancel=e=>{pointers.delete(e.pointerId);down=null;if(!pointers.size)gesture=false;};
 const dblclick=e=>{const hit=pick(e);if(hit)onExplore(hit.id,hit.point);};
 const wheel=e=>{if(dead)return;let hit=pick(e);if(!hit&&lastHit&&performance.now()-lastHit.time<650&&Math.hypot(e.clientX-lastHit.x,e.clientY-lastHit.y)<25)hit=lastHit;if(hit)lastHit={...hit,x:e.clientX,y:e.clientY,time:performance.now()};const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?host.clientHeight:1);requestAnimationFrame(()=>{if(!dead)onZoom({id:hit?.id,point:hit?.point,delta,distance:hit?camera.position.distanceTo(new T.Vector3().fromArray(hit.point)):null,position:camera.position.toArray(),target:controls.target.toArray(),time:performance.now()});});};
 const key=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','r','R'].includes(e.key))return;e.preventDefault();finishAnimation();const offset=camera.position.clone().sub(controls.target);if(e.key.startsWith('Arrow'))offset.applyAxisAngle(e.key==='ArrowLeft'||e.key==='ArrowRight'?new T.Vector3(0,0,1):new T.Vector3(1,0,0),['ArrowLeft','ArrowUp'].includes(e.key)?.12:-.12);else if(e.key.toLowerCase()==='r'){reset();return;}else offset.multiplyScalar(e.key==='-'?1.1:.9);camera.position.copy(controls.target).add(offset);controls.update();render();};
 for(const [name,handler] of [['pointermove',move],['pointerleave',leave],['pointerdown',start],['pointerup',end],['pointercancel',cancel],['dblclick',dblclick],['keydown',key]])canvas.addEventListener(name,handler);
 canvas.addEventListener('wheel',wheel,{capture:true,passive:true});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!dead)onStatus('Contexte graphique perdu. Réouvrez l’Atlas pour recharger la vue.');});resize();
 async function parseModel(model,detail,signal){
  const asset=model.variants?.[detail]||model.variants?.fine||{url:model.url,sha256:model.sha256},bytes=await cache.get(asset,signal);let group;
  if(asset.url.endsWith('.obj'))group=obj.parse(new TextDecoder().decode(bytes));else group=(await gltf.parseAsync(bytes.slice(0),'')).scene;
  group.userData.layer=model.system||model.layer;group.userData.model=model;
  group.traverse(mesh=>{if(!mesh.isMesh)return;(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());mesh.geometry.computeVertexNormals();const color=model.color||(/vein|venous|vena /i.test(model.name||'')?'#7195d1':null)||bodySystems.find(s=>s.id===canonicalSystem(model.system||model.layer))?.color||'#aaa';mesh.material=new T.MeshStandardMaterial({color,roughness:.68,side:T.DoubleSide});mesh.userData.structure=model.structure||model.id;mesh.userData.side=model.side||'midline';mesh.userData.baseOpacity=/cavity of|ventricular system|central canal/i.test(model.name||'')?.16:1;});return group;
 }
 async function showScene(node,models,{signal,view=null}={}){
  const token=++generation,nextRoot=new T.Group(),nextGroups=new Map(),queue=models.slice();let count=0,failures=0;
  await Promise.all(Array.from({length:4},async()=>{while(queue.length&&!dead&&!signal?.aborted&&token===generation){const model=queue.shift();try{const group=await parseModel(model,['body','reference','system'].includes(node.kind)?'coarse':'fine',signal);if(dead||signal?.aborted||token!==generation){disposeRoot(group);return;}const id=model.structure||model.id;if(nextGroups.has(id)){const existing=nextGroups.get(id);while(group.children.length)existing.add(group.children[0]);}else{nextGroups.set(id,group);nextRoot.add(group);}group.traverse(mesh=>{if(!mesh.isMesh)return;const name=model.name||'';if(node.id==='heart'&&/wall of/i.test(name))mesh.userData.baseOpacity=.25;if(node.id==='brain'&&/white matter of.*cerebral|occipital lobe|precentral|postcentral/.test(name.toLowerCase()))mesh.userData.baseOpacity=.32;if(node.kind==='region'&&node.id.endsWith('head')&&['skeletal','muscular'].includes(canonicalSystem(model.system)))mesh.userData.baseOpacity=.22;});count++;}catch(error){if(signal?.aborted)return;if(!failures)console.error('Atlas asset',model.id,error);failures++;}if(!dead&&token===generation)onStatus(`Préparation de ${node.name} · ${count}/${models.length} objets${failures?` · ${failures} échec(s)`:''}`);}}));
  if(dead||signal?.aborted||token!==generation){disposeRoot(nextRoot);throw new DOMException('Navigation annulée','AbortError');}if(models.length&&!count){disposeRoot(nextRoot);throw new Error('Aucun modèle n’a pu être chargé.');}
  finishAnimation();const old=root;root=nextRoot;groups=nextGroups;scene.add(root);selected=null;selection.clear();isolation=null;hovered=null;isolated=null;state.hidden.clear();state.hemisphere='all';clip=null;
  const bound=node.bounds;sceneBounds=bound?new T.Box3(new T.Vector3(...bound.slice(0,3)),new T.Vector3(...bound.slice(3))):new T.Box3().setFromObject(root);
  contextPlanes=node.kind==='region'?[
   new T.Plane(new T.Vector3(1,0,0),-bound[0]),new T.Plane(new T.Vector3(-1,0,0),bound[3]),new T.Plane(new T.Vector3(0,1,0),-bound[1]),new T.Plane(new T.Vector3(0,-1,0),bound[4]),new T.Plane(new T.Vector3(0,0,1),-bound[2]),new T.Plane(new T.Vector3(0,0,-1),bound[5])
  ]:[];
  // Keep the current scene during transfer. Swap only after the replacement is ready, then free its GPU resources.
  disposeRoot(old);resize();apply();if(!sceneBounds.isEmpty())moveTo(view||framedView(sceneBounds),sceneBounds);
  return {loaded:[...groups.keys()],failures,objects:count,requested:models.length,lod:['body','reference','system'].includes(node.kind)?'Vue d’ensemble':'Détail anatomique'};
 }
 return {
  showScene,
  load(registry){const abort=new AbortController();return showScene({name:'Encéphale',kind:'organ'},registry.models,{signal:abort.signal});},
  preload(models,signal){return cache.preload(models,signal);},layers(layers){state.layers=layers;apply();},
  select(id,{center=true,members=[]}={}){selected=id;selection=new Set([id,...members]);selection.forEach(id=>state.hidden.delete(id));apply();if(center)focusMembers(selection);},
  isolate(id,members=[]){isolated=isolated===id?null:id;isolation=isolated?new Set([id,...members]):null;apply();if(isolation)focusMembers(isolation);},hide(id,members=[]){[id,...members].forEach(id=>state.hidden.add(id));apply();},
  restore(){isolated=null;isolation=null;state.hidden.clear();state.hemisphere='all';apply();reset();},hemisphere(side){state.hemisphere=side;apply();},
  cut(axis,fraction){if(!axis||!sceneBounds)clip=null;else{const normal=new T.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);clip=new T.Plane(normal,-(sceneBounds.min[axis]+(sceneBounds.max[axis]-sceneBounds.min[axis])*fraction));}apply();},
  camera(){return {position:camera.position.toArray(),target:controls.target.toArray()};},reset,
  dispose(){dead=true;generation++;finishAnimation();observer.disconnect();controls.dispose();disposeRoot(root);cache.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();groups.clear();}
 };
}

