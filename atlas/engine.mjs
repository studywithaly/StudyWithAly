import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {OBJLoader} from './vendor/OBJLoader.js';

export function createViewer(host,{onHover,onSelect,onStatus}){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.localClippingEnabled=true;
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Atlas 3D : flèches pour tourner, + et − pour zoomer, R pour réinitialiser. La liste des structures offre une alternative textuelle.');host.prepend(canvas);
 const scene=new T.Scene(),root=new T.Group();scene.add(root);
 scene.add(new T.HemisphereLight(0xffffff,0x524365,2.5));
 const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
 const fill=new T.DirectionalLight(0x89bfff,1.5);fill.position.set(-2,0,-2);scene.add(fill);
 const camera=new T.PerspectiveCamera(40,1,.01,10000);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;
 const raycaster=new T.Raycaster(),pointer=new T.Vector2(),objects=new Map();
 const loader=new OBJLoader(),abort=new AbortController();let dead=false,selected=null,hovered=null,frame=0,bounds=null,clip=null,isolated=null;
 const state={layers:{},hidden:new Set(),hemisphere:'all',revision:false};
 const render=()=>{if(!dead){renderer.render(scene,camera);}};
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h||dead)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
 const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',render);
 function each(fn){objects.forEach((group,id)=>group.traverse(o=>{if(o.isMesh)fn(o,id,group);}));}
 function apply(){each((mesh,id,group)=>{const layer=state.layers[group.userData.layer]||{visible:true,opacity:1};const side=mesh.userData.side;
   mesh.visible=layer.visible&&layer.opacity>0&&!state.hidden.has(id)&&(!isolated||isolated===id)&&(state.hemisphere==='all'||side!==state.hemisphere);
   mesh.material.opacity=layer.opacity;mesh.material.transparent=layer.opacity<1;mesh.material.depthWrite=layer.opacity>=1;
   mesh.material.emissive.setHex(id===selected?0x56438b:id===hovered?0x444477:0x000000);
   mesh.material.clippingPlanes=clip?[clip]:[];
 });render();}
 function focus(id){const group=objects.get(id);if(!group)return;const box=new T.Box3().setFromObject(group);frameBox(box);}
 function frameBox(box){if(box.isEmpty())return;const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()).length();const direction=new T.Vector3(0,-1,.35).normalize();controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,Math.max(size,.5)*1.65);controls.minDistance=Math.max(size*.025,.01);controls.maxDistance=Math.max(size*20,10);camera.near=Math.max(size/1000,.001);camera.far=Math.max(size*100,100);camera.updateProjectionMatrix();controls.update();render();}
 function reset(){if(bounds)frameBox(bounds);}
 function pick(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const meshes=[];each(m=>{if(m.visible)meshes.push(m);});
   const hit=raycaster.intersectObjects(meshes,false).find(hit=>!clip||clip.distanceToPoint(hit.point)>=0);return hit?.object.userData.structure||null;}
 const move=e=>{if(e.pointerType==='touch')return;hovered=pick(e);apply();onHover(hovered,e);};
 const leave=()=>{hovered=null;apply();onHover(null);};let down=null;
 const start=e=>{down={x:e.clientX,y:e.clientY};};
 const end=e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const id=pick(e);if(id)onSelect(id);}down=null;};
 const key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','r','R'].includes(e.key)){e.preventDefault();const offset=camera.position.clone().sub(controls.target);if(e.key.startsWith('Arrow')){const axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?new T.Vector3(0,0,1):new T.Vector3(1,0,0);offset.applyAxisAngle(axis,['ArrowLeft','ArrowUp'].includes(e.key)?.12:-.12);}else if(e.key==='r'||e.key==='R'){reset();return;}else offset.multiplyScalar(e.key==='-'?1.1:.9);camera.position.copy(controls.target).add(offset);controls.update();render();}};
 canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointerup',end);canvas.addEventListener('keydown',key);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onStatus('Le contexte graphique a été perdu. Revenez dans l’Atlas pour recharger la vue.');});
 return {
   async load(registry){
     let complete=0,failures=0;
     // Bounded concurrency prevents a spike in parser and GPU memory usage.
     const queue=registry.models.slice();
     await Promise.all(Array.from({length:3},async()=>{while(queue.length&&!dead){const item=queue.shift();try{
       const response=await fetch(item.url,{signal:abort.signal});if(!response.ok)throw Error(response.status);
       const text=await response.text();if(dead)return;const group=loader.parse(text);group.userData.layer=item.layer;
       group.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeVertexNormals();mesh.material.dispose();mesh.material=new T.MeshStandardMaterial({color:item.color,roughness:.7,side:T.DoubleSide});mesh.userData.structure=item.structure;mesh.userData.side=item.side||'midline';}});
       if(objects.has(item.structure)){const existing=objects.get(item.structure);while(group.children.length)existing.add(group.children[0]);}else{objects.set(item.structure,group);root.add(group);}
       complete++;apply();
     }catch(e){if(!dead)failures++;}if(!dead)onStatus(`${complete} objets chargés${failures?` · ${failures} échec(s)` : ''}`);}}));
     if(dead)return;bounds=new T.Box3().setFromObject(root);reset();resize();return {loaded:[...objects.keys()],failures};
   },
   layers(layers){state.layers=layers;apply();},
   select(id){selected=id;isolated=null;state.hidden.delete(id);apply();focus(id);},
   isolate(id){isolated=isolated===id?null:id;apply();if(id)focus(id);},
   hide(id){state.hidden.add(id);apply();},
   restore(){isolated=null;state.hidden.clear();state.hemisphere='all';apply();reset();},
   hemisphere(side){state.hemisphere=side;apply();},
   cut(axis,fraction){if(!axis||!bounds)clip=null;else{const normal=new T.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);clip=new T.Plane(normal,-(bounds.min[axis]+(bounds.max[axis]-bounds.min[axis])*fraction));}apply();},
   reset,
   dispose(){dead=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();each(m=>{m.geometry.dispose();m.material.dispose();});renderer.dispose();renderer.forceContextLoss();canvas.remove();objects.clear();}
 };
}
