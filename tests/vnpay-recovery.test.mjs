import {test} from 'node:test';import assert from 'node:assert/strict';import {refundQueryMatches} from '../supabase/functions/_shared/vnpay/recovery.ts';
test('a successful payment query is never mistaken for successful refund',()=>{
 const claim={ref:'abc',amount:100,type:'03',transactionNo:'123'};
 assert.equal(refundQueryMatches(claim,{vnp_TxnRef:'abc',vnp_Amount:'10000',vnp_TransactionType:'01',vnp_TransactionNo:'123'}),false);
 assert.equal(refundQueryMatches(claim,{vnp_TxnRef:'abc',vnp_Amount:'10000',vnp_TransactionType:'03',vnp_TransactionNo:'456'}),true);
 assert.equal(refundQueryMatches(claim,{vnp_TxnRef:'abc',vnp_Amount:'100000',vnp_TransactionType:'03'}),false);
});
