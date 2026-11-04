import {test} from 'node:test';import assert from 'node:assert/strict';
import {refundOutcome} from '../supabase/functions/_shared/vnpay/refund.ts';
test('refund API acceptance is separate from final status; duplicates never create a new refund',()=>{
 assert.equal(refundOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'05'}),'processing');
 assert.equal(refundOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'06'}),'processing');
 assert.equal(refundOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'00'}),'succeeded');
 assert.equal(refundOutcome({vnp_ResponseCode:'94'}),'processing');
 assert.equal(refundOutcome({vnp_ResponseCode:'95'}),'failed');
 assert.equal(refundOutcome({vnp_ResponseCode:'00'}),'unknown');
});
