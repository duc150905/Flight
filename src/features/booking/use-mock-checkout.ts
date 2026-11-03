import AsyncStorage from '@react-native-async-storage/async-storage';
import {randomUUID} from 'expo-crypto';
import {useFocusEffect} from 'expo-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useAuth} from '../auth/auth-provider';
import {createOwnerRpcClient} from './owner-rpc';
import {createMockActionJournal,type MockAction} from './mock-action-journal';
import {createStepRequestGuard} from './step-request';
import {loadMockPaymentState,startMockPayment,resolveMockPayment,cancelMockBooking,refundMockBooking,mockError,type MockOutcome,type MockState} from './mock-payment';
const journal=createMockActionJournal(AsyncStorage,randomUUID);
export function useMockCheckout(bookingId:string,enabled:boolean,changed:()=>void){
 const {session}=useAuth();const ownerId=session?.user.id;const cache=useQueryClient();const focused=useRef(false);const lock=useRef(false);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [outcome,setOutcome]=useState<MockOutcome>('succeeded');
 const [guard]=useState(createStepRequestGuard);
 const [refundOutcome,setRefundOutcome]=useState<Exclude<MockOutcome,'cancelled'>>('succeeded');
 const key=['mock-payment',session?.user.id,bookingId];
 function client(){const url=process.env.EXPO_PUBLIC_SUPABASE_URL;const publicKey=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!session||!url||!publicKey)throw Error('booking.authRequired');return createOwnerRpcClient({url,key:publicKey,accessToken:session.access_token});}
 const query=useQuery({queryKey:key,enabled,retry:false,staleTime:0,gcTime:0,queryFn:()=>loadMockPaymentState(client(),bookingId)});
 const refetch=query.refetch;
 useFocusEffect(useCallback(()=>{focused.current=true;if(enabled&&ownerId)void refetch();return()=>{focused.current=false;guard.cancel();};},[enabled,refetch,guard,ownerId]));
 useEffect(()=>{if(!enabled)return;const sub=AppState.addEventListener('change',s=>{if(s==='active')void refetch();});return()=>sub.remove();},[enabled,refetch]);
 async function send(action:MockAction,id:string,rpc:ReturnType<typeof client>,current:()=>boolean){
  if(!current())throw Error('booking.authRequired');
  if(action.kind==='start')return startMockPayment(rpc,bookingId,id);
  if(action.kind==='resolve'&&action.target&&action.outcome)return resolveMockPayment(rpc,action.target,id,action.outcome as MockOutcome);
  if(action.kind==='cancel'&&action.expectedFee!==undefined)return cancelMockBooking(rpc,bookingId,id,action.expectedFee);
  if(action.kind==='refund'&&action.outcome)return refundMockBooking(rpc,bookingId,id,action.outcome as Exclude<MockOutcome,'cancelled'>);
  throw Error('mock.invalid');
 }
 async function run(action:(perform:(a:MockAction|null,signature:string)=>Promise<{value:MockState;recovered:boolean}>)=>Promise<void>){
  if(lock.current||!session||!enabled)return;lock.current=true;setBusy(true);setError('');
  const ticket=guard.begin();const current=()=>focused.current&&guard.isCurrent(ticket);
  const owner=session.user.id;
  try{const rpc=client();await action(async(a,sig)=>{
   const sender=(stored:MockAction,id:string)=>send(stored,id,rpc,current);
   const result=a?await journal.run(owner,bookingId,sig,a,sender):(await journal.recover(owner,bookingId,sender)??{value:await loadMockPaymentState(rpc,bookingId),recovered:false});
   if(current()){cache.setQueryData(key,result.value);changed();}return result;
  });}catch(cause){if(current())setError(mockError(cause));}
  finally{lock.current=false;setBusy(false);}
 }
 return {state:query.data,busy,error:error||(query.isError?'mock.network':''),outcome,setOutcome,refundOutcome,setRefundOutcome,sync:refetch,
  refresh:()=>{setError('');void refetch();},
  pay:()=>run(async perform=>{
   let state=query.data;if(!state||state.booking.status!=='pending_payment')throw Error('mock.state');
   let payment=state.payments.find(p=>p.status==='pending');
   if(!payment){const result=await perform({kind:'start'},`start:${state.booking.id}:${state.payments[0]?.id??'none'}:${state.payments[0]?.status??'none'}`);state=result.value;if(result.recovered)return;payment=state.payments.find(p=>p.status==='pending');}
   if(payment&&state.booking.status==='pending_payment')await perform({kind:'resolve',target:payment.id,outcome},`resolve:${payment.id}:${outcome}`);
  }),
  recover:()=>run(async perform=>{await perform(null,'');}),
  cancel:(expectedFee:number)=>run(async perform=>{await perform({kind:'cancel',expectedFee},`cancel:${bookingId}:${query.data?.booking.status}:${expectedFee}`);}),
  refund:()=>run(async perform=>{const refund=query.data?.refunds[0];await perform({kind:'refund',outcome:refundOutcome},`refund:${bookingId}:${refund?.id??'none'}:${refund?.status??'none'}:${refundOutcome}`);}),
 };
}
export type MockCheckout=ReturnType<typeof useMockCheckout>;
