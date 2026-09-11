const {services} = require('./notifications');
const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'},body:JSON.stringify(body)});
const pick=(object,keys)=>Object.fromEntries(keys.filter(key=>object[key]!==undefined).map(key=>[key,object[key]]));
function premium(profile,rights,now=Date.now()) {
  return profile.dev===true || !!(rights.abo && Number(rights.abo.fin)>now && rights.abo.statut!=='suspendu');
}
function projectContent(base,profile,rights,now=Date.now()) {
  if(profile.dev===true)return base;
  const full=premium(profile,rights,now), owned=new Set(rights.achats||[]);
  const blocked=new Set((base.fiches||[]).filter(f=>f.prem && !full).map(f=>f.id));
  return {
    matieres:base.matieres||[], legal:base.legal||{},
    fiches:(base.fiches||[]).map(f=>blocked.has(f.id)?{
      ...pick(f,['id','m','ch','t','prem']),s:[],img:[],cartes:[],verrouille:true
    }:f),
    questions:(base.questions||[]).filter(q=>full || (!q.prem && !blocked.has(q.ficheId))),
    livres:(base.livres||[]).map(l=>owned.has(l.id)?l:pick(l,['id','m','titre','soustitre','prix','sommaire','c1','c2','lien','couverture','description']))
  };
}
function mediaReferences(value,out=new Set()) {
  if(typeof value==='string' && /^med:[\w-]+$/.test(value))out.add(value);
  else if(Array.isArray(value))value.forEach(v=>mediaReferences(v,out));
  else if(value && typeof value==='object')Object.values(value).forEach(v=>mediaReferences(v,out));
  return out;
}
async function removeQuery(db,query) {
  while(true){const page=await query.limit(200).get();if(page.empty)return;const batch=db.batch();page.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
}
async function deleteAccount(db,admin,user,profile,rights,input) {
  if(input.confirmation!=='SUPPRIMER' || input.accepte!==true) return reply(400,{erreur:'Confirme explicitement la suppression et ses conséquences.'});
  if(!Number.isFinite(Number(user.auth_time)) || Date.now()/1000-Number(user.auth_time)>300)return reply(401,{erreur:'Reconnecte-toi avant de supprimer ton compte.',code:'recent-login'});
  if(profile.dev===true)return reply(409,{erreur:'Ce compte gère le site. Un autre développeur doit retirer son rôle avant sa suppression.'});
  const marker=db.collection('suppressionComptes').doc(user.uid);
  await marker.set({etat:'en-cours',debut:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  // The confirmation shown to the user includes cancelling future billing without a refund.
  if(rights.clientStripe){
    const stripe=require('stripe')(process.env.STRIPE_CLE_SECRETE);
    for await(const subscription of stripe.subscriptions.list({customer:rights.clientStripe,status:'all',limit:100})){
      if(!['canceled','incomplete_expired'].includes(subscription.status)){
        await stripe.subscriptions.cancel(subscription.id,{invoice_now:false,prorate:false});
      }
    }
  }
  await removeQuery(db,db.collection('notifications').where('uid','==',user.uid));
  // Keep accounting records, but remove the link to the application account.
  const sales=await db.collection('ventes').where('uid','==',user.uid).get();
  for(let i=0;i<sales.docs.length;i+=200){const batch=db.batch();sales.docs.slice(i,i+200).forEach(d=>batch.update(d.ref,{uid:'compte-supprime'}));await batch.commit();}
  for(const name of ['licences','ventes']){
    const ref=db.collection('contenu').doc(name);
    await db.runTransaction(async tx=>{
      const snapshot=await tx.get(ref);if(!snapshot.exists)return;
      const liste=(snapshot.data().liste||[]).map(item=>{
        const value={...item};
        if(value.uid===user.uid)value.uid='compte-supprime';
        if(value.par===user.email)value.par='compte supprimé';
        if(value.email===user.email)delete value.email;
        return value;
      });tx.set(ref,{liste},{merge:true});
    });
  }
  await db.collection('users').doc(user.uid).delete();
  await db.collection('droits').doc(user.uid).delete();
  // An opaque UID tombstone prevents late Stripe events from recreating entitlements.
  await marker.set({etat:'donnees-effacees',fin:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  await admin.auth().deleteUser(user.uid);
  return reply(200,{ok:true});
}
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return reply(405,{erreur:'Méthode non autorisée.'});
  let input;try{input=JSON.parse(event.body||'{}');if(!input||typeof input!=='object'||Array.isArray(input))throw Error();}catch{return reply(400,{erreur:'Requête JSON invalide.'});}
  const {admin,db}=services();
  let user;
  try{user=await admin.auth().verifyIdToken((event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer /,''),true);}catch{return reply(401,{erreur:'Connexion requise.'});}
  try{
    const [profileDoc,rightsDoc,deleted]=await Promise.all([
      db.collection('users').doc(user.uid).get(),db.collection('droits').doc(user.uid).get(),db.collection('suppressionComptes').doc(user.uid).get()
    ]);
    const profile=profileDoc.data()||{},rights=rightsDoc.data()||{};
    if(input.action==='delete-account')return await deleteAccount(db,admin,user,profile,rights,input);
    if(!profileDoc.exists || deleted.exists)return reply(403,{erreur:'Ce compte est indisponible ou en cours de suppression.'});
    if(input.action==='export-account'){
      const [sales,notifications]=await Promise.all([db.collection('ventes').where('uid','==',user.uid).get(),db.collection('notifications').where('uid','==',user.uid).get()]);
      const own={...profile};delete own.mdp;
      return reply(200,{version:1,exporteLe:new Date().toISOString(),profil:own,droits:rights,ventes:sales.docs.map(d=>d.data()),notifications:notifications.docs.map(d=>pick(d.data(),['hour','timezone','reminders','news','updatedAt'])),note:'Les factures et informations de paiement Stripe se consultent dans le portail client.'});
    }
    const baseDoc=await db.collection('contenu').doc('base').get();
    const base=baseDoc.data()||{},content=projectContent(base,profile,rights);
    if(input.action==='content')return reply(200,{contenu:content,droits:rights,premium:premium(profile,rights)});
    const ownedBooks=(base.livres||[]).filter(l=>profile.dev===true||(rights.achats||[]).includes(l.id));
    if(input.action==='book'){
      const book=ownedBooks.find(l=>l.id===input.id);
      if(!book)return reply(403,{erreur:'Cet ouvrage ne figure pas dans ta bibliothèque.'});
      return reply(200,{livre:book,fiches:(base.fiches||[]).filter(f=>book.m==='all'||book.m===f.m)});
    }
    if(input.action==='media'){
      if(!Array.isArray(input.ids)||!input.ids.length||input.ids.length>12||input.ids.some(id=>typeof id!=='string'||!/^med:[\w-]+$/.test(id)))return reply(400,{erreur:'Références de schémas invalides.'});
      const allowed=mediaReferences(content);
      mediaReferences((base.fiches||[]).filter(f=>ownedBooks.some(l=>l.m==='all'||l.m===f.m)),allowed);
      if(profile.dev!==true && input.ids.some(id=>!allowed.has(id)))return reply(403,{erreur:'Ce schéma est réservé aux comptes qui ont accès au contenu.'});
      const snapshots=await Promise.all(input.ids.map(id=>db.collection('medias').doc(id.slice(4)).get()));
      return reply(200,{medias:Object.fromEntries(snapshots.map((d,i)=>[input.ids[i],d.exists?d.data().data:null]))});
    }
    if(input.action==='quiz'){
      let pool=content.questions.filter(q=>input.m==='all'||q.m===input.m);
      const requested=Number(input.nombre);
      if(!Number.isInteger(requested)||requested<1||requested>20)return reply(400,{erreur:'Choisis entre 1 et 20 questions.'});
      if(requested>5&&!premium(profile,rights))return reply(403,{erreur:'Les séries de plus de 5 questions sont réservées aux abonnés.'});
      if(Array.isArray(input.ids))pool=pool.filter(q=>input.ids.includes(q.id));
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
      return reply(200,{questions:pool.slice(0,requested)});
    }
    return reply(400,{erreur:'Action inconnue.'});
  }catch(error){console.error('site-api',error.code||error.name);return reply(503,{erreur:input.action==='delete-account'?'La suppression n’a pas pu être terminée. Réessaie pour terminer les opérations restantes.':'Service temporairement indisponible. Réessaie.'});}
};
exports.projectContent=projectContent;
exports.mediaReferences=mediaReferences;
exports.premium=premium;
exports.deleteAccount=deleteAccount;
