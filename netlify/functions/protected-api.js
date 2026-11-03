// One CDN quota for all account APIs, within the site's two-rule plan limit.
const {json,TRUSTED_API}=require('../../server/security.cjs');
const handlers={
 'site-api':()=>require('./site-api').handler,
 'creer-paiement':()=>require('./creer-paiement').handler,
 'activer-licence':()=>require('./activer-licence').handler,
 'portail-client':()=>require('./portail-client').handler,
 'notifications':()=>require('./notifications').handler,
};
exports.handler=async event=>{
 const match=/^\/api\/([a-z-]+)\/?$/.exec(event.path||'');
 if(!match||!Object.hasOwn(handlers,match[1]))return json(404,{erreur:'Service inconnu.'});
 try{return await handlers[match[1]]()({...event,[TRUSTED_API]:true});}
 catch(error){console.error('protected-api',error.code||error.name);return json(503,{erreur:'Service temporairement indisponible.'});}
};
exports.config={path:'/api/*',rateLimit:{windowLimit:180,windowSize:60,aggregateBy:['ip','domain']}};
