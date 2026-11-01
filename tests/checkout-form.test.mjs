import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFormControl } from 'react-hook-form';
import * as forms from '../src/features/booking/form-state.ts';
const { contactFormOptions } = forms;

test('first typing defers errors until blur; fixing a touched field clears the error', async () => {
  const form = createFormControl(contactFormOptions({ contactName: '', contactEmail: '', contactPhone: '' }));
  const field = form.register('contactEmail');
  await field.onChange({ type: 'change', target: { name: 'contactEmail', value: 'unfinished@' } });
  assert.equal(form.getFieldState('contactEmail').error, undefined);
  await field.onBlur({ type: 'blur', target: { name: 'contactEmail', value: 'unfinished@' } });
  assert.ok(form.getFieldState('contactEmail').error);
  await field.onChange({ type: 'change', target: { name: 'contactEmail', value: 'an@example.com' } });
  assert.equal(form.getFieldState('contactEmail').error, undefined);
});
test('Continue checks untouched required fields and returns normalized data without replacing raw input', async () => {
  const raw = { contactName: ' Nguyễn An ', contactEmail: ' AN@Example.COM ', contactPhone: '090 123 4567' };
  const form = createFormControl(contactFormOptions(raw));
  let submitted;
  await form.handleSubmit(data => { submitted = data; })();
  assert.deepEqual(submitted, { contactName: 'Nguyễn An', contactEmail: 'an@example.com', contactPhone: '0901234567' });
  assert.equal(form.getValues('contactEmail'), raw.contactEmail);
  const blank = createFormControl(contactFormOptions({ contactName: '', contactEmail: '', contactPhone: '' }));
  let advanced = false;
  await blank.handleSubmit(() => { advanced = true; })();
  assert.equal(advanced, false);
  for (const name of ['contactName', 'contactEmail', 'contactPhone']) assert.ok(blank.getFieldState(name).error);
});
test('a retained contact form displays the latest shared draft on focus', async () => {
  assert.equal(typeof forms.restoreContactForm, 'function');
  const form = createFormControl(contactFormOptions({ contactName: 'Old', contactEmail: 'old@example.com', contactPhone: '0901234567' }));
  forms.restoreContactForm(form, { contactName: 'New', contactEmail: 'new@example.com', contactPhone: '0901234567' });
  let result;
  await form.handleSubmit(data => { result = data; })();
  assert.equal(result.contactEmail, 'new@example.com');
  assert.equal(form.getValues('contactEmail'), 'new@example.com');
});
