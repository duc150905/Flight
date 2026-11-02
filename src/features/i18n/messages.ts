import { checkoutMessages } from './checkout-messages.ts';
const checkoutEnglish = Object.fromEntries(Object.keys(checkoutMessages).map(key => [key, key])) as { [K in keyof typeof checkoutMessages]: K };
export const en = {
  ...checkoutEnglish,
  'common.language': 'Language',
  'common.languageStorage': 'Language preference could not be saved on this device.',
  'currency.label': 'Display currency',
  'currency.loading': 'Loading exchange rate. Showing VND for now.',
  'currency.unavailable': 'Exchange rate unavailable or expired. Showing VND.',
  'currency.fallback': 'VND shown until a valid USD rate is available.',
  'currency.reference': 'USD is indicative only. Base booking and payment amounts remain VND.',
  'currency.rate': '1 USD ≈ {rate} VND',
  'currency.updated': 'Rate updated: {date}',
  'currency.original': 'Base price: {amount}',
  'currency.source': 'Rates by ExchangeRate-API',
  'currency.storageError': 'Currency preference could not be saved on this device.',
  'currency.retry': 'Retry rate',
} as const;
export type MessageKey = keyof typeof en;
export const vi: Record<MessageKey, string> = {
  ...checkoutMessages,
  'common.language': 'Ngôn ngữ',
  'common.languageStorage': 'Chưa thể lưu lựa chọn ngôn ngữ trên thiết bị này.',
  'currency.label': 'Tiền tệ hiển thị',
  'currency.loading': 'Đang tải tỷ giá. Tạm hiển thị VND.',
  'currency.unavailable': 'Chưa có tỷ giá hợp lệ hoặc tỷ giá đã cũ. Đang hiển thị VND.',
  'currency.fallback': 'Tạm hiển thị VND cho đến khi có tỷ giá USD hợp lệ.',
  'currency.reference': 'USD chỉ để tham khảo. Giá gốc đặt vé và thanh toán vẫn là VND.',
  'currency.rate': '1 USD ≈ {rate} VND',
  'currency.updated': 'Tỷ giá cập nhật: {date}',
  'currency.original': 'Giá gốc: {amount}',
  'currency.source': 'Tỷ giá từ ExchangeRate-API',
  'currency.storageError': 'Chưa thể lưu lựa chọn tiền tệ trên thiết bị này.',
  'currency.retry': 'Thử lại tỷ giá',
};
