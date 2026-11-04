import {useQuery} from '@tanstack/react-query';import {Text,View} from 'react-native';
import {supabase} from '../../lib/supabase';import {useAuth} from '../auth/auth-provider';import {useAdminI18n} from './i18n';import {ActionButton} from '../auth/ui';
export function AdminVnpayReview(){
 const {session}=useAuth();const {bi}=useAdminI18n();
 const query=useQuery({queryKey:['admin-vnpay-review',session?.user.id],enabled:!!session,retry:false,queryFn:async()=>{
  if(!supabase)throw Error('configuration');const {data,error}=await supabase.rpc('admin_vnpay_review');if(error)throw error;
  if(!Array.isArray(data))throw Error('response');return data as {booking_code:string;payment_id:string;settlement:string;gateway_paid:boolean;transaction_no:string|null;refund_state:string|null;last_code:string|null}[];
 }});
 return <View style={{gap:8,padding:12,borderWidth:1,borderColor:'#DCE6EB',borderRadius:12}}>
  <Text style={{fontWeight:'700'}}>{bi('Đối soát VNPAY Sandbox','VNPAY Sandbox reconciliation')}</Text>
  {query.isError&&<Text>{bi('Chưa tải được trạng thái đối soát.','Could not load reconciliation status.')}</Text>}
  {query.data?.map(row=><Text key={row.payment_id}>{row.booking_code} · {row.settlement} · {row.refund_state??'—'} · {row.last_code??'—'} · {row.transaction_no??'—'}</Text>)}
  <ActionButton secondary title={bi('Tải lại đối soát','Refresh reconciliation')} onPress={()=>{void query.refetch();}}/>
 </View>;
}
