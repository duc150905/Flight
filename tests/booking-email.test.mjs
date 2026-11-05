import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {confirmationEmail} from '../supabase/functions/_shared/booking-email.ts';
test('confirmation email renders frozen itinerary and escapes traveller/booking text',()=>{
 const data={code:'A12345',email:'traveller@example.invalid',total:1250000,flights:[{flight_number:'VN123',departure_iata:'SGN',arrival_iata:'HAN',departure_at:'2026-11-05T03:00:00Z'}],passengers:[{name:'<script>alert(1)</script>'}],seats:[{seat:'12A'}],addons:[{name:'20kg bag'}]};
 const mail=confirmationEmail(data,'Flyora <booking@flyora.site>');assert.ok(mail.html.includes('A12345'));assert.ok(mail.html.includes('SGN'));assert.ok(mail.html.includes('12A'));assert.ok(mail.html.includes('20kg bag'));
 assert.equal(createHash('sha256').update(JSON.stringify(mail)).digest('hex'),'8e243463c8d4127d1980bdc10ff567f90cb59cb83146687d6398b80f41732893','legacy Resend retry payload must remain byte-for-byte stable');
 assert.ok(!mail.html.includes('<script>'));assert.ok(mail.html.includes('&lt;script&gt;'));assert.equal(mail.to[0],data.email);
 assert.deepEqual(confirmationEmail(data,'sender'),confirmationEmail(data,'sender'));
});

const segment = (journeyNumber,legNumber,from,to,seatA,seatB) => ({
 journeyNumber,legNumber,
 flight:{flight_number:`VN${journeyNumber}${legNumber}`,departure_iata:from,arrival_iata:to,
 departure_at:'2026-11-13T01:45:00Z',arrival_at:'2026-11-13T03:00:00Z',
 departure_timezone:'Asia/Ho_Chi_Minh',arrival_timezone:'Asia/Ho_Chi_Minh'},
 passengers:[{name:'Minh Duc Le',requiresSeat:true,seat:seatA,addons:[]},
 {name:'Minh Anh Tran',requiresSeat:true,seat:seatB,addons:[]}],
});
const detailed = segments => ({version:2,tripType:'round_trip',code:'FY-ROUNDTRIP',
 email:'traveller@example.invalid',total:5746000,segments});

test('round-trip mail binds each traveller seat to the correct outbound/return flight',()=>{
 const data=detailed([segment(2,1,'DAD','HAN','5B','5C'),segment(1,1,'HAN','DAD','3D','3E')]);
 const html=confirmationEmail(data,'sender').html;
 const outbound=html.slice(html.indexOf('Chiều đi / Outbound'),html.indexOf('Chiều về / Return'));
 const inbound=html.slice(html.indexOf('Chiều về / Return'));
 assert.match(outbound,/HAN → DAD/);assert.match(inbound,/DAD → HAN/);
 assert.match(outbound,/Minh Duc Le[\s\S]*?3D/);assert.match(outbound,/Minh Anh Tran[\s\S]*?3E/);
 assert.doesNotMatch(outbound,/5B|5C/);
 assert.match(inbound,/Minh Duc Le[\s\S]*?5B/);assert.match(inbound,/Minh Anh Tran[\s\S]*?5C/);
 assert.doesNotMatch(inbound,/3D|3E/);
 assert.match(outbound,/08:45/);assert.match(outbound,/GMT\+7/);
 assert.doesNotMatch(html,/2026-11-13T01:45/);
 assert.deepEqual(confirmationEmail(data,'sender'),confirmationEmail(data,'sender'));
 assert.equal(data.segments[0].journeyNumber,2,'renderer must not mutate frozen input');
});

test('multi-city mail numbers legs and keeps addons/infant details with their traveller and leg',()=>{
 const first=segment(1,1,'DAD','SIN','6A',null);
 first.flight.arrival_timezone='Asia/Singapore';
 first.passengers[0].addons=[{name:'Baggage <20 kg>',quantity:1}];
 first.passengers[1]={name:'Baby <Tran>',requiresSeat:false,seat:null,addons:[]};
 const second=segment(2,1,'SIN','BKK','7B','7C');
 const html=confirmationEmail({...detailed([first,second]),tripType:'multi_city'},'sender').html;
 const leg1=html.slice(html.indexOf('Chặng 1 / Leg 1'),html.indexOf('Chặng 2 / Leg 2'));
 const leg2=html.slice(html.indexOf('Chặng 2 / Leg 2'));
 assert.match(leg1,/Baggage &lt;20 kg&gt;/);assert.doesNotMatch(leg2,/Baggage/);
 assert.match(leg1,/Baby &lt;Tran&gt;/);assert.match(leg1,/Không có ghế riêng/);
 assert.doesNotMatch(html,/Baby <Tran>|Chiều về/);
 assert.match(leg1,/GMT\+8/);
});

test('one-way and connecting round-trip legs have clear labels and missing seat is not invented',()=>{
 const first=segment(1,1,'HAN','DAD',null,'3E');
 const connecting=segment(1,2,'DAD','SIN','6A','6B');
 const html=confirmationEmail(detailed([first,connecting,segment(2,1,'SIN','HAN','7A','7B')]),'sender').html;
 assert.match(html,/Chiều đi \/ Outbound · Chặng 1 \/ Leg 1/);
 assert.match(html,/Chiều đi \/ Outbound · Chặng 2 \/ Leg 2/);
 assert.match(html,/Chưa có thông tin ghế/);
 const oneway=confirmationEmail({...detailed([first]),tripType:'one_way'},'sender').html;
 assert.match(oneway,/Chặng 1 \/ Leg 1/);assert.doesNotMatch(oneway,/Chiều về/);
});
