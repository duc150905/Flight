import { router } from 'expo-router';
import { useState } from 'react';
import { useCheckout } from './checkout-provider';
import { checkoutReview } from './review';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';

export function ReviewScreen() {
  const draft = useCheckout();
  const result = checkoutReview(draft);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  if (!draft.itinerary) return <MissingCheckout />;
  if (!result.success) return <CheckoutShell title="Check your details" step={2}>
    <CheckoutCard>{result.messages.map((message, index) => <CheckoutError key={index} message={message} />)}</CheckoutCard>
    <CheckoutButton title={result.target === 'selection' ? 'Choose flights again' : result.target === 'contact' ? 'Edit contact details' : 'Edit travellers'}
      onPress={() => {
        if (result.target === 'selection') { draft.reset(); router.replace('/'); }
        else router.dismissTo(result.target === 'contact' ? '/checkout/contact' : '/checkout/passengers');
      }} />
  </CheckoutShell>;
  const { itinerary, contact, passengers } = result.data;
  const fingerprint = JSON.stringify(result.data);
  const checked = fingerprint === confirmed;
  const formatTime = (instant: string, timeZone: string) => new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
  return <CheckoutShell title="Review your details" step={2} back={() => router.dismissTo('/checkout/passengers')}>
    <CheckoutText muted>Take a moment to check names, dates and contact details before moving on to baggage and seats.</CheckoutText>
    <CheckoutCard>
      <CheckoutText title>Your flights</CheckoutText>
      {itinerary.legs.map(leg => <CheckoutCard key={leg.flightId}>
        <CheckoutText>{leg.origin.iata_code} → {leg.destination.iata_code}</CheckoutText>
        <CheckoutText muted>{leg.origin.city} → {leg.destination.city}</CheckoutText>
        <CheckoutText>{leg.flightNumber} · {leg.fareName}</CheckoutText>
        <CheckoutText muted>Departure: {formatTime(leg.departureAt, leg.origin.timezone)} ({leg.origin.timezone})</CheckoutText>
        <CheckoutText muted>Arrival: {formatTime(leg.arrivalAt, leg.destination.timezone)} ({leg.destination.timezone})</CheckoutText>
      </CheckoutCard>)}
    </CheckoutCard>
    <CheckoutCard>
      <CheckoutText title>Contact details</CheckoutText>
      <CheckoutText>{contact.contactName}</CheckoutText>
      <CheckoutText>{contact.contactEmail}</CheckoutText>
      <CheckoutText>{contact.contactPhone}</CheckoutText>
      <CheckoutButton title="Edit contact details" secondary onPress={() => router.dismissTo('/checkout/contact')} />
    </CheckoutCard>
    <CheckoutCard>
      <CheckoutText title>Travellers · {passengers.length}</CheckoutText>
      {passengers.map((passenger, index) => <CheckoutCard key={passenger.id}>
        <CheckoutText>Traveller {index + 1} · {passenger.id.split('-')[0]}</CheckoutText>
        <CheckoutText>{passenger.values.familyName} {passenger.values.givenNames}</CheckoutText>
        <CheckoutText muted>Date of birth: {passenger.values.dateOfBirth}</CheckoutText>
        {!!passenger.values.accompanyingAdultId && <CheckoutText muted>Accompanied by: {passengers.find(p => p.id === passenger.values.accompanyingAdultId)?.values.givenNames} ({passenger.values.accompanyingAdultId})</CheckoutText>}
        {!!passenger.values.passportNumber && <>
          <CheckoutText muted>Nationality: {passenger.values.nationalityCode}</CheckoutText>
          <CheckoutText>Passport: {passenger.values.passportNumber}</CheckoutText>
          <CheckoutText muted>Issued by: {passenger.values.passportIssuerCountry} · Expires: {passenger.values.passportExpiryDate}</CheckoutText>
        </>}
      </CheckoutCard>)}
      <CheckoutButton title="Edit travellers" secondary onPress={() => router.dismissTo('/checkout/passengers')} />
    </CheckoutCard>
    <CheckoutText muted>Your booking is not confirmed yet. Baggage, seats and payment follow after these details.</CheckoutText>
    {checked && <CheckoutCard><CheckoutText>Your traveller details have been checked. You can still edit them before booking.</CheckoutText></CheckoutCard>}
    <CheckoutButton title={checked ? 'Details checked' : 'Confirm traveller details'} disabled={checked}
      onPress={() => setConfirmed(fingerprint)} />
  </CheckoutShell>;
}
