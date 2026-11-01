import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFormControl } from 'react-hook-form';
import * as forms from '../src/features/booking/form-state.ts';
import { createCheckoutDraftStore } from '../src/features/booking/draft.ts';
const values = { givenNames: 'An', familyName: 'Nguyễn', dateOfBirth: '2000-01-01' };
test('two travellers with the same name are edited independently by stable ID', async () => {
  assert.equal(typeof forms.passengerFormOptions, 'function');
  const store = createCheckoutDraftStore();
  store.getState().updatePassenger('p1', values);
  store.getState().updatePassenger('p2', values);
  const form = createFormControl(forms.passengerFormOptions(store.getState().passengers, '2026-11-01'));
  const unsubscribe = form.subscribe({ formState: { values: true }, callback: () => {} });
  form.setValue('passengers.1.values.givenNames', 'Bình');
  store.getState().updatePassenger('p2', { givenNames: form.getValues('passengers.1.values.givenNames') });
  assert.equal(store.getState().passengers[0].values.givenNames, 'An');
  assert.equal(store.getState().passengers[1].values.givenNames, 'Bình');
  let result;
  await form.handleSubmit(data => { result = data; })();
  assert.equal(result.passengers[1].values.givenNames, 'Bình');
  unsubscribe();
});
test('missing and invalid dates report errors on the correct traveller without clearing typed names', async () => {
  assert.equal(typeof forms.passengerFormOptions, 'function');
  const form = createFormControl(forms.passengerFormOptions([
    { id: 'p1', values }, { id: 'p2', values: { ...values, givenNames: ' Bình ', dateOfBirth: '2026-11-02' } },
  ], '2026-11-01'));
  let advanced = false;
  await form.handleSubmit(() => { advanced = true; })();
  assert.equal(advanced, false);
  assert.ok(form.getFieldState('passengers.1.values.dateOfBirth').error);
  assert.equal(form.getFieldState('passengers.0.values.dateOfBirth').error, undefined);
  assert.equal(form.getValues('passengers.1.values.givenNames'), ' Bình ');
});
test('a retained form restores newer draft values before the next Continue', async () => {
  assert.equal(typeof forms.restorePassengerForm, 'function');
  const store = createCheckoutDraftStore();
  store.getState().updatePassenger('p1', values);
  const form = createFormControl(forms.passengerFormOptions(store.getState().passengers, '2026-11-01'));
  store.getState().updatePassenger('p1', { givenNames: 'Edited on another screen' });
  forms.restorePassengerForm(form, store.getState().passengers);
  let submitted;
  await form.handleSubmit(data => { submitted = data; })();
  assert.equal(submitted.passengers[0].values.givenNames, 'Edited on another screen');
});
test('correcting a companion DOB clears the already-displayed infant error', async () => {
  assert.equal(typeof forms.revalidateCompanionFields, 'function');
  const trip = { selection: { passengers: { adults: 1, children: 0, infants: 1 } }, international: false, legs: [{ departureDate: '2026-11-20', arrivalDate: '2026-11-20' }] };
  const passengers = [{ id: 'adult-1', values: { ...values, dateOfBirth: '2009-01-01' } }, { id: 'infant-1', values: { ...values, dateOfBirth: '2025-01-01', accompanyingAdultId: 'adult-1' } }];
  const form = createFormControl(forms.passengerFormOptions(passengers, '2026-11-01', trip));
  const unsubscribe = form.subscribe({ formState: { values: true }, callback: () => {} });
  await form.handleSubmit(() => {})();
  assert.ok(form.getFieldState('passengers.1.values.accompanyingAdultId').error);
  const field = form.register('passengers.0.values.dateOfBirth');
  await field.onChange({ type: 'change', target: { name: 'passengers.0.values.dateOfBirth', value: '1990-01-01' } });
  await forms.revalidateCompanionFields(form);
  assert.equal(form.getFieldState('passengers.1.values.accompanyingAdultId').error, undefined);
  unsubscribe();
});
