// Loaded after learning.js; keep the existing application router and account store.
(() => {
 const previous=App.aller;
 let generation=0,dispose=null;
 App.aller=function(view){
   const token=++generation;
   dispose?.(); dispose=null;
   if(view!=='atlas')return previous.call(this,view);
   VUE=view;
   document.querySelectorAll('.nav-lien').forEach(b=>b.classList.toggle('actif',b.dataset.vue===view));
   document.querySelector('.nav-plus')?.classList.add('actif');
   const zone=document.querySelector('#zone');
   zone.innerHTML='<section class="carte" role="status">Chargement de l’Atlas 3D…</section>';
   import('/atlas/app.mjs').then(({mount})=>{
     if(token!==generation)return;
     dispose=mount(zone,{
       progress:()=>U?.atlasProgress||{},
       mark(id){if(!U)return;U.atlasProgress={...(U.atlasProgress||{}),[id]:Date.now()};sauver();}
     });
     if(token!==generation){dispose?.();dispose=null;}
   }).catch(()=>{if(token===generation)zone.innerHTML='<section class="carte" role="alert">L’Atlas est indisponible. Vérifiez votre connexion puis revenez dans cette rubrique.</section>';});
   window.scrollTo({top:0});
 };
})();
