import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { bookingContactSchema } from './contact';
import { useCheckout, useCheckoutStore } from './checkout-provider';
import { passengerFormOptions, restorePassengerForm, revalidateCompanionFields } from './form-state';
import { CheckoutField } from './form-field';
import { localCalendarDay } from './itinerary-data';
import { infantLegsForPassenger, isEligibleCompanion } from './passenger-policy';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout, useCheckoutColors } from './ui';

export function PassengerScreen() {
  const draft = useCheckout();
  if (!draft.itinerary) return <MissingCheckout />;
  if (!bookingContactSchema.safeParse(draft.contact).success) return <Redirect href="/checkout/contact" />;
  return <PassengerForm key={JSON.stringify(draft.itinerary.selection)} />;
}
function PassengerForm() {
  const draft = useCheckout();
  const bookingDate = localCalendarDay(new Date(), draft.itinerary!.legs[0].origin.timezone);
  const form = useForm(passengerFormOptions(draft.passengers, bookingDate, draft.itinerary!));
  const store = useCheckoutStore(); const reset = form.reset;
  useFocusEffect(useCallback(() => restorePassengerForm({ reset }, store.getState().passengers), [reset, store]));
  const c = useCheckoutColors();
  return <CheckoutShell title="Traveller information" step={1} back={() => router.dismissTo('/checkout/contact')}>
    <CheckoutText muted>Enter each traveller’s name as shown on their travel document.</CheckoutText>
    <CheckoutText muted>Demo age rules: infant under 2, child 2–11, adult 12+. Age is checked on every flight date.</CheckoutText>
    {draft.passengers.map((passenger, index) => <CheckoutCard key={passenger.id}>
      <CheckoutText title>Traveller {index + 1} · {passenger.id.split('-')[0]}</CheckoutText>
      <CheckoutField control={form.control} name={`passengers.${index}.values.givenNames`} label="Given names" autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus(`passengers.${index}.values.familyName`)}
        onRawChange={value => draft.updatePassenger(passenger.id, { givenNames: value })} />
      <CheckoutField control={form.control} name={`passengers.${index}.values.familyName`} label="Family name" autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus(`passengers.${index}.values.dateOfBirth`)}
        onRawChange={value => draft.updatePassenger(passenger.id, { familyName: value })} />
      <CheckoutField control={form.control} name={`passengers.${index}.values.dateOfBirth`} label="Date of birth" placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false}
        onRawChange={value => { draft.updatePassenger(passenger.id, { dateOfBirth: value }); void revalidateCompanionFields(form); }} />
      <CheckoutText muted>Use YYYY-MM-DD, for example 2000-02-29.</CheckoutText>
      {draft.itinerary!.international && <>
        <CheckoutText title>Passport details</CheckoutText>
        <CheckoutText muted>Required for each traveller on this international itinerary.</CheckoutText>
        <CheckoutField control={form.control} name={`passengers.${index}.values.nationalityCode`} label="Nationality country code" placeholder="e.g. VN" autoCapitalize="characters" maxLength={2} autoCorrect={false}
          onRawChange={value => draft.updatePassenger(passenger.id, { nationalityCode: value })} />
        <CheckoutField control={form.control} name={`passengers.${index}.values.passportNumber`} label="Passport number" autoCapitalize="characters" autoCorrect={false}
          onRawChange={value => draft.updatePassenger(passenger.id, { passportNumber: value })} />
        <CheckoutField control={form.control} name={`passengers.${index}.values.passportIssuerCountry`} label="Passport issuing country code" placeholder="e.g. VN" autoCapitalize="characters" maxLength={2} autoCorrect={false}
          onRawChange={value => draft.updatePassenger(passenger.id, { passportIssuerCountry: value })} />
        <CheckoutField control={form.control} name={`passengers.${index}.values.passportExpiryDate`} label="Passport expiry date" placeholder="YYYY-MM-DD" autoCorrect={false}
          onRawChange={value => draft.updatePassenger(passenger.id, { passportExpiryDate: value })} />
      </>}
      {infantLegsForPassenger(passenger.values.dateOfBirth, draft.itinerary!.legs).length > 0 && <>
        <CheckoutText title>Accompanying adult</CheckoutText>
        <CheckoutText muted>This infant has no separate seat. Choose a different adult aged 18+ for each infant. Fill in the adult’s birth date first.</CheckoutText>
        <Controller control={form.control} name={`passengers.${index}.values.accompanyingAdultId`} render={({ field, fieldState }) => <View style={{ gap: 8 }}>
          {draft.passengers.filter(p => p.id.startsWith('adult-')).map(adult => {
            const eligible = isEligibleCompanion(adult.values.dateOfBirth, infantLegsForPassenger(passenger.values.dateOfBirth, draft.itinerary!.legs));
            const selected = field.value === adult.id;
            const label = `${adult.id}: ${[adult.values.givenNames, adult.values.familyName].filter(Boolean).join(' ') || 'Enter traveller details'}`;
            return <Pressable key={adult.id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled: !eligible }} disabled={!eligible}
              onPress={() => {
                draft.updatePassenger(passenger.id, { accompanyingAdultId: adult.id });
                field.onChange(adult.id); field.onBlur();
                void revalidateCompanionFields(form);
              }}
              style={({ pressed }) => ({ minHeight: 52, padding: 14, borderWidth: selected ? 2 : 1, borderRadius: 10, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.tint : c.surface, opacity: !eligible ? 0.5 : pressed ? 0.75 : 1 })}>
              <Text style={{ color: c.text, fontSize: 16 }}>{selected ? 'Selected: ' : ''}{label}</Text>
            </Pressable>;
          })}
          <CheckoutError message={fieldState.error?.message} />
        </View>} />
      </>}
    </CheckoutCard>)}
    <CheckoutError message={form.formState.errors.passengers?.message} />
    <CheckoutButton title="Review details" onPress={() => void form.handleSubmit(() => router.push('/checkout/review'))()} />
  </CheckoutShell>;
}
