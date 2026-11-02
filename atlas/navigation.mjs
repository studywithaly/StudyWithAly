export class ZoomIntent {
 constructor(){this.candidate=null;this.started=0;this.events=0;this.amount=0;this.cooldownUntil=0;}
 reset(now=0){this.candidate=null;this.events=0;this.amount=0;this.cooldownUntil=now+1100;}
 sample({candidate,direction,ratio,now,canBack=false}){
  if(now<this.cooldownUntil||!Number.isFinite(ratio))return null;
  const key=direction<0?candidate:canBack?'__back':null;
  if(!key){this.candidate=null;return null;}
  if(key!==this.candidate){this.candidate=key;this.started=now;this.events=0;this.amount=0;}
  this.events++;this.amount+=Math.abs(direction);
  const threshold=key==='__back'?ratio>3.1:ratio<1.9;
  if(threshold&&this.events>=2&&this.amount>=70&&now-this.started>=100){this.reset(now);return key;}
  return null;
 }
}

// Loading, camera state, history and cancellation are kept out of the renderer.
export class AnatomicalNavigator {
 constructor({nodes,load,camera,onChange=()=>{},onMissing=()=>{},onError=()=>{}}){Object.assign(this,{nodes,load,camera,onChange,onMissing,onError});this.current=null;this.target=null;this.stack=[];this.visits=[];this.generation=0;this.request=null;}
 async go(id,{record=true,force=false,view=null,preserveCamera=false}={}){
  const node=this.nodes.get(id);if(!node)return false;if(!node.available){this.onMissing(node);return false;}
  if(this.current===id&&!force)return true;
  const previous=this.current,snapshot=this.camera?.(),token=++this.generation;
  this.request?.abort();this.request=new AbortController();this.target=id;
  try{
   const loaded=await this.load(node,{signal:this.request.signal,view:view||(preserveCamera?snapshot:null)});
   if(token!==this.generation)return false;
   if(record&&previous&&previous!==id)this.stack.push({id:previous,view:snapshot});
   this.current=id;this.target=null;
   if(this.visits.at(-1)!==id)this.visits.push(id);this.visits=this.visits.slice(-24);
   this.onChange(node,loaded);return true;
  }catch(error){if(token===this.generation&&error.name!=='AbortError'){this.target=null;this.onError(error,node);}return false;}
 }
 async back(){const entry=this.stack.pop();if(!entry)return false;const request=this.go(entry.id,{record:false,view:entry.view}),generation=this.generation;const success=await request;if(!success&&generation===this.generation)this.stack.push(entry);return success;}
 home(){return this.go('body');}
 refresh(){return this.go(this.target||this.current||'body',{record:false,force:true,preserveCamera:true});}
 dispose(){this.generation++;this.request?.abort();}
}
