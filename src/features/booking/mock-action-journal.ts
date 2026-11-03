export type MockAction={kind:'start'|'resolve'|'cancel'|'refund';target?:string;outcome?:string;expectedFee?:number};
type Storage={getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<unknown>};
type Entry={id:string;bookingId:string;signature:string;action:MockAction;phase:'sent'|'complete'};
/** Only IDs, simulation choice and expected fee; never traveller/card details. */
export function createMockActionJournal(storage:Storage,uuid:()=>string){
 const tails=new Map<string,Promise<unknown>>();
 return {run<T>(owner:string,bookingId:string,signature:string,action:MockAction,send:(action:MockAction,id:string)=>Promise<T>){
  const key=`flyora.mockAction.v1.${owner}.${bookingId}`;
  const task=(tails.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
   if(!owner||!bookingId)throw Error('booking.authRequired');
   let old:Entry|null;
   try{const raw=await storage.getItem(key);old=raw?JSON.parse(raw):null;
    if(old&&(old.bookingId!==bookingId||!old.id||!old.signature||!['sent','complete'].includes(old.phase)||!old.action))throw Error();
   }catch{throw Error('mock.storage');}
   const recovered=!!old&&old.phase==='sent';
   const entry:Entry=old&&(recovered||old.signature===signature)?old:{id:uuid(),bookingId,signature,action,phase:'sent'};
   try{await storage.setItem(key,JSON.stringify({...entry,phase:'sent'}));}catch{throw Error('mock.storage');}
   const value=await send(entry.action,entry.id);
   try{await storage.setItem(key,JSON.stringify({...entry,phase:'complete'}));}catch{/* replaying the same UUID remains safe */}
   return {value,recovered};
  });
  tails.set(key,task);void task.finally(()=>{if(tails.get(key)===task)tails.delete(key);}).catch(()=>{});return task;
 }};
}
