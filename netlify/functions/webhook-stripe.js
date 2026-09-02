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
  const brut = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();

  if(brut){
    const nettoye = (brut.startsWith("'") || brut.startsWith('"'))
      ? brut.slice(1, -1)
      : brut;
    const j = JSON.parse(nettoye);
    let cle = j.private_key || "";
    if(!cle.includes("\n")) cle = cle.replace(/\\n/g, "\n");
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: cle };
  }

  let cle = (process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if(cle.startsWith('"') && cle.endsWith('"')) cle = cle.slice(1, -1);
  cle = cle.replace(/\\n/g, "\n");

  return {
    projectId:   (process.env.FIREBASE_PROJECT_ID || "").trim(),
    clientEmail: (process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
    privateKey:  cle
  };
}

if(!admin.apps.length){
  const ids = identifiants();
  if(!ids.projectId || !ids.clientEmail || !ids.privateKey){
    throw new Error("Identifiants Firebase absents : renseigne FIREBASE_SERVICE_ACCOUNT "
      + "ou les trois variables séparées, scope Functions activé sur Netlify.");
  }
  if(!ids.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")){
    throw new Error("Clé privée mal formée : les délimiteurs BEGIN/END manquent.");
  }
  admin.initializeApp({ credential: admin.credential.cert(ids) });
}
const db = admin.firestore();

const reponse = (code, corps) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corps)
});

// ---------------------------------------------------------------------------
// Date de fin de période. Stripe a déplacé current_period_end de l'objet
// Subscription vers ses items sur les versions récentes de l'API. On regarde
// aux deux endroits, et on retombe sur un calcul manuel si rien n'est trouvé,
// pour ne jamais écrire une date invalide dans les droits.
// ---------------------------------------------------------------------------
function finDePeriode(sub, plan){
  const brut = sub.current_period_end
    || (sub.items && sub.items.data && sub.items.data[0]
        && sub.items.data[0].current_period_end);

  if(brut && Number.isFinite(Number(brut))) return Number(brut) * 1000;

  console.warn("current_period_end introuvable, calcul de repli", sub.id);
  const jours = plan === "annuel" ? 365 : 30;
  return Date.now() + jours * 86400000;
}

async function accorderAbonnement(uid, plan, finMs, statut, idAbo, renouvelle){
  if(!Number.isFinite(finMs)){
    throw new Error("date de fin invalide pour " + uid);
  }
  await db.collection("droits").doc(uid).set({
    abo: {
      plan, fin: finMs, statut, stripeSub: idAbo || null,
      // false quand le client a annulé : l'accès court jusqu'à l'échéance
      // mais aucun prélèvement ne suivra. Sans cette information le site
      // annonce un renouvellement qui n'aura pas lieu.
      renouvelle: renouvelle !== false
    },
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
    // Netlify encode parfois le corps en base64. constructEvent a besoin du
    // corps brut octet pour octet, sinon la signature ne correspond pas.
    const corpsBrut = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : event.body;

    evt = stripe.webhooks.constructEvent(
      corpsBrut,
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
        if(!uid){ console.warn("session sans uid", s.id); break; }

        if(type === "livre"){
          await ajouterAchat(uid, ref);
          await enregistrerVente({ uid, type:"livre", ref, montant:s.amount_total/100, session:s.id });
        }
        if(type === "abo" && s.subscription){
          const sub = await stripe.subscriptions.retrieve(s.subscription);
          await accorderAbonnement(uid, ref, finDePeriode(sub, ref), "actif", sub.id,
            !sub.cancel_at_period_end);
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
        const plan = sub.metadata.plan || "mensuel";
        await accorderAbonnement(uid, plan, finDePeriode(sub, plan), "actif", sub.id,
          !sub.cancel_at_period_end);
        await enregistrerVente({ uid, type:"abo", ref:plan, montant:f.amount_paid/100, facture:f.id });
        break;
      }

      // changement de formule, mise en pause, échec de paiement
      case "customer.subscription.updated": {
        const sub = evt.data.object;
        const uid = (sub.metadata || {}).uid;
        if(!uid) break;
        const plan = sub.metadata.plan || "mensuel";
        const vivant = ["active","trialing","past_due"].includes(sub.status);
        await accorderAbonnement(uid, plan, finDePeriode(sub, plan),
          vivant ? "actif" : "suspendu", sub.id, !sub.cancel_at_period_end);
        break;
      }

      // résiliation : l'accès court jusqu'à la fin de la période déjà réglée
      case "customer.subscription.deleted": {
        const sub = evt.data.object;
        const uid = (sub.metadata || {}).uid;
        if(!uid) break;
        const plan = sub.metadata.plan || "mensuel";
        await accorderAbonnement(uid, plan, finDePeriode(sub, plan), "resilie", sub.id, false);
        break;
      }
    }

    return reponse(200, { recu:true });

  }catch(e){
    console.error("webhook", evt.type, e);
    return reponse(500, { erreur: e.message });   // Stripe retentera automatiquement
  }
};
