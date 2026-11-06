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
import {bookingDetailsChanged,paymentRefreshInterval,paymentWatchExpired,refreshPaymentRead} from './payment-presentation';
export function useVnpayCheckout(bookingId:string,enabled:boolean,changed:()=>void){
 const {session}=useAuth();const {language}=useLanguage();const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false),focused=useRef(false);const [guard]=useState(createStepRequestGuard);
 const ownerId=session?.user.id;
 const [visible,setVisible]=useState(false);const [watchUntil,setWatchUntil]=useState(()=>Date.now()+120_000);
 const [watchClock,setWatchClock]=useState(Date.now);
 const previousReceipt=useRef<{ownerId?:string;bookingId:string;status:string}|undefined>(undefined);
 const changedRef=useRef(changed);
 useEffect(()=>{changedRef.current=changed;},[changed]);
 useEffect(()=>{
  if(!visible)return;
  const timer=setTimeout(()=>setWatchClock(Date.now()),Math.max(0,watchUntil-Date.now()));
  return()=>clearTimeout(timer);
 },[visible,watchUntil]);
 const client=()=>{if(!session)throw Error('payment.auth');return createOwnerRpcClient({url:process.env.EXPO_PUBLIC_SUPABASE_URL!,key:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,accessToken:session.access_token});};
 const query=useQuery({queryKey:['gateway-payment',ownerId,bookingId],enabled:enabled&&visible,retry:false,staleTime:0,gcTime:0,
  refetchInterval:q=>q.state.error?false:paymentRefreshInterval(q.state.data,visible,watchUntil),
  queryFn:async()=>{
  const {data,error:failure}=await client().rpc('get_payment_state',{p_booking_id:bookingId});if(failure)throw Error('payment.unavailable');
  return parseGatewayState(data);
 }});
 const refetch=query.refetch;
 const receiptStatus=query.data?.booking.status;
 useEffect(()=>{
  if(!enabled||!focused.current||!receiptStatus)return;
  const next={ownerId,bookingId,status:receiptStatus};
  if(bookingDetailsChanged(previousReceipt.current,next))changedRef.current();
  previousReceipt.current=next;
 },[enabled,ownerId,bookingId,receiptStatus]);
 useFocusEffect(useCallback(()=>{focused.current=true;setVisible(true);setWatchUntil(Date.now()+120_000);if(enabled&&ownerId)void refetch();return()=>{focused.current=false;setVisible(false);guard.cancel();};},[enabled,ownerId,refetch,guard]));
 useEffect(()=>{if(!enabled)return;const sub=AppState.addEventListener('change',s=>{
  setVisible(s==='active'&&focused.current);if(s==='active'&&focused.current){void WebBrowser.dismissBrowser();setWatchUntil(Date.now()+120_000);void refetch();}
 });return()=>sub.remove();},[enabled,refetch]);
 async function run(action?:(c:ReturnType<typeof client>,current:()=>boolean)=>Promise<void>){
  if(lock.current||!enabled||!session)return;lock.current=true;setBusy(true);setError('');const ticket=guard.begin(),current=()=>focused.current&&guard.isCurrent(ticket);
  try{if(action)await action(client(),current);if(current()){
   setWatchUntil(Date.now()+120_000);
   await refreshPaymentRead(()=>refetch({throwOnError:true}),current,()=>changedRef.current());
  }}catch{if(current())setError('payment.unavailable');}finally{lock.current=false;setBusy(false);}
 }
 async function invoke(c:ReturnType<typeof client>,name:string,body:Record<string,unknown>){const result=await c.functions.invoke(name,{body});if(result.error)throw Error('payment.unavailable');return result.data;}
 return {state:query.data,busy,checking:query.isFetching,
  verificationPaused:paymentWatchExpired(query.data,watchUntil,watchClock),
  error:error||(query.isError?'payment.unavailable':''),sync:refetch,
  retry:()=>run(),
  pay:()=>run(async(c,current)=>{
   const previous=query.data?.payments[0];const key=`flyora.vnpay.start.${ownerId}.${bookingId}.${previous?.status==='failed'?previous.id:'active'}`;
   let requestId=await AsyncStorage.getItem(key);if(!requestId){requestId=randomUUID();await AsyncStorage.setItem(key,requestId);}if(!current())return;
   const data=await invoke(c,'vnpay-create',{bookingId,requestId,locale:language==='en'?'en':'vn'});const url=safeCheckoutUrl(data.paymentUrl).toString();
   if(current()){
    await WebBrowser.openAuthSessionAsync(url,'flight://payment-return');
    void WebBrowser.dismissBrowser();
    if(current())await invoke(c,'vnpay-sync',{bookingId});
   }
  }),
  reconcile:()=>run(async(c,current)=>{if(current())await invoke(c,'vnpay-sync',{bookingId});}),
  cancel:(fee:number)=>run(async(c,current)=>{if(!current())return;const result=await c.rpc('cancel_booking',{p_booking_id:bookingId,p_request_id:randomUUID(),p_expected_fee:fee});if(result.error)throw Error('payment.unavailable');}),
  refund:()=>run(async(c,current)=>{if(current())await invoke(c,'vnpay-refund',{bookingId,requestId:randomUUID()});}),
 };
}
export type VnpayCheckout=ReturnType<typeof useVnpayCheckout>;
