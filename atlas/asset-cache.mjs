// Cache decoded transfer buffers, never user data or authenticated requests.
export class AnatomicalAssetCache {
 constructor({maxBytes=32*1024*1024,fetcher=(...args)=>globalThis.fetch(...args)}={}){this.maxBytes=maxBytes;this.fetcher=fetcher;this.entries=new Map();this.bytes=0;}
 async get(asset,signal){
  signal?.throwIfAborted();
  const key=asset.url+'?v='+asset.sha256.slice(0,16);
  if(this.entries.has(key)){const value=this.entries.get(key);this.entries.delete(key);this.entries.set(key,value);return value;}
  const response=await this.fetcher(key,{signal,cache:'force-cache'});if(!response.ok)throw new Error(`Modèle indisponible (${response.status}).`);
  const value=await response.arrayBuffer();if(signal?.aborted)throw new DOMException('Navigation annulée','AbortError');
  if(this.entries.has(key))return this.entries.get(key);
  if(value.byteLength<=this.maxBytes){while(this.bytes+value.byteLength>this.maxBytes&&this.entries.size){const oldest=this.entries.keys().next().value;this.bytes-=this.entries.get(oldest).byteLength;this.entries.delete(oldest);}this.entries.set(key,value);this.bytes+=value.byteLength;}
  return value;
 }
 async preload(models,signal){const queue=models.slice(0,24);await Promise.all(Array.from({length:2},async()=>{while(queue.length&&!signal?.aborted){const model=queue.shift();try{await this.get(model.variants.fine,signal);}catch{if(signal?.aborted)return;}}}));}
 clear(){this.entries.clear();this.bytes=0;}
}

