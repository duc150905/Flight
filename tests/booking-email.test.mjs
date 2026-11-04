import {test} from 'node:test';import assert from 'node:assert/strict';
import {confirmationEmail} from '../supabase/functions/_shared/booking-email.ts';
test('confirmation email renders frozen itinerary and escapes traveller/booking text',()=>{
 const data={code:'A12345',email:'traveller@example.invalid',total:1250000,flights:[{flight_number:'VN123',departure_iata:'SGN',arrival_iata:'HAN',departure_at:'2026-11-05T03:00:00Z'}],passengers:[{name:'<script>alert(1)</script>'}],seats:[{seat:'12A'}],addons:[{name:'20kg bag'}]};
 const mail=confirmationEmail(data,'Flyora <booking@flyora.site>');assert.ok(mail.html.includes('A12345'));assert.ok(mail.html.includes('SGN'));assert.ok(mail.html.includes('12A'));assert.ok(mail.html.includes('20kg bag'));
 assert.ok(!mail.html.includes('<script>'));assert.ok(mail.html.includes('&lt;script&gt;'));assert.equal(mail.to[0],data.email);
 assert.deepEqual(confirmationEmail(data,'sender'),confirmationEmail(data,'sender'));
});
