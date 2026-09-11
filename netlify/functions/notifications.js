const crypto = require('crypto');
const admin = require('firebase-admin');
function services() {
  if (!admin.apps.length) {
    let raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) raw = raw.slice(1,-1);
    const account = raw ? JSON.parse(raw) : {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/^["']|["']$/g,'').replace(/\\n/g,'\n')
    };
    admin.initializeApp({credential: admin.credential.cert(account)});
  }
  return {admin, db: admin.firestore()};
}
function preferences(body) {
  if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 4096) throw Error('Jeton invalide.');
  const hour = Number(body.hour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw Error('Heure invalide.');
  if (typeof body.timezone !== 'string' || body.timezone.length > 80) throw Error('Fuseau invalide.');
  new Intl.DateTimeFormat('fr', {timeZone: body.timezone}).format();
  if (typeof body.reminders !== 'boolean' || typeof body.news !== 'boolean') throw Error('Choix invalides.');
  return {token: body.token, hour, timezone: body.timezone, reminders: body.reminders, news: body.news};
}
const reply = (statusCode, data) => ({statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify(data)});
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405,{erreur:'Méthode non autorisée.'});
  const {admin,db} = services();
  let user;
  try { user = await admin.auth().verifyIdToken((event.headers.authorization || '').replace(/^Bearer /,''),true);
    if((await db.collection('suppressionComptes').doc(user.uid).get()).exists)throw Error('account-deleting');
  }
  catch { return reply(401,{erreur:'Connecte-toi pour régler tes notifications.'}); }
  let data,ref;
  try {
    data = JSON.parse(event.body || '{}');
    if (typeof data.token !== 'string' || data.token.length < 20 || data.token.length > 4096) throw Error('Jeton invalide.');
    ref = db.collection('notifications').doc(crypto.createHash('sha256').update(data.token).digest('hex'));
    if (data.action === 'remove') {
      await db.runTransaction(async tx => {const old = await tx.get(ref); if(old.exists && old.data().uid === user.uid) tx.delete(ref);});
      return reply(200,{ok:true});
    }
    data = preferences(data);
  } catch { return reply(400,{erreur:'Réglages de notification invalides.'}); }
  try {
    await ref.set({...data, uid:user.uid, updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    return reply(200,{ok:true});
  } catch { return reply(503,{erreur:'Les réglages n’ont pas pu être enregistrés. Réessaie.'}); }
};
exports.services = services;
exports.preferences = preferences;
