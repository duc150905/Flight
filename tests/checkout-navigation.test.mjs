import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStepRequestGuard } from '../src/features/booking/step-request.ts';
test('blur cancels late navigation even if draft revision is unchanged',()=>{
 const guard=createStepRequestGuard();const first=guard.begin();assert.equal(guard.isCurrent(first),true);
 guard.cancel();assert.equal(guard.isCurrent(first),false);
 const second=guard.begin();const third=guard.begin();assert.equal(guard.isCurrent(second),false);assert.equal(guard.isCurrent(third),true);
});
