// Ouvre le portail Stripe : l'abonné y gère sa carte, ses factures
// et sa résiliation. Obligatoire pour rester en règle côté service client.
const stripe = require("stripe")(process.env.STRIPE_CLE_SECRETE);
const { db, utilisateurDepuisEntete, reponse } = require("./_firebase");

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
