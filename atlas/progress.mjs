import {structures} from './data.mjs';

// Persist one field on the current account; never replace a profile or claim success early.
export function createProgressStore({getUser,isCloud,getDatabase,saveLocal}){
 return {
  progress:()=>getUser()?.atlasProgress||{},
  async mark(id){
   if(!structures.some(s=>s.id===id))throw new Error('Structure inconnue.');
   const owner=getUser();if(!owner)throw new Error('Connectez-vous pour enregistrer votre progression.');
   const at=Date.now(),cloud=isCloud();
   if(cloud)await getDatabase().collection('users').doc(owner.id).set({atlasProgress:{[id]:at}},{merge:true});
   const current=getUser();if(current?.id!==owner.id)return;
   const previous=current.atlasProgress;
   current.atlasProgress={...(previous||{}),[id]:at};
   if(!cloud){try{await saveLocal();}catch(error){current.atlasProgress=previous;throw error;}}
  }
 };
}
