import assert from 'node:assert/strict';import {test} from 'node:test';
import {migrationBody} from '../scripts/sql-transaction.mjs';
test('candidate builder strips even inline final COMMIT and rejects inner transaction boundaries',()=>{
 assert.equal(migrationBody('begin;\nselect 1;commit;','test'),'select 1;');
 assert.throws(()=>migrationBody('begin;select 1;commit;select 2;commit;','unsafe'),/transaction boundary/);
 assert.throws(()=>migrationBody('select 1;','unwrapped'),/Unwrapped/);
 assert.equal(migrationBody('','empty'),'');
});
