// Stripe is the payment provider. Only verified events may change entitlements.
const stripe=require('stripe')(process.env.STRIPE_CLE_SECRETE);
const {services}=require('./notifications');
const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const objectId=value=>typeof value==='string'?value:value?.id;
function subscriptionId(invoice){return objectId(invoice.subscription || invoice.parent?.subscription_details?.subscription);}
function paidPeriodEnd(invoice){
  const ends=(invoice.lines?.data||[]).filter(line=>line.type==='subscription'||line.parent?.subscription_item_details||line.subscription||line.price?.recurring).map(line=>Number(line.period?.end)).filter(Number.isFinite);
  const seconds=ends.length?Math.max(...ends):Number(invoice.period_end);
  if(!Number.isFinite(seconds)||seconds<=0)throw Error('paid-period-missing');
  return seconds*1000;
}
async function effectFor(event,db){
  const object=event.data.object;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    const session=await stripe.checkout.sessions.retrieve(object.id);
    const {uid,type,ref}=session.metadata||{};
    if(!uid || !['paid','no_payment_required'].includes(session.payment_status))return null;
    if(type==='livre'){
      const base=await db.collection('contenu').doc('base').get();
      const books=base.data()?.livres||[],book=books.find(b=>b.id===ref);
      if(!book)throw Error('book-not-found');
      return {uid,books:book.m==='all'?books.map(b=>b.id):[book.id],sale:{key:'checkout_'+session.id,type:'livre',ref,montant:session.amount_total/100,session:session.id,date:event.created*1000}};
    }
    if(type==='abo' && session.subscription){
      const sub=await stripe.subscriptions.retrieve(objectId(session.subscription));
      if(sub.metadata?.uid!==uid)throw Error('subscription-owner-mismatch');
      const invoiceId=objectId(session.invoice||sub.latest_invoice);
      if(!invoiceId)return null;
      const invoice=await stripe.invoices.retrieve(invoiceId);
      if(invoice.status!=='paid' && invoice.paid!==true)return null;
      return subscriptionEffect(sub,invoice,event);
    }
  }
  if(event.type==='invoice.paid'){
    const sid=subscriptionId(object);if(!sid)return null;
    const [sub,invoice]=await Promise.all([stripe.subscriptions.retrieve(sid),stripe.invoices.retrieve(object.id)]);
    if(invoice.status!=='paid' && invoice.paid!==true)return null;
    return subscriptionEffect(sub,invoice,event);
  }
  if(['customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed'].includes(event.type)){
    const sid=event.type.startsWith('invoice.')?subscriptionId(object):object.id;
    if(!sid)return null;
    const sub=await stripe.subscriptions.retrieve(sid);
    return sub.metadata?.uid?{uid:sub.metadata.uid,sub}:null;
  }
  return null;
}
function subscriptionEffect(sub,invoice,event){
  const uid=sub.metadata?.uid;if(!uid)return null;
  return {uid,sub,paidUntil:paidPeriodEnd(invoice),sale:{key:'invoice_'+invoice.id,type:'abo',ref:sub.metadata.plan||'mensuel',montant:invoice.amount_paid/100,facture:invoice.id,date:event.created*1000}};
}
async function applyEvent(event,effect,db,admin){
  const eventRef=db.collection('stripeEvenements').doc(event.id);
  return db.runTransaction(async tx=>{
    const seen=await tx.get(eventRef);if(seen.exists)return false;
    if(!effect){tx.set(eventRef,{type:event.type,date:event.created*1000});return true;}
    const rightsRef=db.collection('droits').doc(effect.uid);
    const [rightsDoc,deleted]=await Promise.all([tx.get(rightsRef),tx.get(db.collection('suppressionComptes').doc(effect.uid))]);
    const saleRef=effect.sale?db.collection('ventes').doc(effect.sale.key):null;
    const saleDoc=saleRef?await tx.get(saleRef):null;
    const rights=rightsDoc.data()||{},old=rights.abo;
    if(!deleted.exists){
      const changes={maj:Date.now()};
      if(effect.books)changes.achats=admin.firestore.FieldValue.arrayUnion(...effect.books);
      if(effect.sub){
        const sub=effect.sub;
        const same=!old?.stripeSub||old.stripeSub===sub.id || (effect.paidUntil>Date.now() && Number(old.fin)<=Date.now() && sub.status==='active');
        if(same && (effect.paidUntil || old?.stripeSub===sub.id)){
          const fin=effect.paidUntil?Math.max(Number(old?.fin)||0,effect.paidUntil):Number(old.fin);
          const status=['active','trialing','past_due'].includes(sub.status)?'actif':sub.status==='canceled'?'resilie':'suspendu';
          changes.abo={plan:sub.metadata?.plan||old?.plan||'mensuel',fin,statut:status,stripeSub:sub.id,renouvelle:sub.status!=='canceled'&&!sub.cancel_at_period_end};
        }
      }
      if(changes.abo||changes.achats)tx.set(rightsRef,changes,{merge:true});
    }
    if(saleRef&&!saleDoc.exists){const {key,...sale}=effect.sale;tx.set(saleRef,{...sale,uid:deleted.exists?'compte-supprime':effect.uid});}
    tx.set(eventRef,{type:event.type,date:event.created*1000});
    return true;
  });
}
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return reply(405,{erreur:'Méthode non autorisée.'});
  let verified;
  try{verified=stripe.webhooks.constructEvent(event.isBase64Encoded?Buffer.from(event.body,'base64'):event.body,event.headers['stripe-signature'],process.env.STRIPE_SECRET_WEBHOOK);}
  catch{return reply(400,{erreur:'Signature invalide.'});}
  try{const {db,admin}=services();const effect=await effectFor(verified,db);await applyEvent(verified,effect,db,admin);return reply(200,{recu:true});}
  catch(error){console.error('webhook',verified.type,error.code||error.name);return reply(500,{erreur:'Événement non traité ; une nouvelle tentative est nécessaire.'});}
};
exports.applyEvent=applyEvent;
exports.effectFor=effectFor;
exports.paidPeriodEnd=paidPeriodEnd;
