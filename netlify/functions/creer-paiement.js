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

// Managed Payments (Stripe vendeur officiel) est activé par défaut sur les
// nouveaux comptes et exige un code fiscal sur chaque produit. On le désactive
// tant que le statut juridique et la TVA ne sont pas tranchés.
const SANS_MANAGED_PAYMENTS = { managed_payments: { enabled: false } };

const PLANS = {
  mensuel: { libelle:"Abonnement mensuel", montant:500,  intervalle:"month" },
  annuel:  { libelle:"Abonnement annuel",  montant:5000, intervalle:"year"  }
};

exports.handler = async (event) => {
  const rejected=gate(event);if(rejected)return rejected;
  if(event.httpMethod !== "POST") return reponse(405, { erreur:"méthode non autorisée" });

  let user;
  try{ user = await utilisateurDepuisEntete(event.headers); }
  catch(e){ return reponse(401, { erreur:"connexion requise" }); }
  const db=user.db;

  let type,ref;
  try{({type,ref}=JSON.parse(event.body||'{}'));}catch{return reponse(400,{erreur:'Requête invalide.'});}
  if(!['abo','livre'].includes(type)||typeof ref!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(ref))return reponse(400,{erreur:'Achat invalide.'});
  const site = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
  const retour = { success_url: site + "/?paiement=ok", cancel_url: site + "/?paiement=annule" };

  try{
    const stripe=require('stripe')(process.env.STRIPE_CLE_SECRETE);
    if(type==='abo'&&!Object.hasOwn(PLANS,ref))return reponse(400,{erreur:'Formule inconnue.'});
    // On réutilise le client Stripe existant, pour que l'historique reste groupé
    const droits = await db.collection("droits").doc(user.uid).get();
    let client = droits.exists ? droits.data().clientStripe : null;
    if(!client){
      const c = await stripe.customers.create({ email:user.email, metadata:{ uid:user.uid } },{idempotencyKey:'customer-'+user.uid});
      client = c.id;
      await db.collection("droits").doc(user.uid).set({ clientStripe:client }, { merge:true });
    }

    let session;

    if(type === "abo"){
      const plan = Object.hasOwn(PLANS,ref)?PLANS[ref]:null;
      if(!plan) return reponse(400, { erreur:"formule inconnue" });
      session = await stripe.checkout.sessions.create({
        mode:"subscription",
        customer: client,
        ...SANS_MANAGED_PAYMENTS,
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
        ...SANS_MANAGED_PAYMENTS,
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
    console.error("creer-paiement", e.code||e.name);
    return reponse(500, { erreur: "Service temporairement indisponible." });
  }
};

