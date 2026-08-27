// Consomme un code de licence et accorde l'abonnement correspondant.
// Passe par le serveur pour que le code ne puisse être utilisé qu'une fois.
const { db, utilisateurDepuisEntete, reponse } = require("./_firebase");

exports.handler = async (event) => {
  if(event.httpMethod !== "POST") return reponse(405, { erreur:"méthode non autorisée" });

  let user;
  try{ user = await utilisateurDepuisEntete(event.headers); }
  catch(e){ return reponse(401, { erreur:"connexion requise" }); }

  const code = String((JSON.parse(event.body || "{}").code) || "").trim().toUpperCase();
  if(!code) return reponse(400, { erreur:"code manquant" });

  const ref = db.collection("contenu").doc("licences");

  try{
    const resultat = await db.runTransaction(async (t) => {
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
    return reponse(400, { erreur: e.message });
  }
};
