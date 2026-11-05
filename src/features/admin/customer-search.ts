type BookingContact = { booking_code: string; contact_email?: string | null; contact_phone?: string | null };
export function customerSearchText(account: { id: string; fullName: string; email: string; phone: string }, bookings: readonly BookingContact[]) {
 return [account.id,account.fullName,account.email,account.phone,...bookings.flatMap(row=>[row.booking_code,row.contact_email,row.contact_phone])].filter(Boolean).join(' ');
}
export function passengerSearchText(passenger: {family_name: string;given_names: string;document_number?: string | null;nationality_code?: string | null}, booking?: BookingContact) {
 return [passenger.family_name,passenger.given_names,passenger.document_number,passenger.nationality_code,booking?.booking_code,booking?.contact_email,booking?.contact_phone].filter(Boolean).join(' ');
}
export function selectOwnerBookings<T extends {user_id: string}>(bookings: readonly T[], ownerId?: string) {
 return bookings.filter(row=>!ownerId||row.user_id===ownerId);
}
