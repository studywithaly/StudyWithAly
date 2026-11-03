import guard from '../../server/security.cjs';
import siteApi from './site-api.js';
import checkout from './creer-paiement.js';
import licence from './activer-licence.js';
import portal from './portail-client.js';
import notifications from './notifications.js';
const {json,gate,TRUSTED_API}=guard;
const handlers={
 'site-api':siteApi.handler,
 'creer-paiement':checkout.handler,
 'activer-licence':licence.handler,
 'portail-client':portal.handler,
 'notifications':notifications.handler,
};
const respond=value=>new Response(value.body,{status:value.statusCode,headers:value.headers});
export default async request=>{
 const path=new URL(request.url).pathname,match=/^\/api\/([a-z-]+)\/?$/.exec(path);
 if(!match||!Object.hasOwn(handlers,match[1]))return respond(json(404,{erreur:'Service inconnu.'}));
 const event={path,httpMethod:request.method,headers:Object.fromEntries(request.headers),body:'',isBase64Encoded:false,[TRUSTED_API]:true};
 const rejected=gate(event);if(rejected)return respond(rejected);
 try{
  const chunks=[];let size=0;const reader=request.body?.getReader();
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();return respond(json(413,{erreur:'Requête trop volumineuse.'}));}chunks.push(value);}}finally{reader.releaseLock();}}
  event.body=Buffer.concat(chunks).toString('utf8');
  return respond(await handlers[match[1]](event));
 }catch(error){console.error('protected-api',error.code||error.name);return respond(json(503,{erreur:'Service temporairement indisponible.'}));}
};
export const config={path:'/api/*',rateLimit:{windowLimit:180,windowSize:60,aggregateBy:['ip','domain']}};
