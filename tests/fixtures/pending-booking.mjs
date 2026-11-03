export const fixtureId = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const pendingBookingFixture={
 id:fixtureId(1),bookingCode:'FY7B23D9104A56',status:'pending_payment',currency:'VND',total:1800000,
 base:1200000,tax:280000,fee:70000,baggage:200000,seat:50000,
 serverNow:'2026-11-03T10:00:00Z',expiresAt:'2026-11-03T10:15:00Z',
 contact:{name:'Nguyen Minh An',email:'test@example.invalid',phone:'+84901234567'},
 passengers:[{id:fixtureId(2),ordinal:1,givenNames:'Minh An',familyName:'Nguyen',gender:'male'},{id:fixtureId(3),ordinal:2,givenNames:'Minh Vy',familyName:'Nguyen',gender:null}],
 segments:[{id:fixtureId(4),flightId:fixtureId(5),journeyIndex:1,legIndex:1,snapshot:{flight_number:'F0103',airline_name:'Flyora Airways',departure_iata:'SGN',arrival_iata:'HAN',departure_at:'2026-12-04T02:00:00Z',arrival_at:'2026-12-04T04:10:00Z',departure_timezone:'Asia/Ho_Chi_Minh',arrival_timezone:'Asia/Ho_Chi_Minh',fare_name:'Demo Standard'}}],
 passengerSegments:[{id:fixtureId(6),passengerId:fixtureId(2),flightId:fixtureId(5),passengerType:'adult',requiresSeat:true,accompanyingPassengerId:null,allowance:{cabin_pieces:1,cabin_kg:7,checked_pieces:0,checked_kg:0}},{id:fixtureId(7),passengerId:fixtureId(3),flightId:fixtureId(5),passengerType:'infant',requiresSeat:false,accompanyingPassengerId:fixtureId(2),allowance:{cabin_pieces:0,cabin_kg:0,checked_pieces:0,checked_kg:0}}],
 seats:[{passengerSegmentId:fixtureId(6),flightId:fixtureId(5),seatCode:'2A',amount:50000,status:'held'}],
 addons:[{passengerSegmentId:fixtureId(6),flightId:fixtureId(5),name:'Demo checked baggage 15 kg',weightKg:15,amount:200000}],
};
