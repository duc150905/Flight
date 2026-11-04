import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {canonicalPay,createPayUrl,verifyPayCallback,signGatewayRequest,verifyGatewayResponse,wireAmount} from '../supabase/functions/_shared/vnpay/signing.ts';
const secret='sandbox-test-only',tmnCode='TEST1234',returnUrl='https://example.com/return';
test('PAY canonical encoding uses form spaces, sorted keys and excludes signature fields',()=>{
 assert.equal(canonicalPay({vnp_Z:'é +',vnp_A:'one two',vnp_SecureHash:'ignore'}),'vnp_A=one+two&vnp_Z=%C3%A9+%2B');
 assert.equal(wireAmount(1250000),'125000000');assert.throws(()=>wireAmount(1.5));assert.throws(()=>wireAmount(10000000000));
});
test('signed PAY callback rejects tampering, wrong merchant and duplicated query parameters',async()=>{
 const fields={vnp_TmnCode:tmnCode,vnp_TxnRef:'a'.repeat(32),vnp_Amount:'125000000',vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:'123',vnp_PayDate:'20261104120000'};
 const hash=createHmac('sha512',secret).update(canonicalPay(fields)).digest('hex');const params=new URLSearchParams({...fields,vnp_SecureHash:hash});
 assert.equal((await verifyPayCallback(params,{secret,tmnCode})).amount,1250000);
 await assert.rejects(()=>verifyPayCallback(new URLSearchParams(params+'&vnp_Amount=100'),{secret,tmnCode}));
 await assert.rejects(()=>verifyPayCallback(params,{secret,tmnCode:'OTHER'}));
 params.set('vnp_Amount','100');await assert.rejects(()=>verifyPayCallback(params,{secret,tmnCode}));
});
test('checkout URL stays on sandbox and signs server-provided fields',async()=>{
 const url=new URL(await createPayUrl({ref:'b'.repeat(32),amount:10000,created:'20261104120000',expires:'20261104121000',ip:'127.0.0.1',locale:'vn'},{secret,tmnCode,returnUrl}));
 assert.equal(url.origin,'https://sandbox.vnpayment.vn');assert.equal(url.searchParams.get('vnp_ReturnUrl'),returnUrl);assert.equal(url.searchParams.get('vnp_Amount'),'1000000');
});
test('refund signing uses documented pipe order and response verification authenticates response',async()=>{
 const f={vnp_RequestId:'r',vnp_Version:'2.1.0',vnp_Command:'refund',vnp_TmnCode:tmnCode,vnp_TransactionType:'03',vnp_TxnRef:'t',vnp_Amount:'100',vnp_TransactionNo:'1',vnp_TransactionDate:'d',vnp_CreateBy:'Flyora',vnp_CreateDate:'c',vnp_IpAddr:'ip',vnp_OrderInfo:'refund'};
 assert.equal(await signGatewayRequest('refund',f,secret),createHmac('sha512',secret).update('r|2.1.0|refund|TEST1234|03|t|100|1|d|Flyora|c|ip|refund').digest('hex'));
 const response={vnp_ResponseId:'1',vnp_Command:'refund',vnp_ResponseCode:'00',vnp_Message:'ok',vnp_TmnCode:tmnCode,vnp_TxnRef:'t',vnp_Amount:'100',vnp_BankCode:'NCB',vnp_PayDate:'d',vnp_TransactionNo:'1',vnp_TransactionType:'03',vnp_TransactionStatus:'05',vnp_OrderInfo:'refund'};
 response.vnp_SecureHash=createHmac('sha512',secret).update('1|refund|00|ok|TEST1234|t|100|NCB|d|1|03|05|refund').digest('hex');
 await verifyGatewayResponse('refund',response,{secret,tmnCode});response.vnp_TransactionStatus='00';await assert.rejects(()=>verifyGatewayResponse('refund',response,{secret,tmnCode}));
});
