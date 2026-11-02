import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProgressStore} from '../atlas/progress.mjs';

function fixture(set){
 let user={id:'learner',atlasProgress:{pons:1},name:'Unchanged'};
 const writes=[];
 const db={collection(name){assert.equal(name,'users');return {doc(id){assert.equal(id,'learner');return {async set(value,options){writes.push({value,options});await set?.();}};}};}};
 return {get user(){return user;},switchUser(){user={id:'another'};},writes,store:createProgressStore({getUser:()=>user,isCloud:()=>true,getDatabase:()=>db})};
}
test('Progress waits for Firestore acknowledgement and merges a single structure',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));
 const request=f.store.mark('hippocampus');assert.equal(f.user.atlasProgress.hippocampus,undefined);
 finish();await request;
 assert.equal(f.user.atlasProgress.pons,1);assert(f.user.atlasProgress.hippocampus>0);
 assert.deepEqual(f.writes[0].options,{merge:true});assert.deepEqual(Object.keys(f.writes[0].value),['atlasProgress']);
 assert.deepEqual(Object.keys(f.writes[0].value.atlasProgress),['hippocampus']);assert.equal(f.user.name,'Unchanged');
});
test('Failed writes do not mark a structure as studied',async()=>{
 const f=fixture(()=>{throw Error('permission-denied');});
 await assert.rejects(f.store.mark('hippocampus'),/permission-denied/);
 assert.deepEqual(f.store.progress(),{pons:1});
});
test('A completion after logout or account change never mutates the new account',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));
 const request=f.store.mark('hippocampus');f.switchUser();finish();await request;
 assert.deepEqual(f.user,{id:'another'});
});
test('Unknown structure IDs and missing accounts cannot create progress',async()=>{
 const f=fixture();await assert.rejects(f.store.mark('made-up'),/inconnue/);assert.equal(f.writes.length,0);
 const store=createProgressStore({getUser:()=>null});await assert.rejects(store.mark('pons'),/Connectez/);
});
test('Local save failures restore the previous progress map',async()=>{
 const user={id:'local',atlasProgress:{pons:1}};
 const store=createProgressStore({getUser:()=>user,isCloud:()=>false,saveLocal:()=>{throw Error('disk full');}});
 await assert.rejects(store.mark('hippocampus'),/disk full/);assert.deepEqual(user.atlasProgress,{pons:1});
});
