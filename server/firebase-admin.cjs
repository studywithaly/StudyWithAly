// Minimal compatibility facade over the supported modular Admin SDK entry points.
const app=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue,FieldPath}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');
exports.initializeApp=app.initializeApp;
exports.credential={cert:app.cert};
Object.defineProperty(exports,'apps',{get:()=>app.getApps()});
exports.auth=getAuth;
exports.firestore=Object.assign(getFirestore,{FieldValue,FieldPath});
exports.messaging=getMessaging;
