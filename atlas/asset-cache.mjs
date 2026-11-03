// Cache only public anatomical transfer buffers. One transfer per pack and navigation signal.
export class AnatomicalAssetCache {
 constructor({maxBytes=32*1024*1024,fetcher=(...args)=>globalThis.fetch(...args),bundles={}}={}){Object.assign(this,{maxBytes,fetcher,bundles});this.entries=new Map();this.pending=new Map();this.failedBundles=new Set();this.bytes=0;}
 async get(asset,signal,useBundle=true){
  signal?.throwIfAborted();const pack=useBundle&&this.bundles[asset.url];
  if(pack&&!this.failedBundles.has(pack.url)){try{const bytes=await this.get(pack,signal,false);if(pack.offset+pack.length>bytes.byteLength)throw Error('Archive anatomique incomplète.');return bytes.slice(pack.offset,pack.offset+pack.length);}catch(error){if(signal?.aborted)throw error;this.failedBundles.add(pack.url);}}
  if(pack)return this.get(asset,signal,false);
  const key=asset.url+'?v='+asset.sha256.slice(0,16);
  if(this.entries.has(key)){const value=this.entries.get(key);this.entries.delete(key);this.entries.set(key,value);return value;}
  const existing=this.pending.get(key);if(existing&&existing.signal===signal)return existing.promise;
  const request={signal};request.promise=(async()=>{
   const response=await this.fetcher(key,{signal,cache:'force-cache'});if(!response.ok)throw new Error(`Modèle indisponible (${response.status}).`);
   const value=await response.arrayBuffer();signal?.throwIfAborted();
   if(this.entries.has(key))return this.entries.get(key);
   if(value.byteLength<=this.maxBytes){while(this.bytes+value.byteLength>this.maxBytes&&this.entries.size){const oldest=this.entries.keys().next().value;this.bytes-=this.entries.get(oldest).byteLength;this.entries.delete(oldest);}this.entries.set(key,value);this.bytes+=value.byteLength;}
   return value;
  })();this.pending.set(key,request);
  try{return await request.promise;}finally{if(this.pending.get(key)===request)this.pending.delete(key);}
 }
 async preload(models,signal){const queue=models.slice(0,24);await Promise.all(Array.from({length:2},async()=>{while(queue.length&&!signal?.aborted){const model=queue.shift();try{await this.get(model.variants.fine,signal,false);}catch{if(signal?.aborted)return;}}}));}
 clear(){this.entries.clear();this.pending.clear();this.failedBundles.clear();this.bytes=0;}
}

// Spread the first transfers across packs rather than blocking every worker on the same pack.
export function planSceneDownloads(models,detail,bundles={}){
 const buckets=new Map();for(const model of models.toSorted((a,b)=>(b.system==='skin')-(a.system==='skin'))){const asset=model.variants?.[detail]||model.variants?.fine||{url:model.url},key=bundles[asset.url]?.url||asset.url;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(model);}
 const queue=[];while(buckets.size)for(const [key,bucket] of buckets){queue.push(bucket.shift());if(!bucket.length)buckets.delete(key);}return queue;
}
