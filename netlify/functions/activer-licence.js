const {gate,json:reponse}=require('../../server/security.cjs');
const {services}=require('./notifications');

async function utilisateurDepuisEntete(headers){
  const brut=headers.authorization||headers.Authorization||'';
  const jeton=brut.startsWith('Bearer ')?brut.slice(7):null;
  if(!jeton)throw Error('token-missing');
  const {admin,db}=services();
  const decode=await admin.auth().verifyIdToken(jeton,true);
  if((await db.collection('suppressionComptes').doc(decode.uid).get()).exists)throw Error('account-deleting');
  return {uid:decode.uid,email:decode.email,db};
}

exports.handler = async (event) => {
  const rejected=gate(event);if(rejected)return rejected;
  if(event.httpMethod !== "POST") return reponse(405, { erreur:"méthode non autorisée" });

  let user;
  try{ user = await utilisateurDepuisEntete(event.headers); }
  catch(e){ return reponse(401, { erreur:"connexion requise" }); }
  const db=user.db;

  let code;
  try{code=String((JSON.parse(event.body||'{}').code)||'').trim().toUpperCase();}catch{return reponse(400,{erreur:'Requête invalide.'});}
  if(!/^SWA-[A-Z0-9]{4,16}-[A-Z0-9]{4,16}-[A-Z0-9]{4,16}$/.test(code)) return reponse(400, { erreur:"code manquant" });

  const ref = db.collection("contenu").doc("licences");

  try{
    const resultat = await db.runTransaction(async (t) => {
      if((await t.get(db.collection('suppressionComptes').doc(user.uid))).exists)throw Error('Compte en cours de suppression.');
      const doc = await t.get(ref);
      const liste = (doc.exists ? doc.data().liste : []) || [];
      const l = liste.find(x => x.code === code);
      if(!l) throw new Error("Code inconnu.");
      if(l.utilisee) throw new Error("Ce code a déjà été utilisé.");

      const jours = l.type === "annuel" ? 365 : 30;
      const droits = await t.get(db.collection("droits").doc(user.uid));
      const actuel = droits.exists && droits.data().abo ? droits.data().abo.fin : 0;
      const depart = Math.max(actuel, Date.now());
      const fin = depart + jours * 86400000;

      l.utilisee = true; l.par = user.email; l.dateUtil = Date.now();
      t.set(ref, { liste }, { merge:true });
      t.set(db.collection("droits").doc(user.uid), {
        abo:{ plan:l.type, fin, statut:"actif", licence:code }, maj:Date.now()
      }, { merge:true });

      return { plan:l.type, fin };
    });

    return reponse(200, resultat);

  }catch(e){
    return reponse(400, { erreur: "Service temporairement indisponible." });
  }
};

