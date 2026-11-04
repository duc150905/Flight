import AsyncStorage from '@react-native-async-storage/async-storage';
import {randomUUID} from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {useFocusEffect} from 'expo-router';
import {useQuery} from '@tanstack/react-query';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useAuth} from '../auth/auth-provider';
import {useLanguage} from '../i18n/provider';
import {createOwnerRpcClient} from './owner-rpc';
import {createStepRequestGuard} from './step-request';
import {safeCheckoutUrl,parseGatewayState} from './vnpay-payment';
export function useVnpayCheckout(bookingId:string,enabled:boolean,changed:()=>void){
 const {session}=useAuth();const {language}=useLanguage();const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false),focused=useRef(false);const [guard]=useState(createStepRequestGuard);
 const ownerId=session?.user.id;
 const client=()=>{if(!session)throw Error('payment.auth');return createOwnerRpcClient({url:process.env.EXPO_PUBLIC_SUPABASE_URL!,key:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,accessToken:session.access_token});};
 const query=useQuery({queryKey:['gateway-payment',ownerId,bookingId],enabled,retry:false,staleTime:0,gcTime:0,queryFn:async()=>{
  const {data,error:failure}=await client().rpc('get_payment_state',{p_booking_id:bookingId});if(failure)throw Error('payment.unavailable');
  return parseGatewayState(data);
 }});
 const refetch=query.refetch;
 useFocusEffect(useCallback(()=>{focused.current=true;if(enabled&&ownerId)void refetch();return()=>{focused.current=false;guard.cancel();};},[enabled,ownerId,refetch,guard]));
 useEffect(()=>{if(!enabled)return;const sub=AppState.addEventListener('change',s=>{if(s==='active')void refetch();});return()=>sub.remove();},[enabled,refetch]);
 async function run(action:(c:ReturnType<typeof client>,current:()=>boolean)=>Promise<void>){
  if(lock.current||!enabled||!session)return;lock.current=true;setBusy(true);setError('');const ticket=guard.begin(),current=()=>focused.current&&guard.isCurrent(ticket);
  try{await action(client(),current);if(current()){await refetch();changed();}}catch{if(current())setError('payment.unavailable');}finally{lock.current=false;setBusy(false);}
 }
 async function invoke(c:ReturnType<typeof client>,name:string,body:Record<string,unknown>){const result=await c.functions.invoke(name,{body});if(result.error)throw Error('payment.unavailable');return result.data;}
 return {state:query.data,busy,error:error||(query.isError?'payment.unavailable':''),sync:refetch,
  pay:()=>run(async(c,current)=>{
   const previous=query.data?.payments[0];const key=`flyora.vnpay.start.${ownerId}.${bookingId}.${previous?.status==='failed'?previous.id:'active'}`;
   let requestId=await AsyncStorage.getItem(key);if(!requestId){requestId=randomUUID();await AsyncStorage.setItem(key,requestId);}if(!current())return;
   const data=await invoke(c,'vnpay-create',{bookingId,requestId,locale:language==='en'?'en':'vn'});const url=safeCheckoutUrl(data.paymentUrl).toString();
   if(current())await WebBrowser.openAuthSessionAsync(url,'flight://payment-return');
  }),
  reconcile:()=>run(async(c,current)=>{if(current())await invoke(c,'vnpay-sync',{bookingId});}),
  cancel:(fee:number)=>run(async(c,current)=>{if(!current())return;const result=await c.rpc('cancel_booking',{p_booking_id:bookingId,p_request_id:randomUUID(),p_expected_fee:fee});if(result.error)throw Error('payment.unavailable');}),
  refund:()=>run(async(c,current)=>{if(current())await invoke(c,'vnpay-refund',{bookingId,requestId:randomUUID()});}),
 };
}
export type VnpayCheckout=ReturnType<typeof useVnpayCheckout>;
