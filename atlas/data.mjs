export const sources = {
  bp: {title:'BodyParts3D 4.0 — DBCLS / archive NBDC',url:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html'},
  cns: {title:'OpenStax, Anatomy and Physiology 2e, §13.2',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/13-2-the-central-nervous-system'},
  pns: {title:'OpenStax, Anatomy and Physiology 2e, §13.4',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/13-4-the-peripheral-nervous-system'},
  hip: {title:'NCBI Bookshelf — Neuroanatomy, Hippocampus',url:'https://www.ncbi.nlm.nih.gov/books/NBK482171/'},
  basal: {title:'NCBI Bookshelf — Neuroanatomy, Basal Ganglia',url:'https://www.ncbi.nlm.nih.gov/books/NBK537141/'},
  thal: {title:'NCBI Bookshelf — Neuroanatomy, Thalamic Nuclei',url:'https://www.ncbi.nlm.nih.gov/books/NBK549908/'}
};
export const systems = [
  {id:'surface',name:'Cortex et substance blanche',color:'#dca5c9'},
  {id:'deep',name:'Structures profondes',color:'#f8ba67'},
  {id:'stem',name:'Tronc cérébral et cervelet',color:'#69cddd'},
  {id:'endocrine',name:'Structures neuroendocrines',color:'#b3a0ff'}
];
// Mesh availability is resolved from the imported model registry, never inferred from a name.
const rows = [
 ['hippocampus','Hippocampe','Hippocampus','hippocampus','deep','Temporal médial','Formation de nouveaux souvenirs et mémoire spatiale.','Formation courbe, au voisinage de la corne temporale du ventricule latéral.','Les connexions avec les régions entorhinales participent aux processus de mémorisation.','Troubles de mémoire ; épilepsie temporale.','hip',['amygdala','fornix']],
 ['amygdala','Amygdale','Corpus amygdaloideum','amygdala','deep','Temporal médial','Participe au traitement émotionnel.','Ensemble de noyaux, en avant de l’hippocampe.','Ses relations avec l’hypothalamus et le cortex relient émotion et réponses corporelles.','Altérations de la reconnaissance émotionnelle.','cns',['hippocampus','hypothalamus']],
 ['thalamus','Thalamus','Thalamus','thalamus','deep','Diencéphale','Relais de nombreuses informations sensorielles et motrices.','Masse de substance grise bordant le troisième ventricule.','Ses noyaux possèdent des connexions corticales distinctes.','Des lésions peuvent entraîner des déficits sensitifs.','thal',['caudate','putamen']],
 ['caudate','Noyau caudé','Nucleus caudatus','caudate nucleus','deep','Télencéphale','Contribue à la sélection des actions.','Noyau incurvé longeant le ventricule latéral.','Avec le putamen, il constitue le striatum ; ses circuits participent aussi à la cognition.','Atteinte notamment dans la maladie de Huntington.','basal',['putamen','pallidum']],
 ['putamen','Putamen','Putamen','putamen','deep','Télencéphale','Participe au contrôle moteur.','Noyau latéral au globus pallidus.','Reçoit des projections corticales au sein des circuits des noyaux de la base.','Dysfonctionnement des circuits dans les troubles du mouvement.','basal',['caudate','pallidum']],
 ['pallidum','Globus pallidus','Globus pallidus','globus pallidus','deep','Télencéphale','Module les circuits moteurs.','Noyau médial au putamen.','Ses segments interne et externe ont des rôles distincts dans les voies des noyaux de la base.','Impliqué dans les troubles du mouvement.','basal',['putamen','thalamus']],
 ['callosum','Corps calleux','Corpus callosum','corpus callosum','deep','Ligne médiane','Communication entre les hémisphères.','Large commissure de substance blanche.','Relie des régions corticales des deux côtés.','Syndromes de déconnexion.','cns',[]],
 ['fornix','Fornix','Fornix','fornix of forebrain','deep','Télencéphale médial','Voie de connexion de la formation hippocampique.','Faisceau de substance blanche arqué.','Relie notamment l’hippocampe aux régions hypothalamiques.','Des lésions peuvent affecter la mémoire.','hip',['hippocampus','hypothalamus']],
 ['hypothalamus','Hypothalamus','Hypothalamus','hypothalamus','endocrine','Diencéphale','Régulation de l’homéostasie.','Région située sous le thalamus.','Coordonne des réponses autonomes et endocrines.','Troubles de régulation thermique ou endocrine.','cns',['thalamus','pituitary']],
 ['pituitary','Hypophyse','Hypophysis','pituitary gland','endocrine','Base du crâne','Sécrétion et libération d’hormones.','Glande reliée à l’hypothalamus.','Contrôle hypothalamique des fonctions hypophysaires.','Troubles hormonaux associés aux adénomes.','cns',['hypothalamus']],
 ['pineal','Épiphyse','Glandula pinealis','pineal body','endocrine','Épithalamus','Participe aux rythmes circadiens via la mélatonine.','Petite glande de la région postérieure du diencéphale.','Sa sécrétion est liée à l’alternance jour-nuit.','Les lésions de la région pinéale nécessitent une évaluation spécialisée.','cns',[]],
 ['cerebellum','Cervelet','Cerebellum','cerebellum','stem','Fosse crânienne postérieure','Coordination et ajustement des mouvements.','Structure plissée en arrière du tronc cérébral.','Compare les commandes motrices et les retours sensoriels.','Ataxie et dysmétrie lors de lésions.','cns',['pons','medulla']],
 ['midbrain','Mésencéphale','Mesencephalon','midbrain','stem','Tronc cérébral supérieur','Voies motrices et réponses sensorielles.','Partie du tronc située au-dessus du pont.','Contient notamment les colliculi et des voies de passage.','Des lésions peuvent affecter les mouvements oculaires.','cns',['pons','thalamus']],
 ['pons','Pont','Pons','pons','stem','Tronc cérébral','Relais entre plusieurs régions nerveuses.','Partie du tronc entre mésencéphale et bulbe.','Possède de nombreuses connexions avec le cervelet.','Des lésions peuvent affecter motricité et sensibilité.','cns',['cerebellum','medulla']],
 ['medulla','Bulbe rachidien','Medulla oblongata','medulla oblongata','stem','Tronc cérébral inférieur','Participe aux fonctions végétatives vitales.','Prolonge le pont vers la moelle épinière.','Contient des voies ascendantes et descendantes et des noyaux de nerfs crâniens.','Les atteintes bulbaires peuvent affecter déglutition et respiration.','cns',['pons']],
 ['occipital','Lobe occipital','Lobus occipitalis','occipital lobe','surface','Cortex postérieur','Traitement visuel.','Région postérieure de l’hémisphère cérébral.','Comprend le cortex visuel primaire.','Les lésions peuvent produire des déficits du champ visuel.','cns',[]],
 ['precentral','Gyrus précentral','Gyrus precentralis','precentral gyrus','surface','Lobe frontal','Commande de mouvements volontaires.','Gyrus en avant du sillon central.','Comprend le cortex moteur primaire.','Un déficit moteur peut suivre une lésion.','cns',['postcentral']],
 ['postcentral','Gyrus postcentral','Gyrus postcentralis','postcentral gyrus','surface','Lobe pariétal','Traitement somatosensoriel.','Gyrus en arrière du sillon central.','Comprend le cortex somatosensoriel primaire.','Une lésion peut perturber la sensibilité.','cns',['precentral']],
 ['white','Substance blanche cérébrale','Substantia alba cerebri','white matter of cerebral hemisphere','surface','Hémisphères','Connexion des régions nerveuses.','Ensemble de faisceaux sous-corticaux.','Les axones myélinisés relient les régions corticales et sous-corticales.','Atteinte dans les maladies démyélinisantes.','cns',['callosum']],
 ['vagus','Nerf vague','Nervus vagus','vagus nerve','peripheral','Tête, thorax, abdomen','Fonctions sensitives, motrices et parasympathiques.','Dixième paire de nerfs crâniens.','','','pns',[]]
];
export const structures = rows.map(([id,fr,latin,en,system,region,short,morphology,advanced,pathologies,source,related])=>({id,fr,latin,en,system,region,short,morphology,advanced,pathologies,sources:[source,'bp'],related,synonyms: id==='vagus'?['X','nerf pneumogastrique']:id==='medulla'?['moelle allongée']:[],parent:'encephalon'}));
export function normalize(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
export function searchStructures(query,system='all',region='all'){
 const terms=normalize(query).trim().split(/\s+/);
 return structures.filter(s=>(system==='all'||s.system===system)&&(region==='all'||s.region===region)&&terms.every(t=>normalize([s.fr,s.latin,s.en,s.region,s.system,systems.find(x=>x.id===s.system)?.name,...s.synonyms].join(' ')).includes(t)));
}
