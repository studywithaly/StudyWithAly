// Crée une session de paiement Stripe.
// Le prix n'est jamais lu depuis le navigateur : il est relu dans Firestore,
// sinon n'importe qui pourrait s'acheter l'abonnement à un centime.
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

// TVA : mets la variable STRIPE_TVA à "auto" sur Netlify pour que Stripe
// calcule et collecte la taxe du pays de l'acheteur. Laisse vide tant que tu
// n'es pas assujetti : Stripe facturerait alors une taxe que tu n'as pas à percevoir.
const TVA_AUTO = process.env.STRIPE_TVA === "auto";
const optionsTva = TVA_AUTO ? {
  automatic_tax: { enabled: true },
  // Stripe a besoin de l'adresse de l'acheteur pour déterminer le taux
  customer_update: { address: "auto", name: "auto" },
  billing_address_collection: "required",
  // un client professionnel peut saisir son numéro de TVA intracommunautaire
  tax_id_collection: { enabled: true }
} : {};

const PLANS = {
  mensuel: { libelle:"Abonnement mensuel", montant:500,  intervalle:"month" },
  annuel:  { libelle:"Abonnement annuel",  montant:5000, intervalle:"year"  }
};

exports.handler = async (event) => {
  if(event.httpMethod !== "POST") return reponse(405, { erreur:"méthode non autorisée" });

  let user;
  try{ user = await utilisateurDepuisEntete(event.headers); }
  catch(e){ return reponse(401, { erreur:"connexion requise" }); }

  const { type, ref } = JSON.parse(event.body || "{}");
  const site = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
  const retour = { success_url: site + "/?paiement=ok", cancel_url: site + "/?paiement=annule" };

  try{
    // On réutilise le client Stripe existant, pour que l'historique reste groupé
    const droits = await db.collection("droits").doc(user.uid).get();
    let client = droits.exists ? droits.data().clientStripe : null;
    if(!client){
      const c = await stripe.customers.create({ email:user.email, metadata:{ uid:user.uid } });
      client = c.id;
      await db.collection("droits").doc(user.uid).set({ clientStripe:client }, { merge:true });
    }

    let session;

    if(type === "abo"){
      const plan = PLANS[ref];
      if(!plan) return reponse(400, { erreur:"formule inconnue" });
      session = await stripe.checkout.sessions.create({
        mode:"subscription",
        customer: client,
        line_items:[{
          quantity:1,
          price_data:{
            currency:"eur",
            unit_amount: plan.montant,
            recurring:{ interval: plan.intervalle },
            product_data:{ name: plan.libelle }
          }
        }],
        subscription_data:{ metadata:{ uid:user.uid, plan:ref } },
        metadata:{ uid:user.uid, type:"abo", ref },
        locale:"fr",
        ...optionsTva,
        ...retour
      });

    } else if(type === "livre"){
      const base = await db.collection("contenu").doc("base").get();
      const livre = ((base.data() || {}).livres || []).find(l => l.id === ref);
      if(!livre) return reponse(400, { erreur:"ouvrage inconnu" });
      session = await stripe.checkout.sessions.create({
        mode:"payment",
        customer: client,
        line_items:[{
          quantity:1,
          price_data:{
            currency:"eur",
            unit_amount: Math.round(Number(livre.prix) * 100),
            product_data:{ name: livre.titre, description: livre.soustitre || undefined }
          }
        }],
        metadata:{ uid:user.uid, type:"livre", ref },
        locale:"fr",
        ...optionsTva,
        ...retour
      });

    } else {
      return reponse(400, { erreur:"type d'achat inconnu" });
    }

    return reponse(200, { url: session.url });

  }catch(e){
    console.error("creer-paiement", e);
    return reponse(500, { erreur: e.message });
  }
};
