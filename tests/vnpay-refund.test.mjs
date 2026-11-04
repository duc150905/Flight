import {test} from 'node:test';import assert from 'node:assert/strict';
import {refundOutcome,sendRefund} from '../supabase/functions/_shared/vnpay/refund.ts';
import {createHmac} from 'node:crypto';
test('refund API acceptance is separate from final status; duplicates never create a new refund',()=>{
 assert.equal(refundOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'05'}),'processing');
 assert.equal(refundOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'06'}),'processing');
 assert.equal(refundOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'00'}),'succeeded');
 assert.equal(refundOutcome({vnp_ResponseCode:'94'}),'processing');
 assert.equal(refundOutcome({vnp_ResponseCode:'95'}),'failed');
 assert.equal(refundOutcome({vnp_ResponseCode:'00'}),'unknown');
});
test('signed failure for another refund must not stop this refund recovery',async()=>{
 const fields={vnp_ResponseId:'1',vnp_Command:'refund',vnp_ResponseCode:'95',vnp_Message:'rejected',vnp_TmnCode:'TEST1234',vnp_TxnRef:'wrong',vnp_Amount:'100',vnp_BankCode:'NCB',vnp_PayDate:'',vnp_TransactionNo:'1',vnp_TransactionType:'02',vnp_TransactionStatus:'09',vnp_OrderInfo:'refund'};
 fields.vnp_SecureHash=createHmac('sha512','testsecret123456789').update('1|refund|95|rejected|TEST1234|wrong|100|NCB||1|02|09|refund').digest('hex');
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify(fields));
 try{await assert.rejects(()=>sendRefund({refundId:'id',requestId:'request',date:'20261104120000',ref:'right',amount:10000,type:'03',transactionNo:'123',created:'20261104110000',ip:'127.0.0.1'},{tmnCode:'TEST1234',secret:'testsecret123456789',returnUrl:'https://example.com'}),/payment.reference/);}finally{globalThis.fetch=oldFetch;}
});
