import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { useCheckout, useCheckoutStore } from './checkout-provider';
import { travellerFormOptions, restoreTravellerForm, revalidateTravellerCompanions } from './form-state';
import { CheckoutField } from './form-field';
import { CheckoutChoice } from './choice-field';
import { CheckoutPhoneField } from './phone-field';
import { localCalendarDay } from './itinerary-data';
import { infantLegsForPassenger, isEligibleCompanion } from './passenger-policy';
import { CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout, useCheckoutColors } from './ui';
import { useLanguage } from '../i18n/provider';
import { calendarDateSchema } from './passenger';

export function PassengerScreen() {
  const draft = useCheckout();
  if (!draft.itinerary) return <MissingCheckout />;
  return <PassengerForm key={JSON.stringify(draft.itinerary.selection)} />;
}
function PassengerForm() {
  const { t } = useLanguage();
  const draft = useCheckout();
  const bookingDate = localCalendarDay(new Date(), draft.itinerary!.legs[0].origin.timezone);
  const form = useForm(travellerFormOptions(draft, bookingDate, draft.itinerary!));
  const store = useCheckoutStore(); const reset = form.reset;
  useFocusEffect(useCallback(() => restoreTravellerForm({ reset }, store.getState()), [reset, store]));
  const c = useCheckoutColors();
  return <CheckoutShell title="Traveller information" step={0}
    footer={{ title: 'Next', onPress: () => void form.handleSubmit(() => router.push('/checkout/review'))() }}>
    {draft.itinerary!.selection.passengers.infants > 0 && <CheckoutCard>
      <CheckoutText title message="Travelling with an infant" />
      <CheckoutText message="Each infant under 2 needs their own accompanying traveller aged 18 or over on that flight." />
    </CheckoutCard>}
    {draft.passengers.map((passenger, index) => <CheckoutCard key={passenger.id}>
      <CheckoutText title>{t('Traveller {number}', { number: index + 1 })} · {t(passenger.id.split('-')[0])}</CheckoutText>
      <CheckoutText muted message={"Enter each traveller’s name as shown on their travel document."} />
      <CheckoutField control={form.control} name={`passengers.${index}.values.givenNames`} label="First name" placeholder={t('First name')} autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus(`passengers.${index}.values.familyName`)}
        onRawChange={value => draft.updatePassenger(passenger.id, { givenNames: value })} />
      <CheckoutField control={form.control} name={`passengers.${index}.values.familyName`} label="Last name" placeholder={t('Last name')} autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus(`passengers.${index}.values.dateOfBirth`)}
        onRawChange={value => draft.updatePassenger(passenger.id, { familyName: value })} />
      <CheckoutChoice control={form.control} name={`passengers.${index}.values.gender`} label="Gender (optional)" options={['male', 'female', 'unspecified']}
        onRawChange={value => draft.updatePassenger(passenger.id, { gender: value })} />
      <CheckoutField control={form.control} name={`passengers.${index}.values.dateOfBirth`} label="Date of birth" placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false}
        onRawChange={value => {
          const clearCompanion = calendarDateSchema.safeParse(value.trim()).success && infantLegsForPassenger(value, draft.itinerary!.legs).length === 0;
          draft.updatePassenger(passenger.id, { dateOfBirth: value, ...(clearCompanion ? { accompanyingAdultId: '' } : {}) });
          if (clearCompanion) form.setValue(`passengers.${index}.values.accompanyingAdultId`, '');
          void revalidateTravellerCompanions(form);
        }} />
      <CheckoutText muted message={"Use YYYY-MM-DD, for example 2000-02-29."} />
      <CheckoutText muted message={"Choose the correct age group: infant under 2, child 2–11, adult 12+. Age is calculated on each flight date."} />
      {draft.itinerary!.international && <>
        <CheckoutText title message={"Passport details"} />
        <CheckoutText muted message={"Required for each traveller on this international itinerary."} />
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
        <CheckoutText title message={"Accompanying adult"} />
        <CheckoutText muted message={"This infant has no separate seat. Choose a different adult aged 18+ for each infant. Fill in the adult’s birth date first."} />
        <Controller control={form.control} name={`passengers.${index}.values.accompanyingAdultId`} render={({ field, fieldState }) => <View style={{ gap: 8 }}>
          {draft.passengers.filter(p => p.id !== passenger.id).map(adult => {
            const eligible = isEligibleCompanion(adult.values.dateOfBirth, infantLegsForPassenger(passenger.values.dateOfBirth, draft.itinerary!.legs));
            const selected = field.value === adult.id;
            const label = `${t('Traveller {number}', { number: draft.passengers.indexOf(adult) + 1 })}: ${[adult.values.givenNames, adult.values.familyName].filter(Boolean).join(' ') || t('Enter traveller details')}`;
            return <Pressable key={adult.id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled: !eligible }} disabled={!eligible}
              onPress={() => {
                draft.updatePassenger(passenger.id, { accompanyingAdultId: adult.id });
                field.onChange(adult.id); field.onBlur();
                void revalidateTravellerCompanions(form);
              }}
              style={({ pressed }) => ({ minHeight: 52, padding: 14, borderWidth: selected ? 2 : 1, borderRadius: 10, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.tint : c.surface, opacity: !eligible ? 0.5 : pressed ? 0.75 : 1 })}>
              <Text style={{ color: c.text, fontSize: 16 }}>{selected ? t('Selected: ') : ''}{label}</Text>
            </Pressable>;
          })}
          <CheckoutError message={fieldState.error?.message} />
        </View>} />
      </>}
    </CheckoutCard>)}
    <CheckoutError message={form.formState.errors.passengers?.message} />
    <CheckoutCard>
      <CheckoutText title message={"Contact details"} />
      <CheckoutField control={form.control} name="contact.contactName" label="Full name" autoComplete="name" autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus('contact.contactEmail')} onRawChange={value => draft.updateContact({ contactName: value })} />
      <CheckoutField control={form.control} name="contact.contactEmail" label="Contact email" placeholder={t('Email address')} autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next"
        onSubmitEditing={() => form.setFocus('contact.contactPhone')} onRawChange={value => draft.updateContact({ contactEmail: value })} />
      <CheckoutPhoneField control={form.control} name="contact.contactPhone"
        onRawChange={value => draft.updateContact({ contactPhone: value })} />
    </CheckoutCard>
  </CheckoutShell>;
}

