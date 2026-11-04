type Runtime={env:{get(key:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
export const runtime=(globalThis as unknown as {Deno:Runtime}).Deno;
export function env(key:string){const v=runtime.env.get(key);if(!v)throw Error('payment.config');return v;}
export const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,GET,OPTIONS'};
export function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});}
export async function rpc<T=Record<string,unknown>>(name:string,args:Record<string,unknown>):Promise<T>{
 const response=await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:`Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('payment.server');return response.json();
}
export async function owner(request:Request){
 const token=request.headers.get('Authorization')??'';if(!token.startsWith('Bearer '))throw Error('payment.auth');
 const response=await fetch(`${env('SUPABASE_URL')}/auth/v1/user`,{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:token},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('payment.auth');const user=await response.json();if(typeof user.id!=='string')throw Error('payment.auth');return user.id as string;
}
export function uuid(value:unknown){if(typeof value!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))throw Error('payment.invalid');return value;}
export function endpoint(handler:(request:Request)=>Promise<Response>){runtime.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 try{return await handler(request);}catch(e){return json({error:e instanceof Error&&e.message==='payment.auth'?'payment.auth':'payment.unavailable'},e instanceof Error&&e.message==='payment.auth'?401:400);}
});}
