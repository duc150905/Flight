import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFormControl } from 'react-hook-form';
import * as forms from '../src/features/booking/form-state.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
import { translate } from '../src/features/i18n/translate.ts';
const itinerary = { selection: { passengers: { adults: 1, children: 0, infants: 0 } }, international: false, legs: [{ departureDate: '2026-12-01', arrivalDate: '2026-12-01' }] };
const draft = { contact: { contactName: ' An ', contactEmail: ' AN@example.com ', contactPhone: '090 123 4567' },
  passengers: [{ id: 'adult-1', values: { givenNames: ' An ', familyName: 'Nguyen', dateOfBirth: '2000-01-01', gender: 'female' } }] };
test('one Continue validates both contact and travellers, preserving raw data and optional gender', async () => {
  assert.equal(typeof forms.travellerFormOptions, 'function');
  const form = createFormControl(forms.travellerFormOptions(draft, '2026-11-02', itinerary));
  let result; await form.handleSubmit(data => { result = data; })();
  assert.equal(result.contact.contactEmail, 'an@example.com');
  assert.equal(result.passengers[0].values.gender, 'female');
  assert.equal(form.getValues('passengers.0.values.givenNames'), ' An ');
  const blank = createFormControl(forms.travellerFormOptions({ ...draft, contact: { ...draft.contact, contactEmail: '' }, passengers: [{ ...draft.passengers[0], values: { ...draft.passengers[0].values, dateOfBirth: '' } }] }, '2026-11-02', itinerary));
  let advanced = false; await blank.handleSubmit(() => { advanced = true; })();
  assert.equal(advanced, false);
  for (const path of ['contact.contactEmail', 'passengers.0.values.dateOfBirth']) {
    const error = blank.getFieldState(path).error; assert.ok(error);
    assert.notEqual(translate('vi', error.message), translate('en', error.message));
  }
});
test('revisiting restores latest contact and passenger values, reset removes personal data', async () => {
  assert.equal(typeof forms.restoreTravellerForm, 'function');
  const store = createCheckoutDraftStore();
  store.getState().updateContact(draft.contact); store.getState().updatePassenger('adult-1', draft.passengers[0].values);
  const form = createFormControl(forms.travellerFormOptions(store.getState(), '2026-11-02', itinerary));
  store.getState().updateContact({ contactName: 'New contact' }); store.getState().updatePassenger('adult-1', { givenNames: 'New name' });
  forms.restoreTravellerForm(form, store.getState());
  let result; await form.handleSubmit(data => { result = data; })();
  assert.equal(result.contact.contactName, 'New contact'); assert.equal(result.passengers[0].values.givenNames, 'New name'); assert.equal(result.passengers[0].values.gender, 'female');
  store.getState().reset(); assert.equal(store.getState().passengers.length, 0); assert.equal(store.getState().contact.contactName, '');
});
