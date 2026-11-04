import {readFileSync,writeFileSync} from 'node:fs';import {readConfig} from '../supabase/functions/_shared/vnpay/config.ts';import {createPayUrl,vnDate} from '../supabase/functions/_shared/vnpay/signing.ts';
const values=Object.fromEntries(readFileSync('.env.vnpay.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const raw=readFileSync('supabase/.temp/checkout-options/vnpay-live-attempt.json','utf8');const data=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));const attempt=data.rows[0].attempt;
const config=readConfig(k=>values[k]);if(process.env.VNPAY_READINESS_RETURN_URL)config.returnUrl=process.env.VNPAY_READINESS_RETURN_URL;
const url=await createPayUrl({...attempt,ref:crypto.randomUUID().replaceAll('-',''),ip:attempt.ip.split('/')[0],created:vnDate(),expires:vnDate(new Date(Date.now()+15*60*1000))},config);
const cookies=new Map();let next=url,response;
for(let hop=0;hop<8;hop++){
 response=await fetch(next,{redirect:'manual',headers:{'User-Agent':'Mozilla/5.0',Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},signal:AbortSignal.timeout(20000)});
 for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],eq=pair.indexOf('=');cookies.set(pair.slice(0,eq),pair.slice(eq+1));}
 const location=response.headers.get('location');if(!location)break;
 next=new URL(location,next).toString();if(new URL(next).hostname!=='sandbox.vnpayment.vn')throw Error('Unexpected redirect host');
}
const html=await response.text();writeFileSync('supabase/.temp/checkout-options/vnpay-hosted-checkout.html',html);
console.log(JSON.stringify({status:response.status,path:new URL(response.url).pathname,title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim(),hasBankSelection:/NCB|Chọn ngân hàng|Select payment method|bankcode/i.test(html),errorCode:new URL(response.url).searchParams.get('code')}));
