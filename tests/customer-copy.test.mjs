import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translate } from '../src/features/i18n/translate.ts';

test('destination titles and airport copy switch to English', () => {
  for (const [vi, en] of [
    ['Hà Nội ngàn năm văn hiến', 'Hanoi, a thousand years of heritage'],
    ['Đà Nẵng — Thành phố đáng sống', 'Da Nang, where coast meets city'],
    ['Đảo ngọc Phú Quốc', 'Phu Quoc, the pearl island'],
    ['Vịnh biển Nha Trang', 'Discover Nha Trang Bay'],
    ['Đà Lạt ngàn hoa', 'Da Lat, the city of flowers'],
    ['Cố đô Huế mộng mơ', 'Hue, the timeless imperial city'],
    ['Singapore hiện đại & xanh mát', 'Singapore, a city in a garden'],
    ['Bangkok sôi động', 'Experience vibrant Bangkok'],
    ['TP. Hồ Chí Minh', 'Ho Chi Minh City'], ['Hà Nội', 'Hanoi'],
    ['Sân bay Quốc tế Tân Sơn Nhất', 'Tan Son Nhat International Airport'],
  ]) {
    assert.equal(translate('en', vi), en);
    assert.equal(translate('vi', vi), vi);
  }
});

test('customer fare and baggage names hide fixture prefixes in both languages', () => {
  for (const [source, vi, en] of [
    ['Demo Standard', 'Tiêu chuẩn', 'Standard'], ['Demo Flex', 'Linh hoạt', 'Flex'],
    ['Demo checked baggage 15 kg', 'Hành lý ký gửi 15 kg', '15 kg checked baggage'],
    ['Demo checked baggage 25 kg', 'Hành lý ký gửi 25 kg', '25 kg checked baggage'],
  ]) {
    assert.equal(translate('vi', source), vi);
    assert.equal(translate('en', source), en);
  }
});
