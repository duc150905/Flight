// Read-only public-client integration; never logs credentials or passenger data.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadCheckoutItinerary } from '../src/features/booking/itinerary-data.ts';
import { loadBaggage } from '../src/features/booking/extras-data.ts';
const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:flights,error}=await client.from('flight_instances').select('id').eq('flight_number','F0103').gt('departure_at',new Date().toISOString()).order('departure_at').limit(1);
assert.equal(error,null);assert.ok(flights.length);
const {data:fare,error:fareError}=await client.from('flight_fares').select('id').eq('flight_id',flights[0].id).eq('fare_code','DEMO_STANDARD').single();assert.equal(fareError,null);
const itinerary=await loadCheckoutItinerary(client,{tripType:'one_way',passengers:{adults:1,children:0,infants:0},segments:[{flightId:flights[0].id,fareId:fare.id,journeyIndex:1,legIndex:1}]});
const catalogue=await loadBaggage(client,itinerary);assert.ok(catalogue.offers.length>=2);assert.ok(catalogue.allowances[flights[0].id]);
const denied=await client.rpc('quote_checkout',{p_request:{}});assert.ok(denied.error,'Anonymous quote must be denied');
const {data:seats,error:seatError}=await client.rpc('get_seat_map',{p_flight_id:flights[0].id});assert.equal(seatError,null);assert.equal(seats.length,24);
console.log('PASS: live baggage/allowance, safe seat map, anonymous quote denial. Authenticated SQL-role quote is tested separately.');
