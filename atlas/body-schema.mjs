// Shared metadata for spatial navigation and the import pipeline. Coordinates are BodyParts3D mm, Z up.
export const bodySystems = [
 ['nervous','Système nerveux','#e4bf57','Communication et intégration des informations nerveuses.'],
 ['skeletal','Squelette','#e6dac5','Soutien, protection et leviers du mouvement.'],
 ['muscular','Muscles','#c56b77','Production de force par contraction musculaire.'],
 ['cardiovascular','Cœur et vaisseaux','#db626b','Circulation du sang et transport des substances.'],
 ['respiratory','Respiration','#9ebbe3','Conduction de l’air et échanges gazeux pulmonaires.'],
 ['digestive','Digestion','#cba06f','Transformation des aliments et absorption des nutriments.'],
 ['urinary','Appareil urinaire','#b185ba','Formation, transport et évacuation de l’urine.'],
 ['endocrine','Glandes endocrines','#b8a0e6','Régulation de fonctions corporelles par des hormones.'],
 ['lymphatic','Lymphatique et immunitaire','#85b889','Retour lymphatique et fonctions immunitaires.'],
 ['reproductive','Appareil reproducteur','#d994b2','Fonctions de reproduction.'],
 ['skin','Peau','#d8bba6','Enveloppe protectrice et interface avec le milieu extérieur.'],
 ['sensory','Organes sensoriels','#8dcac4','Réception de stimuli et transmission d’informations sensorielles.'],
 ['connective','Articulations et tissus conjonctifs','#a7b6b8','Liaison, soutien et transmission des contraintes mécaniques.']
].map(([id,name,color,functionText])=>({id,name,color,functionText}));
export const canonicalSystem=id=>['surface','deep','stem','peripheral'].includes(id)?'nervous':id;
export const regions = [
 ['head','Tête',[-170,-270,1410,170,110,1670]],['neck','Cou',[-150,-210,1310,150,110,1450]],
 ['thorax','Thorax',[-180,-280,1070,180,110,1350]],['abdomen','Abdomen',[-180,-280,850,180,110,1100]],
 ['pelvis','Bassin',[-200,-240,650,200,100,890]],
 ['arm-left','Bras et avant-bras gauches',[130,-240,800,350,100,1360]],['arm-right','Bras et avant-bras droits',[-350,-240,800,-130,100,1360]],
 ['hand-left','Main gauche',[220,-250,610,380,100,845]],['hand-right','Main droite',[-380,-250,610,-220,100,845]],
 ['leg-left','Jambe et cuisse gauches',[0,-250,25,190,100,850]],['leg-right','Jambe et cuisse droites',[-190,-250,25,0,100,850]],
 ['foot-left','Pied gauche',[0,-300,-100,190,100,70]],['foot-right','Pied droit',[-190,-300,-100,0,100,70]],
 ['spine','Colonne vertébrale',[-85,-145,600,85,110,1450]]
].map(([id,name,bounds])=>({id,name,bounds,parent:'body',kind:'region'}));
export const bodyBounds=[-380,-300,-100,380,110,1670];
export function centerOf(b){return [(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2];}
export function inside(p,b){return p.every((v,i)=>v>=b[i]&&v<=b[i+3]);}
export function regionAt(p){
 const ordered=['hand-left','hand-right','foot-left','foot-right','head','arm-left','arm-right','neck','thorax','abdomen','pelvis','leg-left','leg-right'];
 return ordered.find(id=>inside(p,regions.find(r=>r.id===id).bounds))||'spine';
}
export function inferSystem(row){
 const n=row.name.toLowerCase(),inFma=id=>row.memberships.some(m=>m.fma===id);
 if(n==='skin')return 'skin';
 if(/^(?:left |right )?(?:pituitary gland|pineal body|adrenal gland|thyroid gland|parathyroid gland)$/.test(n))return 'endocrine';
 if(inFma('FMA5018'))return 'skeletal';
 if(inFma('FMA7157')||/nerve|ganglion|ganglia|spinal cord|cerebr|thalam|hippocamp|amygdal|gyrus|gyri|putamen|pallid|caudate nucleus|fornix|callosum|collicul|commissure|midbrain|medulla oblongata|^pons|septum of telencephalon|optic tract|optic chiasm|substantia nigra/.test(n))return 'nervous';
 if(/spleen|thymus|tonsil|lymph/.test(n))return 'lymphatic';
 if(/pituitary|pineal|adrenal gland|thyroid gland|parathyroid|hypothalamus/.test(n))return 'endocrine';
 if(/testis|epididym|penis|prostate|seminal|ejaculatory|ductus deferens|scrotum|ovary|uterus|uterine|vagina/.test(n)||inFma('FMA7160'))return 'reproductive';
 if(/kidney|ureter|urethra|urinary bladder|renal pelvis/.test(n)||inFma('FMA7159'))return 'urinary';
 if(/artery|arterial|vein|venous|aorta|heart|cardiac|atrium|ventricle|papillary muscle|mitral|tricuspid|pulmonary valve|aortic valve|chordae tendineae/.test(n)||inFma('FMA7161'))return 'cardiovascular';
 if(/bronch|lung|trachea|laryn|pharynx|nasal|diaphragm/.test(n)||inFma('FMA7158'))return 'respiratory';
 if(/stomach|liver|hepatic|intestin|duoden|jejun|ileum|colon|rectum|pancrea|gallbladder|esophag|bile duct|salivary|parotid|sublingual|submandibular|tongue|tooth|gingiva/.test(n)||inFma('FMA7152'))return 'digestive';
 if(/eyeball|cornea|retina\b|lens|iris|sclera|ciliary|choroid|cochlea|vestibul|malleus|incus|stapes|tympan|lacrimal|auricle|pinna|external ear/.test(n))return 'sensory';
 if(/ligament|tendon|fascia|retinaculum|interosseous membrane|cartilage|intervertebral|menisc|synovial|joint|articul/.test(n))return 'connective';
 if(inFma('FMA5018'))return 'skeletal';
 if(inFma('FMA5022')||row.memberships.some(m=>/muscle organ|skeletal muscle/.test(m.name))||/muscle|brachii|deltoid|trapezius|pectoralis|latissimus|serratus|biceps|triceps|flexor|extensor|adductor|abductor|pronator|supinator|glute|vastus|rectus|obliqu|intercostal|lumbrical|interosse|tibialis|fibularis|soleus|gastrocnem|sternocleido|orbicularis|zygomatic|levator|depressor|scalene|scalenus|psoas|iliacus|piriformis|sartorius|gracilis|popliteus|plantaris|quadratus|teres|spinatus/.test(n))return 'muscular';
 if(/bone|vertebra|phalanx|metacarp|metatars|femur|tibia|fibula|humerus|ulna|radius|scapula|clavicle|sternum|rib|skull|mandible|sacrum|coccyx/.test(n))return 'skeletal';
 return 'connective';
}
