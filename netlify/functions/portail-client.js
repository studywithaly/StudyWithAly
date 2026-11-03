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
  if(event.httpMethod!=='POST')return reponse(405,{erreur:'Méthode non autorisée.'});
  let user;
  try{ user = await utilisateurDepuisEntete(event.headers); }
  catch(e){ return reponse(401, { erreur:"connexion requise" }); }
  const db=user.db;

  try{
    const stripe=require('stripe')(process.env.STRIPE_CLE_SECRETE);
    const d = await db.collection("droits").doc(user.uid).get();
    const client = d.exists ? d.data().clientStripe : null;
    if(!client) return reponse(400, { erreur:"aucun paiement enregistré pour ce compte" });

    const session = await stripe.billingPortal.sessions.create({
      customer: client,
      return_url: (process.env.URL || "") + "/"
    });
    return reponse(200, { url: session.url });

  }catch(e){
    console.error("portail", e.code||e.name);
    return reponse(500, { erreur: "Service temporairement indisponible." });
  }
};

