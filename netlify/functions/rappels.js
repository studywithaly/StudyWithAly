const {services} = require('./notifications');
exports.config = {schedule:'0 * * * *'};
function localTime(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const p = Object.fromEntries(parts.map(v=>[v.type,v.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};
}
exports.handler = async () => {
  const {admin,db} = services();
  const now = new Date();
  const base = await db.collection('contenu').doc('base').get();
  if (!base.exists) return {statusCode:200};
  const current = (base.data().fiches || []).map(f=>String(f.id)).sort();
  const meta = db.collection('notificationsMeta').doc('catalogue');
  const newsRevision = await db.runTransaction(async tx => {
    const old = await tx.get(meta), previous = old.exists ? old.data() : null;
    const added = previous && current.some(id=>!previous.ids.includes(id));
    const revision = added ? now.toISOString() : (previous?.revision || '');
    tx.set(meta,{ids:current,revision});
    return revision;
  });
  // Paginate subscriptions so accounts are not silently omitted once the app grows.
  let cursor, sent=0;
  do {
    let query=db.collection('notifications').orderBy(admin.firestore.FieldPath.documentId()).limit(100);
    if(cursor)query=query.startAfter(cursor);
    const page=await query.get();
    if(page.empty)break;
    await Promise.all(page.docs.map(async doc=>{
      const subscription=doc.data();
      if(subscription.updatedAt?.toDate().getTime() < now.getTime()-90*24*60*60*1000){await doc.ref.delete();return;}
      let local;
      try {local=localTime(now,subscription.timezone);} catch {return;}
      const reminder=subscription.reminders && local.hour===subscription.hour && subscription.lastReminder!==local.date;
      const news=subscription.news && newsRevision && subscription.lastNews!==newsRevision &&
        subscription.updatedAt?.toDate().getTime()<Date.parse(newsRevision);
      if(!reminder && !news)return;
      const claim=await db.runTransaction(async tx=>{
        const fresh=await tx.get(doc.ref);if(!fresh.exists)return false;
        const value=fresh.data();
        if(value.uid!==subscription.uid || value.token!==subscription.token ||
          reminder && !value.reminders || news && !value.news)return false;
        if(reminder && value.lastReminder===local.date || news && value.lastNews===newsRevision)return false;
        tx.update(doc.ref,{...(reminder?{lastReminder:local.date}:{}),...(news?{lastNews:newsRevision}:{})});
        return true;
      });
      if(!claim)return;
      try {
        await admin.messaging().send({token:subscription.token,notification:{title:news?'Du nouveau sur Studywithaaly':'Il est temps de réviser',body:news?'De nouvelles fiches sont disponibles. Prêt pour une séance ?':'Quelques minutes de fiches, de quiz ou de flashcards pour avancer à ton rythme.'},webpush:{headers:{TTL:'3600'},notification:{icon:'https://studywithaaly.fr/app-icon-192.png',tag:news?'swa-news':'swa-reminder'},fcmOptions:{link:'https://studywithaaly.fr/?source=notification'}}});
        sent++;
      } catch(error) {
        if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code))await doc.ref.delete();
        else console.error('Notification non distribuée',error.code || 'unavailable');
      }
    }));
    cursor=page.docs.at(-1);
    if(page.size<100)break;
  }while(cursor);
  return {statusCode:200,body:JSON.stringify({sent})};
};
exports.localTime=localTime;
