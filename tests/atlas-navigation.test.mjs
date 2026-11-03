import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../main.js',import.meta.url),'utf8');
const learning=await fs.readFile(new URL('../learning.js',import.meta.url),'utf8');
const atlas=await fs.readFile(new URL('../atlas.js',import.meta.url),'utf8');
function fixture(){
 const zone={innerHTML:''},plus={classList:{toggle(){},add(){}}},plan={textContent:''};
 let resolveImport,mounts=0,disposals=0,cleared=0;
 const context=vm.createContext({window:{scrollTo(){}},document:{querySelector:s=>s==='#zone'?zone:plus,querySelectorAll:()=>[]},$:s=>s==='#zone'?zone:plan,libellePlan:()=>'',U:{id:'owner'},MODE_CLOUD:false,fdb:null,sauver(){},VUE:'quiz',Q:{timer:123},navigationRevision:0,clearInterval(){cleared++;},afficherMinuteurRevision(){},Auth:{deconnecter:async()=>true},loadAtlasModule:()=>new Promise(resolve=>{resolveImport=resolve;})});
 for(const name of ['Fiches','Quiz','Flashcards','Progression','Boutique','Bibliotheque','Profil','Dev'])context['vue'+name]=()=>name;
 const router=html.slice(html.indexOf('const App = {'),html.indexOf('\nfunction ouvrirMenuMobile'));
 const wrapper=learning.slice(learning.indexOf('const navigationAvantRevision=App.aller;'),learning.indexOf('const logoutAvantRevision='));
 // Replace only the module transport with a controllable promise; execute the actual router chain.
 vm.runInContext(router+'\n'+wrapper+'\n'+atlas.replace("import('/atlas/app.mjs')",'loadAtlasModule()'),context);
 return {context,zone,get mounts(){return mounts;},get disposals(){return disposals;},get cleared(){return cleared;},async resolve(){resolveImport({mount(){mounts++;return ()=>{disposals++;};},createProgressStore:()=>({})});await Promise.resolve();await Promise.resolve();}};
}
test('Opening Atlas invokes the learning router and clears a running quiz',()=>{
 const f=fixture();vm.runInContext("App.aller('atlas')",f.context);
 assert.equal(f.context.Q,null);assert.equal(f.context.navigationRevision,1);assert.equal(f.cleared,1);assert(f.zone.innerHTML.includes('Chargement'));
});
test('Navigation disposes the mounted viewer and preserves the requested destination',async()=>{
 const f=fixture();vm.runInContext("App.aller('atlas')",f.context);await f.resolve();assert.equal(f.mounts,1);
 vm.runInContext("App.aller('fiches')",f.context);assert.equal(f.disposals,1);assert.equal(f.zone.innerHTML,'Fiches');
});
test('A delayed import cannot reopen Atlas after navigation or logout',async()=>{
 for(const action of ["App.aller('fiches')","Auth.deconnecter()"]){const f=fixture();vm.runInContext("App.aller('atlas');"+action,f.context);await f.resolve();assert.equal(f.mounts,0);}
});
test('Logout releases a mounted viewer',async()=>{
 const f=fixture();vm.runInContext("App.aller('atlas')",f.context);await f.resolve();await vm.runInContext('Auth.deconnecter()',f.context);assert.equal(f.disposals,1);
});
