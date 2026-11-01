import { Redirect, router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { bookingContactSchema } from './contact';
import { useCheckout } from './checkout-provider';
import { passengerFormOptions } from './form-state';
import { CheckoutField } from './form-field';
import { localCalendarDay } from './itinerary-data';
import { CheckoutButton, CheckoutCard, CheckoutShell, CheckoutText, MissingCheckout } from './ui';

export function PassengerScreen() {
  const draft = useCheckout();
  if (!draft.itinerary) return <MissingCheckout />;
  if (!bookingContactSchema.safeParse(draft.contact).success) return <Redirect href="/checkout/contact" />;
  return <PassengerForm key={JSON.stringify(draft.itinerary.selection)} />;
}
function PassengerForm() {
  const draft = useCheckout();
  const bookingDate = localCalendarDay(new Date(), draft.itinerary!.legs[0].origin.timezone);
  const form = useForm(passengerFormOptions(draft.passengers, bookingDate));
  return <CheckoutShell title="Traveller information" step={1} back={() => router.replace('/checkout/contact')}>
    <CheckoutText muted>Enter each traveller’s name as shown on their travel document.</CheckoutText>
    {draft.passengers.map((passenger, index) => <CheckoutCard key={passenger.id}>
      <CheckoutText title>Traveller {index + 1} · {passenger.id.split('-')[0]}</CheckoutText>
      <CheckoutField control={form.control} name={`passengers.${index}.values.givenNames`} label="Given names" autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus(`passengers.${index}.values.familyName`)}
        onRawChange={value => draft.updatePassenger(passenger.id, { givenNames: value })} />
      <CheckoutField control={form.control} name={`passengers.${index}.values.familyName`} label="Family name" autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus(`passengers.${index}.values.dateOfBirth`)}
        onRawChange={value => draft.updatePassenger(passenger.id, { familyName: value })} />
      <CheckoutField control={form.control} name={`passengers.${index}.values.dateOfBirth`} label="Date of birth" placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false}
        onRawChange={value => draft.updatePassenger(passenger.id, { dateOfBirth: value })} />
      <CheckoutText muted>Use YYYY-MM-DD, for example 2000-02-29.</CheckoutText>
    </CheckoutCard>)}
    <CheckoutButton title="Review details" onPress={() => void form.handleSubmit(() => router.push('/checkout/review'))()} />
  </CheckoutShell>;
}
