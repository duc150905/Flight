import {test} from 'node:test';import assert from 'node:assert/strict';
import {queryOutcome} from '../supabase/functions/_shared/vnpay/query.ts';
test('QueryDR acceptance is not payment success; unknown/refund statuses never fail a booking',()=>{
 assert.equal(queryOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'01',vnp_TransactionType:'01'}),'waiting');
 assert.equal(queryOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionType:'01'}),'succeeded');
 assert.equal(queryOutcome({vnp_ResponseCode:'91',vnp_TransactionStatus:'00',vnp_TransactionType:'01'}),'waiting');
 for(const status of ['04','05','06','07'])assert.equal(queryOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:status,vnp_TransactionType:'01'}),'waiting');
 assert.equal(queryOutcome({vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionType:'02'}),'waiting');
});
