import assert from 'node:assert/strict';
import {test} from 'node:test';
const module=await import('../src/features/admin/booking-details.ts').catch(()=>({}));
test('booking flight details use the persisted flight snapshot with route and separate timezones',()=>{
 assert.equal(typeof module.bookingFlightDetails,'function');
 assert.deepEqual(module.bookingFlightDetails({flight_number:'KE7030',airline_name:'Korean',departure_iata:'ICN',arrival_iata:'SGN',departure_at:'2026-11-05T01:00:00Z',arrival_at:'2026-11-05T07:00:00Z',departure_timezone:'Asia/Seoul',arrival_timezone:'Asia/Ho_Chi_Minh'}),{flightNumber:'KE7030',airlineName:'Korean',departureIata:'ICN',arrivalIata:'SGN',departureAt:'2026-11-05T01:00:00Z',arrivalAt:'2026-11-05T07:00:00Z',departureTimezone:'Asia/Seoul',arrivalTimezone:'Asia/Ho_Chi_Minh'});
});
test('missing snapshot stays visibly unavailable rather than inventing route details',()=>{
 assert.equal(typeof module.bookingFlightDetails,'function');
 assert.equal(module.bookingFlightDetails(null).departureIata,'—');assert.equal(module.bookingFlightDetails([]).departureAt,null);
});
