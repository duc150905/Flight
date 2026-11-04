import {test} from 'node:test';import assert from 'node:assert/strict';
import {paymentReturnId,safeCheckoutUrl} from '../src/features/booking/vnpay-payment.ts';
test('payment return accepts opaque IDs only and checkout stays on VNPAY sandbox',()=>{
 assert.equal(paymentReturnId('not-an-id'),null);assert.equal(paymentReturnId(['a','b']),null);
 assert.equal(paymentReturnId('00000000-0000-4000-8000-000000000081'),'00000000-0000-4000-8000-000000000081');
 assert.equal(safeCheckoutUrl('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Test=1').hostname,'sandbox.vnpayment.vn');
 assert.throws(()=>safeCheckoutUrl('https://evil.example/paymentv2/vpcpay.html'));assert.throws(()=>safeCheckoutUrl('https://sandbox.vnpayment.vn.evil.example/'));
});
