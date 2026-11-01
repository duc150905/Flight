import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useCheckout, useCheckoutStore } from './checkout-provider';
import { contactFormOptions, restoreContactForm } from './form-state';
import { CheckoutField } from './form-field';
import { CheckoutButton, CheckoutCard, CheckoutShell, CheckoutText, MissingCheckout } from './ui';

export function ContactScreen() {
  const { itinerary } = useCheckout();
  return itinerary ? <ContactForm key={JSON.stringify(itinerary.selection)} /> : <MissingCheckout />;
}
function ContactForm() {
  const draft = useCheckout();
  const form = useForm(contactFormOptions(draft.contact));
  const store = useCheckoutStore(); const reset = form.reset;
  useFocusEffect(useCallback(() => restoreContactForm({ reset }, store.getState().contact), [reset, store]));
  return <CheckoutShell title="Contact details" step={0}>
    <CheckoutText muted>Who should we contact about this booking? This person does not have to be a traveller.</CheckoutText>
    <CheckoutCard>
      <CheckoutField control={form.control} name="contactName" label="Full name" autoComplete="name" autoCapitalize="words" returnKeyType="next"
        onSubmitEditing={() => form.setFocus('contactEmail')} onRawChange={value => draft.updateContact({ contactName: value })} />
      <CheckoutField control={form.control} name="contactEmail" label="Email address" autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next"
        onSubmitEditing={() => form.setFocus('contactPhone')} onRawChange={value => draft.updateContact({ contactEmail: value })} />
      <CheckoutField control={form.control} name="contactPhone" label="Phone number" autoComplete="tel" keyboardType="phone-pad" placeholder="e.g. +84 901 234 567"
        onRawChange={value => draft.updateContact({ contactPhone: value })} />
    </CheckoutCard>
    <CheckoutText muted>Your details stay in this checkout while you move between steps.</CheckoutText>
    <CheckoutButton title="Continue to travellers" onPress={() => void form.handleSubmit(() => router.push('/checkout/passengers'))()} />
  </CheckoutShell>;
}
