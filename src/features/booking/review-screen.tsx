import { router } from 'expo-router';
import { useState } from 'react';
import { useCheckout } from './checkout-provider';
import { checkoutReview } from './review';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';
import { useLanguage } from '../i18n/provider';
import { formatDate, formatTime } from '../i18n/translate';
import { MoneyText } from '../currency/ui';
import { checkoutEstimate } from './estimate';

export function ReviewScreen() {
  const { language, t } = useLanguage();
  const draft = useCheckout();
  const result = checkoutReview(draft);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  if (!draft.itinerary) return <MissingCheckout />;
  if (!result.success) return <CheckoutShell title="Check your details" step={2}>
    <CheckoutCard>{result.messages.map((message, index) => <CheckoutError key={index} message={message} />)}</CheckoutCard>
    <CheckoutButton title={result.target === 'selection' ? 'Choose flights again' : result.target === 'contact' ? 'Edit contact details' : 'Edit travellers'}
      onPress={() => {
        if (result.target === 'selection') { draft.reset(); router.replace('/'); }
        else router.dismissTo('/checkout/passengers');
      }} />
  </CheckoutShell>;
  const { itinerary, contact, passengers, passengerSegments } = result.data;
  const estimate = checkoutEstimate(draft);
  const fingerprint = JSON.stringify(result.data);
  const checked = fingerprint === confirmed;
  return <CheckoutShell title="Review your details" step={2} back={() => router.dismissTo('/checkout/passengers')}>
    <CheckoutText muted message={"Take a moment to check names, dates and contact details before moving on to baggage and seats."} />
    <CheckoutCard>
      <CheckoutText title message={"Your flights"} />
      {itinerary.legs.map(leg => <CheckoutCard key={leg.flightId}>
        <CheckoutText>{leg.origin.iata_code} → {leg.destination.iata_code}</CheckoutText>
        <CheckoutText muted>{leg.origin.city} → {leg.destination.city}</CheckoutText>
        <CheckoutText>{leg.flightNumber} · {leg.fareName}</CheckoutText>
        <CheckoutText muted>{t('Departure')}: {formatTime(language, leg.departureAt, leg.origin.timezone)} ({leg.origin.timezone})</CheckoutText>
        <CheckoutText muted>{t('Arrival')}: {formatTime(language, leg.arrivalAt, leg.destination.timezone)} ({leg.destination.timezone})</CheckoutText>
      </CheckoutCard>)}
    </CheckoutCard>
    {estimate && <CheckoutCard>
      <CheckoutText title message="Estimated total" />
      <MoneyText amount={estimate.amount} currency={estimate.currency} />
      <CheckoutText muted message="Final price is checked when booking." />
    </CheckoutCard>}
    <CheckoutCard>
      <CheckoutText title message={"Contact details"} />
      <CheckoutText>{contact.contactName}</CheckoutText>
      <CheckoutText>{contact.contactEmail}</CheckoutText>
      <CheckoutText>{contact.contactPhone}</CheckoutText>
      <CheckoutButton title="Edit contact details" secondary onPress={() => router.dismissTo('/checkout/passengers')} />
    </CheckoutCard>
    <CheckoutCard>
      <CheckoutText title>{t('Travellers')} · {passengers.length}</CheckoutText>
      {passengers.map((passenger, index) => <CheckoutCard key={passenger.id}>
        <CheckoutText>{t('Traveller {number}', { number: index + 1 })}</CheckoutText>
        <CheckoutText>{passenger.values.familyName} {passenger.values.givenNames}</CheckoutText>
        <CheckoutText muted>{t('Date of birth')}: {formatDate(language, passenger.values.dateOfBirth)}</CheckoutText>
        {!!passenger.values.gender && <CheckoutText muted>{t('Gender (optional)')}: {t(passenger.values.gender)}</CheckoutText>}
        {passengerSegments.filter(segment => segment.passengerId === passenger.id).map(segment => {
          const leg = itinerary.legs.find(leg => leg.flightId === segment.flightId)!;
          const companion = passengers.find(p => p.id === segment.accompanyingPassengerId);
          return <CheckoutText muted key={segment.flightId}>{leg.origin.iata_code} → {leg.destination.iata_code}: {t(segment.passengerType)} · {t(segment.requiresSeat ? 'Separate seat' : 'No separate seat')}{companion ? ` · ${t('Accompanied by')}: ${companion.values.givenNames} ${companion.values.familyName}` : ''}</CheckoutText>;
        })}
        {!!passenger.values.passportNumber && <>
          <CheckoutText muted>{t('Nationality')}: {passenger.values.nationalityCode}</CheckoutText>
          <CheckoutText>{t('Passport')}: {passenger.values.passportNumber}</CheckoutText>
          <CheckoutText muted>{t('Issued by')}: {passenger.values.passportIssuerCountry} · {t('Expires')}: {formatDate(language, passenger.values.passportExpiryDate!)}</CheckoutText>
        </>}
      </CheckoutCard>)}
      <CheckoutButton title="Edit travellers" secondary onPress={() => router.dismissTo('/checkout/passengers')} />
    </CheckoutCard>
    <CheckoutText muted message={"Your booking is not confirmed yet. Baggage, seats and payment follow after these details."} />
    {checked && <CheckoutCard><CheckoutText message={"Your traveller details have been checked. You can still edit them before booking."} /></CheckoutCard>}
    <CheckoutButton title={checked ? 'Details checked' : 'Confirm traveller details'} disabled={checked}
      onPress={() => setConfirmed(fingerprint)} />
  </CheckoutShell>;
}
