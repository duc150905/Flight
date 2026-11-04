import type {Config} from './signing.ts';
export function readConfig(get:(key:string)=>string|undefined):Config{
 const tmnCode=get('VNPAY_TMN_CODE')??'',secret=get('VNPAY_HASH_SECRET')??'',returnUrl=get('VNPAY_RETURN_URL')??'';
 if(!/^[A-Za-z0-9]{8}$/.test(tmnCode)||secret.length<16||!returnUrl.startsWith('https://'))throw Error('payment.config');
 return {tmnCode,secret,returnUrl};
}
