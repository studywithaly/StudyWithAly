import {structures,sources} from './data.mjs';
import {bodySystems,regions,bodyBounds,centerOf,inside,regionAt,canonicalSystem} from './body-schema.mjs';
import {bodyReferences,organContent} from './body-content.mjs';

const translations={
 'skin':'Peau','heart':'Cœur','brain':'Encéphale','liver':'Foie','stomach':'Estomac','pancreas':'Pancréas','spleen':'Rate','kidney':'Rein','urinary bladder':'Vessie','testis':'Testicule','prostate':'Prostate','gallbladder':'Vésicule biliaire','trachea':'Trachée',
 'femur':'Fémur','humerus':'Humérus','radius':'Radius','ulna':'Ulna','tibia':'Tibia','fibula':'Fibula','talus':'Talus','calcaneus':'Calcanéus','scaphoid':'Scaphoïde','mandible':'Mandibule','scapula':'Scapula','clavicle':'Clavicule','patella':'Patella',
 'sciatic nerve':'Nerf sciatique','median nerve':'Nerf médian','ulnar nerve':'Nerf ulnaire','radial nerve':'Nerf radial','femoral nerve':'Nerf fémoral','vagus nerve':'Nerf vague','tibial nerve':'Nerf tibial','common fibular nerve':'Nerf fibulaire commun','phrenic nerve':'Nerf phrénique','brachial plexus':'Plexus brachial',
 'white matter of spinal cord':'Substance blanche de la moelle','anterior horn of spinal cord':'Corne antérieure de la moelle','posterior horn of spinal cord':'Corne postérieure de la moelle',
 'wall of ventricle':'Paroi ventriculaire','wall of atrium':'Paroi atriale','wall of right atrium':'Paroi de l’oreillette droite','wall of left atrium':'Paroi de l’oreillette gauche','cavity of right ventricle':'Cavité du ventricule droit','cavity of left ventricle':'Cavité du ventricule gauche',
 'cavity of right atrium':'Cavité de l’oreillette droite','cavity of left atrium':'Cavité de l’oreillette gauche','anterior leaflet of mitral valve':'Feuillet antérieur de la valve mitrale','posterior leaflet of mitral valve':'Feuillet postérieur de la valve mitrale',
 'body of uterus':'Corps de l’utérus','fundus of uterus':'Fond utérin','cervix':'Col de l’utérus','ovary':'Ovaire','uterine tube':'Trompe utérine','fallopian tube':'Trompe utérine','pelvis':'Bassin osseux','thyroid gland':'Thyroïde','adrenal gland':'Glande surrénale',
 'body of sternum':'Corps du sternum','aorta':'Aorte','ascending aorta':'Aorte ascendante','abdominal aorta':'Aorte abdominale','tibialis anterior':'Tibial antérieur','biceps brachii':'Biceps brachial','deltoid':'Deltoïde','achilles tendon':'Tendon calcanéen','calcaneal tendon':'Tendon calcanéen'
};
export function anatomicalLabel(name){
 let text=name.replace(/^VH_F_/,'').replace(/_/g,' ').trim(),side='';
 if(/^left /i.test(text)||/\.l$/.test(text)){side=' gauche';text=text.replace(/^left /i,'').replace(/\.l$/,'');}
 if(/^right /i.test(text)||/\.r$/.test(text)){side=' droit';text=text.replace(/^right /i,'').replace(/\.r$/,'');}
 const translated=translations[text.toLowerCase()];return translated?translated+side:name.replace(/^VH_F_/,'').replace(/_/g,' ');
}
const organSpecs=[
 ['brain','Encéphale','head',['FMA50801'],'nervous'],['heart','Cœur','thorax',['FMA7088'],'cardiovascular'],
 ['lung-left','Poumon gauche','thorax',['FMA7310'],'respiratory'],['lung-right','Poumon droit','thorax',['FMA7309'],'respiratory'],
 ['kidney-left','Rein gauche','abdomen',['FMA7205'],'urinary'],['kidney-right','Rein droit','abdomen',['FMA7204'],'urinary'],
 ['liver','Foie','abdomen',['FMA7197'],'digestive'],['stomach','Estomac','abdomen',['FMA7148'],'digestive'],['pancreas','Pancréas','abdomen',['FMA7198'],'digestive'],
 ['bladder','Vessie','pelvis',['FMA15900'],'urinary'],
 ['valves','Valves cardiaques','heart',['FMA7234','FMA7235','FMA7236','FMA7246'],'cardiovascular'],
 ['mitral-valve','Valve mitrale','valves',['FMA7235'],'cardiovascular'],['aortic-valve','Valve aortique','valves',['FMA7236'],'cardiovascular'],
 ['tricuspid-valve','Valve tricuspide','valves',['FMA7234'],'cardiovascular'],['pulmonary-valve','Valve pulmonaire','valves',['FMA7246'],'cardiovascular']
];
const referenceNames={'bp4':'BodyParts3D · corps masculin','z-anatomy':'Z-Anatomy · référence neuromusculaire','hra-female':'HRA · référence féminine'};
export const intersects=(a,b)=>[0,1,2].every(i=>a[i]<=b[i+3]&&a[i+3]>=b[i]);
export function unionBounds(models){if(!models.length)return null;return models.reduce((b,m)=>b.map((v,i)=>i<3?Math.min(v,m.bounds[i]):Math.max(v,m.bounds[i])),models[0].bounds.slice());}

export function createHierarchy(body,supplement,legacy){
 const aliases=new Map(legacy.models.map(m=>[m.file,m.structure]));
 const models=[...body.models.map(m=>({...m,reference:'bp4',structure:aliases.get(m.id)||m.id})),...supplement.models.map(m=>({...m,structure:m.id}))];
 const byModel=new Map(models.map(m=>[m.id,m])),nodes=new Map();
 const add=n=>{n.children=[];n.available=!!n.models?.length||n.kind==='region'||n.kind==='system';nodes.set(n.id,n);return n;};
 add({id:'body',name:'Corps humain',kind:'body',parent:null,reference:'bp4',bounds:bodyBounds,models:models.filter(m=>m.reference==='bp4').map(m=>m.id),description:'Référence masculine BodyParts3D. Masquez la peau, combinez les systèmes, puis explorez une région.'});
 for(const r of regions)add({...r,reference:'bp4',models:models.filter(m=>m.reference==='bp4'&&intersects(m.bounds,r.bounds)).map(m=>m.id),description:'Région anatomique dans le repère du corps de référence.'});
 for(const [id,name,parent,fmas,system] of organSpecs){const matches=models.filter(m=>m.reference==='bp4'&&m.memberships?.some(f=>fmas.includes(f)));if(matches.length)add({id,name,parent,system,kind:'organ',reference:'bp4',models:matches.map(m=>m.id),bounds:unionBounds(matches),description:'Assemblage des sous-structures réelles présentes dans la source.'});}
 for(const [id,name,pattern,region,system] of [
 ['biceps-left','Biceps brachial gauche',/left biceps brachii|(?:short|long) head of left biceps brachii/i,'arm-left','muscular'],
 ['biceps-right','Biceps brachial droit',/right biceps brachii|(?:short|long) head of right biceps brachii/i,'arm-right','muscular'],
 ['femur-left','Fémur gauche',/^left femur$/i,'leg-left','skeletal'],['femur-right','Fémur droit',/^right femur$/i,'leg-right','skeletal']
 ]){const matches=models.filter(m=>m.reference==='bp4'&&pattern.test(m.name));if(matches.length)add({id,name,parent:region,kind:'organ',reference:'bp4',system,models:matches.map(m=>m.id),bounds:unionBounds(matches)});}
 // Keep all previously integrated brain identities and progression keys.
 for(const s of structures.filter(s=>legacy.models.some(m=>m.structure===s.id))){const matches=models.filter(m=>m.structure===s.id&&m.reference==='bp4');if(matches.length)add({id:s.id,name:s.fr,parent:'brain',kind:'structure',reference:'bp4',system:canonicalSystem(s.system),models:matches.map(m=>m.id),bounds:unionBounds(matches)});}
 for(const [reference,root] of [['z-anatomy','z-body'],['hra-female','female-body']]){
  const list=models.filter(m=>m.reference===reference);if(!list.length)continue;
  const bound=unionBounds(list);add({id:root,name:referenceNames[reference],parent:'body',kind:'reference',reference,bounds:bound,models:list.map(m=>m.id),description:reference==='z-anatomy'?'Référence Z-Anatomy distincte : nerfs périphériques, moelle, squelette, muscles, vaisseaux et lymphatiques. Les composants cérébraux et d’oreille interne à licence incertaine ou non commerciale sont exclus.':'Référence féminine HRA / Visible Human Female. Peau, bassin et organes importés ; squelette et musculature féminins complets encore absents.'});
  if(reference==='z-anatomy')for(const r of regions){const b=r.bounds.map((v,i)=>i===2||i===5?(v+20)/.96:v);add({...r,id:'z-'+r.id,parent:root,reference,bounds:b,models:list.filter(m=>intersects(m.bounds,b)).map(m=>m.id)});}
  if(reference==='hra-female')for(const source of supplement.hraSources){const subset=list.filter(m=>m.sourceFile===source.file);if(!subset.length||source.id.startsWith('skin'))continue;add({id:'hra-'+source.id,name:anatomicalLabel(source.id.replace(/-female(?:-left|-right)?$/,'').replace(/-/g,' '))+(source.id.endsWith('left')?' gauche':source.id.endsWith('right')?' droit':''),parent:root,reference,kind:'organ',system:subset[0].system,models:subset.map(m=>m.id),bounds:unionBounds(subset),description:'Modèle HRA issu du Visible Human Female, conservé dans son propre repère.'});}
 }
 for(const reference of Object.keys(referenceNames)){const list=models.filter(m=>m.reference===reference);if(!list.length)continue;for(const system of bodySystems){const subset=list.filter(m=>canonicalSystem(m.system)===system.id);if(subset.length)add({id:`system-${reference}-${system.id}`,name:system.name,parent:reference==='bp4'?'body':reference==='z-anatomy'?'z-body':'female-body',kind:'system',reference,system:system.id,models:subset.map(m=>m.id),bounds:unionBounds(subset),description:system.functionText});}}
 for(const [id,name,pattern,parent] of [['vagus','Nerf vague (X)',/^Vagus nerve/i,'z-neck'],['spinal-cord','Moelle épinière',/spinal cord/i,'z-spine'],['sciatic','Nerf sciatique',/^Sciatic nerve/i,'z-pelvis']]){const subset=models.filter(m=>m.reference==='z-anatomy'&&pattern.test(m.name));if(subset.length)add({id,name,parent,kind:'organ',reference:'z-anatomy',system:'nervous',models:subset.map(m=>m.id),bounds:unionBounds(subset)});}
 // More specific owners take precedence over their containing organ.
 const owner=new Map();for(const n of [...nodes.values()].filter(n=>['organ','structure'].includes(n.kind)).reverse())for(const id of n.models)if(!owner.has(id))owner.set(id,n.id);
 for(const m of models){const parent=owner.get(m.id)||(m.reference==='bp4'?m.region:m.reference==='z-anatomy'?'z-'+m.region:'female-body');if(!nodes.has(m.structure))add({id:m.structure,name:anatomicalLabel(m.name),kind:'structure',parent:nodes.has(parent)?parent:'body',reference:m.reference,system:canonicalSystem(m.system),models:[m.id],bounds:m.bounds});}
 const unavailable=[
 ['hippocampus-tissue','Organisation tissulaire et synapses','hippocampus','Modèle histologique documenté de formation hippocampique, neurones et synapses.'],
 ['heart-tissue','Myocarde et cardiomyocytes','heart','Modèle pédagogique de myocarde et cardiomyocytes.'],
 ['kidney-nephron','Néphron et barrière de filtration','kidney-left','Scène glomérulaire et néphron documentée ; la surface d’un rein ne représente pas ses unités microscopiques.'],
 ['lung-alveoli','Bronchioles et alvéoles','lung-left','Scène microscopique de paroi alvéolaire et réseau capillaire.'],
 ['muscle-fibers','Fibres et sarcomères','biceps-left','Modèle histologique de faisceaux, fibres et sarcomères.'],
 ['bone-micro','Os compact et spongieux','femur-left','Reconstruction interne ou scène pédagogique d’ostéons et de travées.']
 ];
 for(const [id,name,parent,needed] of unavailable)if(nodes.has(parent))add({id,name,parent,kind:'planned',reference:nodes.get(parent).reference,models:[],available:false,needed,description:'Niveau en cours d’intégration. Aucun tissu ni cellule artificiels ne sont affichés.'});
 for(const n of nodes.values())if(n.parent&&nodes.has(n.parent)&&n.parent!==n.id)nodes.get(n.parent).children.push(n.id);
 const modelForStructure=id=>models.filter(m=>m.structure===id||nodes.get(id)?.models.includes(m.id));
 const pathTo=id=>{const trail=[],seen=new Set();while(id&&nodes.has(id)&&!seen.has(id)){seen.add(id);trail.unshift(nodes.get(id));id=nodes.get(id).parent;}return trail;};
 function nextFor(id,point,currentId){const current=nodes.get(currentId),hits=models.filter(m=>m.structure===id),model=hits[0];if(!current)return null;
  if(['body','reference','system'].includes(current.kind)&&current.reference!=='hra-female'){const region=regionAt(current.reference==='bp4'?point:point.map((v,i)=>i===2?v*.96-20:v));return nodes.get((current.reference==='z-anatomy'?'z-':'')+region);}
  if(currentId==='heart'&&model?.memberships?.includes('FMA7088'))return nodes.get('valves');
  const target=nodes.get(id);if(!target)return null;const trail=pathTo(target.id),at=trail.findIndex(n=>n.id===currentId);if(at>=0&&trail[at+1])return trail[at+1];
  if(id!==currentId)return target;return current.children.map(id=>nodes.get(id)).find(n=>n.available)||current.children.map(id=>nodes.get(id)).find(n=>n.kind==='planned')||null;
 }
 function overview(m){if(['skin','skeletal'].includes(canonicalSystem(m.system)))return true;const n=m.name.toLowerCase();return /^(left |right )?(kidney|testis|adrenal gland|lung|cerebellum|hippocampus|amygdala|thalamus|putamen|globus pallidus|caudate nucleus|occipital lobe|white matter of .*cerebral hemisphere)|stomach|^liver$|pancreas$|spleen$|urinary bladder$|^trachea$|bronchopulmonary segment|wall of .*atrium|wall of ventricle|ascending aorta|arch of aorta|inferior vena cava|superior vena cava|^uterus|cervix/.test(n);}
 function sceneModels(id,layers){const n=nodes.get(id);if(!n?.available)return [];const ids=new Set(n.models);let subset=models.filter(m=>m.reference===n.reference&&ids.has(m.id)&&layers[canonicalSystem(m.system)]?.visible);
  if(n.kind==='body')subset=subset.filter(m=>overview(m)||canonicalSystem(m.system)==='muscular'||canonicalSystem(m.system)==='connective');
  return subset;
 }
 return {models,byModel,nodes,owner,pathTo,nextFor,sceneModels,modelForStructure,referenceNames};
}

export function installBodyCards(hierarchy){
 Object.assign(sources,bodyReferences);
 sources.z={title:'Z-Anatomy — modèles et licences',url:'https://github.com/Z-Anatomy/Models-of-human-anatomy'};
 sources.hra={title:'Human Reference Atlas — bibliothèque 3D',url:'https://humanatlas.io/3d-reference-library'};
 const existing=new Map(structures.map(s=>[s.id,s]));
 for(const node of hierarchy.nodes.values()){
  if(!node.available||node.kind==='system'||node.kind==='region'||node.kind==='reference'||node.kind==='body')continue;
  const models=node.models.map(id=>hierarchy.byModel.get(id)),model=models[0],system=bodySystems.find(s=>s.id===canonicalSystem(node.system||model.system));
  if(existing.has(node.id)){const card=existing.get(node.id);card.modelIds=node.models;card.node=node.id;card.reference=node.reference;if(node.reference==='z-anatomy'&&!card.sources.includes('z'))card.sources.push('z');continue;}
  const parent=hierarchy.nodes.get(node.parent),region=hierarchy.pathTo(node.id).find(n=>n.kind==='region')?.name||parent?.name||'Corps humain';
  const card={id:node.id,fr:node.name,en:model.name,latin:'',synonyms:[model.fma||'',...node.models],system:system.id,region,short:system.functionText,morphology:`Structure du ${hierarchy.referenceNames[node.reference]}. ${node.description||'Géométrie anatomique identifiée dans le modèle source.'}`,advanced:'Fiche de repérage : la fonction particulière et les relations détaillées de cette structure restent à documenter.',pathologies:'',related:(node.kind==='organ'?node.children:parent?.children||[]).filter(id=>id!==node.id&&hierarchy.nodes.get(id).available).slice(0,6),sources:[node.reference==='bp4'?'bp':node.reference==='z-anatomy'?'z':'hra'],parent:node.parent,node:node.id,reference:node.reference,modelIds:node.models,initial:true};
  const detail=organContent[node.id];if(detail){Object.assign(card,detail,{initial:false});card.synonyms=[...card.synonyms,...(detail.synonyms||[])];card.sources=[detail.source,...card.sources];}
  structures.push(card);existing.set(card.id,card);
 }
 return structures;
}
