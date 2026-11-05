import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated.ts';
export type ReconciliationState = 'all' | 'unknown' | 'review' | 'processing' | 'failed' | 'succeeded' | 'ready' | 'submitted' | 'compensation';
export type AdminReconciliationRow = {
 booking_id: string; booking_code: string; payment_id: string; amount: number; currency: string; payment_status: string;
 settlement: string; gateway_paid: boolean; transaction_no: string | null; txn_ref: string; provider_reference: string | null;
 refund_id: string | null; refund_state: string | null; refund_status: string | null; refund_amount: number | null;
 refund_provider_reference: string | null; completed_at: string | null; last_code: string | null; paid_at: string | null;
};
export async function loadAdminVnpayReviewPage(client: SupabaseClient<Database>, options: {page?: number; pageSize?: number; query?: string; state?: ReconciliationState}) {
 const page=Math.max(1,Math.trunc(options.page ?? 1));const pageSize=Math.max(1,Math.min(100,Math.trunc(options.pageSize ?? 20)));
 const {data,error}=await client.rpc('admin_vnpay_review_page',{p_query:options.query?.trim() ?? '',p_state:options.state ?? 'all',p_limit:pageSize,p_offset:(page-1)*pageSize});
 if(error)throw error;
 if(!data||typeof data!=='object'||!('items' in data)||!Array.isArray(data.items)||!('total' in data)||typeof data.total!=='number')throw new Error('Invalid reconciliation response');
 return {items:data.items as AdminReconciliationRow[],total:data.total,page,pageSize,totalPages:Math.max(1,Math.ceil(data.total/pageSize))};
}
export type AdminPaymentLedgerRow = Database['public']['Tables']['payments']['Row'] & {captured: boolean; captured_at: string | null};
export async function loadAdminPaymentLedger(client: SupabaseClient<Database>) {
 const rows: AdminPaymentLedgerRow[]=[];
 for(let offset=0;offset<100000;offset+=500){
  const {data,error}=await client.rpc('admin_payment_ledger_page',{p_limit:500,p_offset:offset});
  if(error)throw error;
  if(!data||typeof data!=='object'||!('items' in data)||!Array.isArray(data.items)||!('total' in data)||typeof data.total!=='number')throw new Error('Invalid payment ledger response');
  rows.push(...data.items as AdminPaymentLedgerRow[]);
  if(rows.length>=data.total)return rows;
  if(data.items.length===0)throw new Error('Incomplete payment ledger response');
 }
 throw new Error('Too many payment ledger records');
}
