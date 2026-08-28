// Ouvre le portail Stripe : l'abonné y gère sa carte, ses factures
// et sa résiliation. Obligatoire pour rester en règle côté service client.
const stripe = require("stripe")(process.env.STRIPE_CLE_SECRETE);

// ---------------------------------------------------------------------------
// Initialisation Firebase Admin. Le SDK Admin ignore les règles Firestore :
// c'est ce qui rend les droits infalsifiables depuis le navigateur.
// ---------------------------------------------------------------------------
const admin = require("firebase-admin");

if(!admin.apps.length){
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
    })
  });
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
  let user;
  try{ user = await utilisateurDepuisEntete(event.headers); }
  catch(e){ return reponse(401, { erreur:"connexion requise" }); }

  try{
    const d = await db.collection("droits").doc(user.uid).get();
    const client = d.exists ? d.data().clientStripe : null;
    if(!client) return reponse(400, { erreur:"aucun paiement enregistré pour ce compte" });

    const session = await stripe.billingPortal.sessions.create({
      customer: client,
      return_url: (process.env.URL || "") + "/"
    });
    return reponse(200, { url: session.url });

  }catch(e){
    console.error("portail", e);
    return reponse(500, { erreur: e.message });
  }
};
