// Loaded after learning.js; keep the existing application router and account store.
(() => {
 const previous=App.aller;
 let generation=0,dispose=null;
 const leave=()=>{generation++;dispose?.();dispose=null;};
 window.vueAtlas=()=>'<section class="carte" role="status">Chargement de l’Atlas 3D…</section>';
 App.aller=function(view){
   leave();const token=generation;
   previous.call(this,view);
   if(view!=='atlas')return;
   const zone=document.querySelector('#zone');
   import('/atlas/app.mjs').then(({mount,createProgressStore})=>{
     if(token!==generation)return;
     dispose=mount(zone,createProgressStore({getUser:()=>U,isCloud:()=>MODE_CLOUD,getDatabase:()=>fdb,saveLocal:()=>sauver()}));
     if(token!==generation){dispose?.();dispose=null;}
   }).catch(()=>{if(token===generation)zone.innerHTML='<section class="carte" role="alert">L’Atlas est indisponible. Vérifiez votre connexion puis revenez dans cette rubrique.</section>';});
 };
 const logout=Auth.deconnecter;
 Auth.deconnecter=async function(...args){leave();return logout.apply(this,args);};
})();
