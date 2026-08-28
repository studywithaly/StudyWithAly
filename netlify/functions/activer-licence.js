// Consomme un code de licence et accorde l'abonnement correspondant.
// Passe par le serveur pour que le code ne puisse être utilisé qu'une fois.

// ---------------------------------------------------------------------------
// Initialisation Firebase Admin. Le SDK Admin ignore les règles Firestore :
// c'est ce qui rend les droits infalsifiables depuis le navigateur.
// ---------------------------------------------------------------------------
const admin = require("firebase-admin");

// Identifiants Firebase. Deux façons de les fournir, au choix :
//   1. FIREBASE_SERVICE_ACCOUNT : le fichier JSON entier, collé tel quel.
//   2. Les trois variables séparées PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY.
function identifiants(){
  const brut = process.env.FIREBASE_SERVICE_ACCOUNT;
  if(brut && brut.trim()){
    const j = JSON.parse(brut);
    return {
      projectId:   j.project_id,
      clientEmail: j.client_email,
      privateKey:  (j.private_key || "").replace(/\\n/g, "\n")
    };
  }
  return {
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // la clé peut contenir de vrais retours à la ligne ou la séquence \n
    privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "")
                   .replace(/^["']|["']$/g, "")
                   .replace(/\\n/g, "\n")
  };
}

if(!admin.apps.length){
  admin.initializeApp({ credential: admin.credential.cert(identifiants()) });
}
const db = admin.firestore();

const reponse = (code, corps) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corps)
});

// Vérifie le jeton envoyé par le navigateur et renvoie l'identité du compte.
async function utilisateurDepuisEntete(headers){
  const brut = headers.authorization || headers.Authorization || "";
  const jeton = brut.startsWith("Bearer ") ? brut.slice(7) : null;
  if(!jeton) throw new Error("jeton absent");
  const decode = await admin.auth().verifyIdToken(jeton);
  return { uid: decode.uid, email: decode.email };
}
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
