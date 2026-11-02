import assert from 'node:assert/strict';
import { test } from 'node:test';

import { translate } from '../src/features/i18n/translate.ts';

test('Auth validation and countdown messages switch language without altering form values', () => {
  assert.equal(translate('en', 'Email không hợp lệ.'), 'Enter a valid email address.');
  assert.equal(translate('en', 'Mật khẩu nhập lại không khớp.'), 'Passwords do not match.');
  assert.equal(translate('en', 'Gửi lại sau {seconds} giây', { seconds: 25 }), 'Resend in 25 seconds');
  assert.equal(translate('vi', 'Gửi lại sau {seconds} giây', { seconds: 25 }), 'Gửi lại sau 25 giây');
  assert.equal(translate('en', 'Nguyễn Văn A'), 'Nguyễn Văn A');
});
