export function bookingFlightDetails(snapshot: unknown) {
 const row = snapshot && typeof snapshot==='object' && !Array.isArray(snapshot) ? snapshot as Record<string,unknown> : {};
 const text = (key: string, fallback='—') => typeof row[key]==='string' && row[key] ? row[key] as string : fallback;
 return {flightNumber:text('flight_number'),airlineName:text('airline_name'),departureIata:text('departure_iata'),arrivalIata:text('arrival_iata'),departureAt:text('departure_at','')||null,arrivalAt:text('arrival_at','')||null,departureTimezone:text('departure_timezone','UTC'),arrivalTimezone:text('arrival_timezone','UTC')};
}
