import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as presentation from '../src/features/booking/payment-presentation.ts';

const job={id:'refund-1',amount:1253000,state:'unknown'};
const refund={id:job.id,amount:job.amount,status:'pending',completedAt:null};
test('an aggregate refund state does not duplicate the individual refund card',()=>{
 const cards=presentation.refundStatusCards({refundState:'unknown',refundJobs:[job],refunds:[refund]});
 assert.equal(cards.length,1);
 assert.equal(cards[0].state,'unknown');
 assert.equal(cards[0].titleKey,'refund.status.unknown');
 assert.equal(cards[0].tone,'attention');
 assert.equal(cards[0].completedAt,null);
});
test('gateway-confirmed completion shows the refunded amount and completion time',()=>{
 const completedAt='2026-11-04T15:00:00Z';
 const [card]=presentation.refundStatusCards({refundState:'succeeded',refundJobs:[{...job,state:'succeeded'}],refunds:[{...refund,status:'succeeded',completedAt}]});
 assert.equal(card.tone,'success');
 assert.equal(card.amountKey,'refund.amountCompleted');
 assert.equal(card.completedAt,completedAt);
 assert.equal(card.amount,1253000);
});
test('unknown, processing, review and failed refunds never present as completed',()=>{
 for(const state of ['ready','submitted','unknown','processing','review','failed']){
  const [card]=presentation.refundStatusCards({refundState:state,refundJobs:[{...job,state}],refunds:[refund]});
  assert.notEqual(card.tone,'success');
  assert.equal(card.completedAt,null);
  assert.equal(card.amountKey,'payment.refundDue');
 }
});
test('legacy refund records remain visible when per-job state is not available',()=>{
 const cards=presentation.refundStatusCards({refundState:'review',refundJobs:[],refunds:[refund]});
 assert.equal(cards.length,1);
 assert.equal(cards[0].state,'review');
 assert.deepEqual(presentation.refundStatusCards({refundState:null,refundJobs:[],refunds:[]}),[]);
});
