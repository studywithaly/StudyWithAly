// Reçoit les événements Stripe et met à jour les droits.
// C'est le seul endroit où un abonnement peut être accordé.
const stripe = require("stripe")(process.env.STRIPE_CLE_SECRETE);

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

async function accorderAbonnement(uid, plan, finMs, statut, idAbo){
  await db.collection("droits").doc(uid).set({
    abo: { plan, fin: finMs, statut, stripeSub: idAbo || null },
    maj: Date.now()
  }, { merge:true });
}

async function ajouterAchat(uid, ref){
  const base = await db.collection("contenu").doc("base").get();
  const livres = (base.data() || {}).livres || [];
  const cible = livres.find(l => l.id === ref);
  // un pack multi-matières débloque tous les ouvrages
  const ids = (cible && cible.m === "all") ? livres.map(l => l.id) : [ref];
  await db.collection("droits").doc(uid).set({
    achats: admin.firestore.FieldValue.arrayUnion(...ids),
    maj: Date.now()
  }, { merge:true });
}

async function enregistrerVente(v){
  await db.collection("ventes").add(Object.assign({ date: Date.now() }, v));
}

exports.handler = async (event) => {
  let evt;
  try{
    evt = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
      process.env.STRIPE_SECRET_WEBHOOK
    );
  }catch(e){
    console.error("signature invalide", e.message);
    return reponse(400, { erreur:"signature invalide" });
  }

  try{
    switch(evt.type){

      case "checkout.session.completed": {
        const s = evt.data.object;
        const { uid, type, ref } = s.metadata || {};
        if(!uid) break;

        if(type === "livre"){
          await ajouterAchat(uid, ref);
          await enregistrerVente({ uid, type:"livre", ref, montant:s.amount_total/100, session:s.id });
        }
        if(type === "abo" && s.subscription){
          const sub = await stripe.subscriptions.retrieve(s.subscription);
          await accorderAbonnement(uid, ref, sub.current_period_end * 1000, "actif", sub.id);
          await enregistrerVente({ uid, type:"abo", ref, montant:s.amount_total/100, session:s.id });
        }
        break;
      }

      // renouvellement mensuel ou annuel : on repousse l'échéance
      case "invoice.paid": {
        const f = evt.data.object;
        if(!f.subscription) break;
        const sub = await stripe.subscriptions.retrieve(f.subscription);
        const uid = (sub.metadata || {}).uid;
        if(!uid) break;
        await accorderAbonnement(uid, sub.metadata.plan || "mensuel", sub.current_period_end * 1000, "actif", sub.id);
        await enregistrerVente({ uid, type:"abo", ref:sub.metadata.plan, montant:f.amount_paid/100, facture:f.id });
        break;
      }

      // changement de formule, mise en pause, échec de paiement
      case "customer.subscription.updated": {
        const sub = evt.data.object;
        const uid = (sub.metadata || {}).uid;
        if(!uid) break;
        const vivant = ["active","trialing","past_due"].includes(sub.status);
        await accorderAbonnement(uid, sub.metadata.plan || "mensuel",
          sub.current_period_end * 1000, vivant ? "actif" : "suspendu", sub.id);
        break;
      }

      // résiliation : l'accès court jusqu'à la fin de la période déjà réglée
      case "customer.subscription.deleted": {
        const sub = evt.data.object;
        const uid = (sub.metadata || {}).uid;
        if(!uid) break;
        await accorderAbonnement(uid, sub.metadata.plan || "mensuel",
          sub.current_period_end * 1000, "resilie", sub.id);
        break;
      }
    }

    return reponse(200, { recu:true });

  }catch(e){
    console.error("webhook", evt.type, e);
    return reponse(500, { erreur: e.message });   // Stripe retentera automatiquement
  }
};
