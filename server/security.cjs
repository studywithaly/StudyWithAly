const {URL}=require('node:url');
const json=(statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
function header(event,name){const key=Object.keys(event.headers||{}).find(k=>k.toLowerCase()===name.toLowerCase());return key?event.headers[key]:'';}
function bearer(event){const match=/^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(header(event,'authorization')||'');return match?.[1]||null;}
function publicOrigin(value){try{const url=new URL(value);return url.protocol==='https:'&&((['studywithaaly.fr','www.studywithaaly.fr','studywithaly.netlify.app'].includes(url.hostname))||/^deploy-preview-\d+--studywithaly\.netlify\.app$/.test(url.hostname))&&url.origin===value;}catch{return false;}}
function gate(event,{maxBytes=32768,signature=false}={}){
 if(event.httpMethod!=='POST')return json(405,{erreur:'Méthode non autorisée.'});
 const body=event.body||'';if(typeof body!=='string'||Buffer.byteLength(body,event.isBase64Encoded?'base64':'utf8')>maxBytes)return json(413,{erreur:'Requête trop volumineuse.'});
 if(signature)return null;
 const origin=header(event,'origin');if(origin&&!publicOrigin(origin))return json(403,{erreur:'Origine non autorisée.'});
 if(header(event,'sec-fetch-site')==='cross-site')return json(403,{erreur:'Requête intersite refusée.'});
 if(!bearer(event))return json(401,{erreur:'Connexion requise.'});
 const type=(header(event,'content-type')||'').split(';')[0].trim().toLowerCase();if(type!=='application/json')return json(415,{erreur:'Utilise le format JSON.'});
 return null;
}
module.exports={json,header,bearer,gate};
