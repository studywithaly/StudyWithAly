// Stable card identities and a small, transparent spaced-review schedule.
function cleCarte(card){
  const text=JSON.stringify([card.m,card.src,card.r,card.v,card.schemaR||'',card.schemaV||'']);
  let a=2166136261,b=5381;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
  return 'fc-'+(a>>>0).toString(36)+'-'+(b>>>0).toString(36);
}
function prochaineRevision(previous,known,now=Date.now()){
  const old=previous||{},repetitions=Number(old.repetitions)||0;
  if(!known)return {due:now+10*60000,last:now,repetitions:0,interval:0,lapses:(old.lapses||0)+1,known:false};
  if(old.known && now-old.last<20*3600000)return {...old,last:now};
  const days=[1,3,7,14,30,60][Math.min(repetitions,5)];
  return {due:now+days*86400000,last:now,repetitions:repetitions+1,interval:days,lapses:old.lapses||0,known:true};
}
function melanger(values){const out=values.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
// UI integration; preserves the existing editor, card faces and content data.
const fabriquerAvantRevision=fabriquerCartes;
fabriquerCartes=function(mid,source){
  const byKey=new Map();
  fabriquerAvantRevision(mid,source).forEach(card=>{const key=cleCarte(card);if(!byKey.has(key))byKey.set(key,{...card,key});});
  return [...byKey.values()];
};
function cartesDisponibles(){return fabriquerCartes('all','tout');}
function bilanCartes(cards=cartesDisponibles()){
  const history=U.revisionCartes||{},now=Date.now();
  return {total:cards.length,revues:cards.filter(c=>history[c.key]).length,dues:cards.filter(c=>history[c.key]&&history[c.key].due<=now),nouvelles:cards.filter(c=>!history[c.key])};
}
function ecrireRevision(card,known){
  U.revisionCartes=U.revisionCartes||{};
  U.revisionCartes[card.key||cleCarte(card)]=prochaineRevision(U.revisionCartes[card.key||cleCarte(card)],known);
  // Preserve history even when an expired subscription temporarily hides cards.
  sauver();
}
const jugerAvantRevision=jugerCarte;
jugerCarte=function(known){if(!Flash||!Flash.retournee)return;const card=Flash.paquet[Flash.i];if(!card)return;ecrireRevision(card,known);jugerAvantRevision(known);};
function lancerRevisionDuJour(){
  const b=bilanCartes(),due=b.dues.sort((a,b)=>(U.revisionCartes[a.key].due-U.revisionCartes[b.key].due));
  const pack=due.concat(b.nouvelles.slice(0,10)).slice(0,30);
  if(!pack.length)return toast('Tout est à jour. Tu peux choisir une séance libre.','ok');
  lancerFlash('all',0,pack);
}
const flashcardsAvantRevision=vueFlashcards;
vueFlashcards=function(){
  const b=bilanCartes();
  return `<section class="carte lueur" style="margin-bottom:22px"><p class="eyebrow">Révisions espacées</p><h2>${b.dues.length} carte${b.dues.length>1?'s':''} à revoir maintenant</h2><p class="muted" style="margin:10px 0">${b.nouvelles.length} à découvrir · ${b.revues}/${b.total} déjà révisées. Les cartes difficiles reviennent dans 10 minutes ; les réussites sont espacées de 1 à 60 jours.</p><button class="btn primaire" onclick="lancerRevisionDuJour()" ${b.dues.length||b.nouvelles.length?'':'disabled'}>Réviser ce qui est prévu</button></section>`+flashcardsAvantRevision();
};
function questionsEnErreur(mid='all'){
  return DB.questions.filter(q=>(mid==='all'||q.m===mid)&&(U.erreursQuiz||{})[q.id]);
}
function boutonsQuiz(mid,n){
  if(!n)return '<p class="small muted">Aucune question disponible pour le moment.</p>';
  const sizes=[...new Set([Math.min(5,n),...(n>5?[Math.min(10,n)]:[]),...(n>10?[Math.min(20,n)]:[])])];
  return sizes.map(size=>`<button class="btn mini" onclick="lancerQuiz('${esc(mid)}',${size})">${size} question${size>1?'s':''}${size>5&&!accesPremium()?' 🔒':''}</button>`).join('');
}
vueQuiz=function(){
  const mistakes=questionsEnErreur().length;
  return `<header class="tete"><p class="eyebrow">Entraînement</p><h1>Quiz et erreurs à retravailler</h1><p class="muted">15 secondes par question. Le nombre indiqué correspond aux questions réellement disponibles.</p></header>
    <section class="carte" style="margin-bottom:20px"><h2>${mistakes} erreur${mistakes>1?'s':''} à retravailler</h2><p class="muted" style="margin:8px 0">Une réponse réussie retire la question de cette liste. Le suivi commence avec tes nouvelles séances.</p><button class="btn" onclick="lancerQuiz('all',${Math.min(accesPremium()?20:5,mistakes)||1},true)" ${mistakes?'':'disabled'}>Revoir mes erreurs</button></section>
    <div class="grille g2">${DB.matieres.map(m=>{const n=DB.questions.filter(q=>q.m===m.id).length;return `<article class="carte"><h2>${esc(m.nom)}</h2><p class="muted" style="margin:8px 0">${n} question${n>1?'s':''} disponible${n>1?'s':''}</p><div class="rang">${boutonsQuiz(m.id,n)}</div></article>`;}).join('')}
    <article class="carte"><h2>Toutes les matières</h2><p class="muted" style="margin:8px 0">Un mélange des questions accessibles.</p><div class="rang">${boutonsQuiz('all',DB.questions.length)}</div></article></div>
    ${accesPremium()?'':'<p class="small muted" style="margin-top:20px">Les séances gratuites contiennent jusqu’à 5 questions ; les séances plus longues sont réservées aux abonnés.</p>'}`;
};
let lancementQuiz=false,navigationRevision=0;
lancerQuiz=async function(mid,number,errorsOnly=false){
  if(lancementQuiz)return;
  const owner=U?.id;
  const navigation=navigationRevision;
  let pool=errorsOnly?questionsEnErreur(mid):DB.questions.filter(q=>mid==='all'||q.m===mid);
  const count=Math.min(Number(number),pool.length);
  if(!Number.isInteger(count)||count<1)return toast('Aucune question à proposer ici.');
  if(count>5&&!accesPremium())return murPayant('Les séries de plus de 5 questions sont réservées aux abonnés.');
  lancementQuiz=true;
  try{
    if(MODE_CLOUD)pool=(await appelServeur('site-api',{action:'quiz',m:mid,nombre:count,...(errorsOnly?{ids:pool.map(q=>q.id)}:{})})).questions;
    else pool=melanger(pool).slice(0,count);
    if(!U||U.id!==owner||navigation!==navigationRevision)return;
    if(!pool.length)return toast('Aucune question disponible.');
    if(Q?.timer)clearInterval(Q.timer);
    Q={m:mid,liste:pool,i:0,reponses:[],debut:Date.now(),timer:null,reste:DUREE};
    afficherQuestion();
  }catch(error){toast(error.message,'ko');}finally{lancementQuiz=false;}
};
const terminerQuizAvantErreurs=terminerQuiz;
terminerQuiz=function(){
  if(!Q?.liste.length)return;
  U.erreursQuiz=U.erreursQuiz||{};
  Q.reponses.forEach(answer=>{if(answer.juste)delete U.erreursQuiz[answer.id];else U.erreursQuiz[answer.id]={date:Date.now(),m:Q.m};});
  terminerQuizAvantErreurs();
  const n=questionsEnErreur(Q.m).length;
  if(n)document.getElementById('zone').insertAdjacentHTML('beforeend',`<div class="rang" style="margin-top:16px"><button class="btn primaire" onclick="lancerQuiz('${esc(Q.m)}',${Math.min(accesPremium()?20:5,n)},true)">Retravailler mes erreurs</button></div>`);
};
vueProgression=function(){
  const history=(U.quiz||[]).filter(q=>q.total>0),cards=bilanCartes();
  const valid=new Set(DB.fiches.map(f=>f.id)),read=(U.lu||[]).filter(id=>valid.has(id)).length;
  return `<header class="tete"><p class="eyebrow">Ma progression</p><h1>Chaque activité, son repère</h1><p class="muted">Les fiches lues, les résultats aux quiz et les flashcards sont suivis séparément.</p></header>
    <div class="grille g3"><article class="carte"><h2>Lecture</h2><p class="grad-txt" style="font-size:32px;font-weight:800">${read}/${DB.fiches.length}</p><p class="muted">fiches marquées comme lues</p></article><article class="carte"><h2>Quiz</h2><p class="grad-txt" style="font-size:32px;font-weight:800">${history.length?Math.round(history.slice(0,5).reduce((s,q)=>s+q.justes/q.total,0)/Math.min(5,history.length)*100)+' %':'—'}</p><p class="muted">réussite moyenne des 5 dernières séances</p></article><article class="carte"><h2>Flashcards</h2><p class="grad-txt" style="font-size:32px;font-weight:800">${cards.revues}/${cards.total}</p><p class="muted">cartes déjà révisées · ${cards.dues.length} à revoir maintenant</p></article></div>
    <div class="grille g2" style="margin-top:20px">${DB.matieres.map(m=>{const p=progressionMatiere(m.id),b=bilanCartes(cartesDisponibles().filter(c=>c.m===m.id));return `<article class="carte"><h2>${esc(m.nom)}</h2><p style="margin-top:12px">Lecture : ${p.lues}/${p.total} fiches (${p.total?Math.round(p.lues/p.total*100):0} %)</p><p>Quiz : ${p.moyenne===null?'pas encore évalué':p.moyenne+' % de réussite'} · ${p.tests} séance${p.tests>1?'s':''} récente${p.tests>1?'s':''}</p><p>Flashcards : ${b.revues}/${b.total} révisées · ${b.dues.length} à revoir</p><button class="btn mini" style="margin-top:12px" onclick="choisirMatiere('${esc(m.id)}')">Ouvrir les fiches</button></article>`;}).join('')}</div>
    <section class="carte" style="margin-top:20px"><h2>Dernières séances de quiz</h2>${history.length?`<div class="tbl-scroll"><table><thead><tr><th>Date</th><th>Matière</th><th>Résultat</th></tr></thead><tbody>${history.slice(0,10).map(q=>`<tr><td>${jour(q.date)}</td><td>${esc(nomMat(q.m))}</td><td>${q.justes}/${q.total}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Ta première séance apparaîtra ici.</p>'}</section>`;
};
function vueAujourdhui(){
  const b=bilanCartes(),canRead=DB.fiches.filter(f=>!f.verrouille&&(!f.prem||accesPremium()));
  const read=new Set(U.lu||[]),again=new Set(U.revoir||[]);
  const suggested=canRead.filter(f=>again.has(f.id)).concat(canRead.filter(f=>!again.has(f.id)&&!read.has(f.id))).slice(0,3);
  const mistakes=questionsEnErreur().length;
  return `<header class="tete"><p class="eyebrow">${esc(new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))}</p><h1>Ma révision du jour</h1><p class="muted">Bonjour ${esc((U.nom||'').split(' ')[0])}. Une petite séance pour avancer à ton rythme.</p></header>
    <section class="carte lueur"><h2>Tu as 10 minutes ?</h2><p class="muted" style="margin:10px 0 16px">Commence par les cartes prévues, puis choisis une fiche ou quelques questions. Le minuteur reste visible pendant ta séance.</p><button class="btn primaire" onclick="demarrerDixMinutes()" ${b.total||canRead.length||DB.questions.length?'':'disabled'}>Commencer une séance de 10 minutes</button></section>
    <div class="grille g3" style="margin:20px 0"><article class="carte"><h2>${b.dues.length}</h2><p class="muted">cartes à revoir maintenant</p><button class="btn mini" onclick="lancerRevisionDuJour()" ${b.dues.length||b.nouvelles.length?'':'disabled'}>Réviser les cartes</button></article><article class="carte"><h2>${b.nouvelles.length}</h2><p class="muted">cartes à découvrir</p><button class="btn mini" onclick="App.aller('flashcards')">Voir les flashcards</button></article><article class="carte"><h2>${mistakes}</h2><p class="muted">erreurs à retravailler</p><button class="btn mini" onclick="${mistakes?`lancerQuiz('all',${Math.min(5,mistakes)},true)`:`App.aller('quiz')`}">${mistakes?'Corriger mes erreurs':'Choisir un quiz'}</button></article></div>
    <h2 style="margin-bottom:14px">Fiches conseillées</h2><div class="grille g3">${suggested.length?suggested.map(f=>carteFiche(f,'',true)).join(''):'<p class="muted">Toutes les fiches accessibles sont marquées comme lues. Tu peux en choisir une à revoir.</p>'}</div><button class="btn" style="margin-top:18px" onclick="App.aller('fiches')">Toutes les fiches</button>`;
}
let sessionDixMinutes=null;
function afficherMinuteurRevision(){
  let box=document.getElementById('session-revision');
  if(!sessionDixMinutes){if(box)box.remove();return;}
  if(!box){box=document.createElement('div');box.id='session-revision';box.className='carte entre';box.style.cssText='margin:16px 16px 0;padding:12px 16px;position:sticky;top:8px;z-index:40';document.getElementById('zone').before(box);}
  const seconds=Math.max(0,Math.ceil((sessionDixMinutes.fin-Date.now())/1000));
  const label=seconds?`Séance en cours · ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'Tes 10 minutes sont terminées. Bravo pour cette séance !';
  if(!box.querySelector('span'))box.innerHTML='<span></span><button class="btn mini" onclick="terminerDixMinutes()">Terminer la séance</button>';
  box.querySelector('span').textContent=label;
  if(!seconds){clearInterval(sessionDixMinutes.timer);sessionDixMinutes.timer=null;}
}
function demarrerDixMinutes(){
  if(sessionDixMinutes?.timer)clearInterval(sessionDixMinutes.timer);
  sessionDixMinutes={fin:Date.now()+600000,timer:setInterval(afficherMinuteurRevision,1000)};
  afficherMinuteurRevision();
  const b=bilanCartes();
  if(b.dues.length||b.nouvelles.length)lancerRevisionDuJour();
  else App.aller('fiches');
}
function terminerDixMinutes(){if(sessionDixMinutes?.timer)clearInterval(sessionDixMinutes.timer);sessionDixMinutes=null;afficherMinuteurRevision();App.aller('aujourdhui');}
function telechargerJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function exporterMonCompte(){
  try{let data;if(MODE_CLOUD)data=await appelServeur('site-api',{action:'export-account'});else{data={profil:copie(U)};delete data.profil.mdp;}telechargerJSON(data,'studywithaaly-mes-donnees.json');toast('Ton export a été préparé.','ok');}catch(error){toast(error.message,'ko');}
}
function ouvrirSuppressionCompte(){
  modale(`<h2>Supprimer mon compte</h2><p style="margin:12px 0">Cette action supprime ton compte, tes notes, ta progression et tes préférences de notification. Tes abonnements Stripe seront arrêtés immédiatement, sans remboursement automatique. Les justificatifs comptables restent conservés.</p><p class="small muted">Tu peux exporter tes données avant de continuer. Un compte développeur doit d’abord faire retirer son rôle par un autre développeur.</p><form onsubmit="supprimerMonCompte(event)"><div class="champ"><label for="supp-motdepasse">Mot de passe actuel</label><input type="password" autocomplete="current-password" id="supp-motdepasse" required></div><div class="champ"><label for="supp-confirmation">Écris SUPPRIMER pour confirmer</label><input id="supp-confirmation" autocomplete="off" required pattern="SUPPRIMER"></div><label class="rang" style="margin:12px 0"><input id="supp-accord" type="checkbox" required style="width:auto">Je comprends la perte de mes données et l’arrêt de mon abonnement.</label><p id="supp-status" role="status"></p><div class="rang"><button class="btn danger" type="submit">Supprimer définitivement mon compte</button><button class="btn" type="button" onclick="fermerModale()">Annuler</button></div></form>`);
}
async function supprimerMonCompte(event){
  event.preventDefault();const form=event.target,buttons=[...form.querySelectorAll('button')],status=document.getElementById('supp-status');
  const confirmation=document.getElementById('supp-confirmation').value,accepte=document.getElementById('supp-accord').checked;
  if(confirmation!=='SUPPRIMER'||!accepte)return;
  buttons.forEach(b=>b.disabled=true);status.textContent='Suppression en cours…';
  try{
    if(!MODE_CLOUD)throw Error('Cette opération nécessite la connexion au site en ligne.');
    const credential=firebase.auth.EmailAuthProvider.credential(fauth.currentUser.email,document.getElementById('supp-motdepasse').value);
    await fauth.currentUser.reauthenticateWithCredential(credential);
    await appelServeur('site-api',{action:'delete-account',confirmation,accepte});
    fermerModale();await Auth.deconnecter();toast('Ton compte a été supprimé.','ok');
  }catch(error){status.textContent=error.code?traduireErreur(error):error.message;buttons.forEach(b=>b.disabled=false);}
}
const profilAvantDonnees=vueProfil;
vueProfil=function(){
  return profilAvantDonnees().replace('programme','indice combiné (lecture 40 %, quiz 60 %)')+`<section class="carte" style="margin-top:20px"><h2>Mes données personnelles</h2><p class="muted" style="margin:10px 0">Télécharge tes données d’étude et tes droits, ou demande la suppression de ton compte.</p><div class="rang"><button class="btn" onclick="exporterMonCompte()">Exporter mes données</button><button class="btn danger" onclick="ouvrirSuppressionCompte()">Supprimer mon compte</button></div></section>`;
};
const navigationAvantRevision=App.aller;
App.aller=function(view){navigationRevision++;if(Q?.timer)clearInterval(Q.timer);Q=null;navigationAvantRevision.call(this,view);const plus=document.querySelector('.nav-plus');if(plus&&view==='progression')plus.classList.add('actif');afficherMinuteurRevision();};
const logoutAvantRevision=Auth.deconnecter;
Auth.deconnecter=async function(...args){
  if(sessionDixMinutes?.timer)clearInterval(sessionDixMinutes.timer);sessionDixMinutes=null;afficherMinuteurRevision();
  if(Q?.timer)clearInterval(Q.timer);Q=null;Flash=null;
  Object.keys(MEDIAS).forEach(key=>delete MEDIAS[key]);
  await logoutAvantRevision.apply(this,args);
  DB.fiches=[];DB.questions=[];DB.livres=[];DB.users=[];DROITS={abo:null,achats:[]};
};
if(U && VUE==='aujourdhui')App.aller('aujourdhui');
