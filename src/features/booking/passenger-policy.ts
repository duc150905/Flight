import { z } from 'zod';
import type { CheckoutItinerary } from './itinerary-data.ts';
import { calendarDateSchema, createBookingPassengerSchema, type PassengerDetailsInput } from './passenger.ts';

// ISO 3166-1 alpha-2 codes. No device locale or translated country names in data.
const countries = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));
export function ageOnDate(birthDate: string, travelDate: string): number {
  calendarDateSchema.parse(birthDate); calendarDateSchema.parse(travelDate);
  if (birthDate > travelDate) throw new Error('Date of birth cannot be after travel.');
  return Number(travelDate.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (travelDate.slice(5) < birthDate.slice(5) ? 1 : 0);
}
export function classifyPassenger(birthDate: string, travelDate: string): 'adult' | 'child' | 'infant' {
  const age = ageOnDate(birthDate, travelDate);
  return age < 2 ? 'infant' : age < 12 ? 'child' : 'adult';
}
export function isEligibleCompanion(rawBirthDate: string, legs: Pick<CheckoutItinerary['legs'][number], 'departureDate'>[]): boolean {
  const birthDate = rawBirthDate.trim();
  return legs.length > 0 && calendarDateSchema.safeParse(birthDate).success
    && legs.every(leg => birthDate <= leg.departureDate && ageOnDate(birthDate, leg.departureDate) >= 18);
}
export function infantLegsForPassenger(rawBirthDate: string, legs: CheckoutItinerary['legs']) {
  const birthDate = rawBirthDate.trim();
  return calendarDateSchema.safeParse(birthDate).success
    ? legs.filter(leg => birthDate <= leg.departureDate && classifyPassenger(birthDate, leg.departureDate) === 'infant') : [];
}
/** Derived checkout data, not a booking write. Stable passenger IDs never change. */
export function derivePassengerSegments(passengers: { id: string; values: PassengerDetailsInput }[], legs: CheckoutItinerary['legs']) {
  return legs.flatMap(leg => passengers.map(passenger => {
    const passengerType = classifyPassenger(passenger.values.dateOfBirth.trim(), leg.departureDate);
    return { passengerId: passenger.id, flightId: leg.flightId, journeyIndex: leg.journeyIndex, legIndex: leg.legIndex,
      passengerType, requiresSeat: passengerType !== 'infant',
      accompanyingPassengerId: passengerType === 'infant' ? passenger.values.accompanyingAdultId ?? null : null };
  }));
}
export function passengerDetailsSchema(bookingDate: string) {
  return createBookingPassengerSchema(bookingDate).extend({
    nationalityCode: z.string().trim().toUpperCase().optional(),
    passportIssuerCountry: z.string().trim().toUpperCase().optional(),
    passportNumber: z.string().trim().optional(), passportExpiryDate: z.string().trim().optional(),
    accompanyingAdultId: z.string().optional(),
  });
}
export function passengerPolicySchema(itinerary: CheckoutItinerary, bookingDate: string) {
  const details = passengerDetailsSchema(bookingDate);
  const counts = itinerary.selection.passengers;
  const expected = (['adult', 'child', 'infant'] as const).flatMap(type => {
    const count = type === 'adult' ? counts.adults : type === 'child' ? counts.children : counts.infants;
    return Array.from({ length: count }, (_, index) => `${type}-${index + 1}`);
  });
  return z.object({ passengers: z.array(z.object({ id: z.string(), values: details })) }).superRefine(({ passengers }, ctx) => {
    const issue = (index: number, field: string, message: string) => ctx.addIssue({ code: 'custom', path: ['passengers', index, 'values', field], message });
    if (!itinerary.legs.length) ctx.addIssue({ code: 'custom', path: ['passengers'], message: 'Choose a valid itinerary first.' });
    if (passengers.length !== expected.length || new Set(passengers.map(p => p.id)).size !== passengers.length
      || expected.some(id => !passengers.some(p => p.id === id))) {
      ctx.addIssue({ code: 'custom', path: ['passengers'], message: 'Traveller counts must match your flight search. Please choose your flights again.' });
    }
    const usedCompanions = itinerary.legs.map(() => new Set<string>());
    passengers.forEach((passenger, index) => {
      const value = passenger.values;
      const validBirthDate = calendarDateSchema.safeParse(value.dateOfBirth).success;
      if (validBirthDate) {
        const expectedType = passenger.id.split('-')[0];
        if (itinerary.legs.some(leg => value.dateOfBirth > leg.departureDate)) {
          issue(index, 'dateOfBirth', 'Date of birth cannot be after travel.');
        } else if (itinerary.legs[0] && classifyPassenger(value.dateOfBirth, itinerary.legs[0].departureDate) !== expectedType) {
          issue(index, 'dateOfBirth', 'Age on the first flight must match the selected traveller type.');
        }
        const infantLegs = infantLegsForPassenger(value.dateOfBirth, itinerary.legs);
        if (infantLegs.length) {
          const companion = passengers.find(p => p.id === value.accompanyingAdultId && p.id !== passenger.id);
          const companionBirth = companion?.values.dateOfBirth;
          if (!companionBirth || !calendarDateSchema.safeParse(companionBirth).success
            || !isEligibleCompanion(companionBirth, infantLegs)) {
            issue(index, 'accompanyingAdultId', 'Choose a traveller aged 18 or over on each flight where this traveller is an infant.');
          } else {
            const duplicate = itinerary.legs.some((leg, legIndex) => infantLegs.includes(leg) && usedCompanions[legIndex].has(companion!.id));
            if (duplicate) issue(index, 'accompanyingAdultId', 'Each infant needs a different accompanying adult on the same flight.');
            itinerary.legs.forEach((leg, legIndex) => { if (infantLegs.includes(leg)) usedCompanions[legIndex].add(companion!.id); });
          }
        } else if (value.accompanyingAdultId) {
          issue(index, 'accompanyingAdultId', 'Only infants need an accompanying adult selection.');
        }
      }
      for (const field of ['nationalityCode', 'passportIssuerCountry'] as const) {
        if ((itinerary.international && !value[field]) || (value[field] && !countries.has(value[field]))) {
          issue(index, field, 'Enter a valid two-letter country code, for example VN.');
        }
      }
      const hasPassport = !!(value.passportNumber || value.passportExpiryDate || value.passportIssuerCountry);
      if (itinerary.international || hasPassport) {
        if (!value.passportNumber || value.passportNumber.length > 50 || /[\x00-\x1F\x7F]/.test(value.passportNumber)) {
          issue(index, 'passportNumber', 'Enter a passport number of 1–50 characters.');
        }
        if (!value.passportIssuerCountry || !countries.has(value.passportIssuerCountry)) {
          issue(index, 'passportIssuerCountry', 'Enter the passport issuing country code.');
        }
        if (!value.passportExpiryDate || !calendarDateSchema.safeParse(value.passportExpiryDate).success) {
          issue(index, 'passportExpiryDate', 'Enter a real passport expiry date in YYYY-MM-DD format.');
        } else if (itinerary.legs.some(leg => value.passportExpiryDate! < leg.departureDate || value.passportExpiryDate! < leg.arrivalDate)) {
          issue(index, 'passportExpiryDate', 'The passport must remain valid through the last arrival date.');
        }
      }
    });
  });
}
