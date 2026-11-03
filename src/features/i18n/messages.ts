import { checkoutMessages } from './checkout-messages.ts';
import { bookingEnglish, bookingVietnamese } from './booking-messages.ts';
import {mockEnglish,mockVietnamese} from './mock-messages.ts';
import { discoveryEnglish } from './discovery-messages.ts';
import { ticketEnglish } from './ticket-messages.ts';
import { authEnglish } from './auth-messages.ts';
import { catalogueEnglish, catalogueVietnamese } from './catalogue-messages.ts';
const checkoutEnglish = Object.fromEntries(Object.keys(checkoutMessages).map(key => [key, key])) as { [K in keyof typeof checkoutMessages]: K };
const discoveryVietnamese = Object.fromEntries(Object.keys(discoveryEnglish).map(key => [key, key])) as { [K in keyof typeof discoveryEnglish]: K };
const ticketVietnamese = Object.fromEntries(Object.keys(ticketEnglish).map(key => [key, key])) as { [K in keyof typeof ticketEnglish]: K };
const authVietnamese = Object.fromEntries(Object.keys(authEnglish).map(key => [key, key])) as { [K in keyof typeof authEnglish]: K };
export const en = {
  ...mockEnglish,
  ...bookingEnglish,
  ...checkoutEnglish,
  'seats.available': 'Available', 'seats.selected': 'Selected', 'seats.selectedOther': 'Selected for another traveller',
  'seats.held': 'Held', 'seats.booked': 'Booked', 'seats.blocked': 'Blocked',
  'seats.infant': 'This infant has no separate seat on this flight.',
  'seats.exitRule': 'Exit rows: age 18+ and not accompanying an infant on this flight.',
  'seats.exit': 'Not eligible for an exit-row seat.', 'seats.unavailable': 'This seat or cabin is unavailable.',
  'seats.duplicate': 'Another traveller has selected this seat.',
  'seats.changed': 'Seat availability or fees changed. Please reselect or clear your seat.',
  'seats.loadError': 'Could not load the seat map. Please retry.',
  'seats.unsupported': 'This aircraft layout is unsupported or invalid.',
  'quote.base': 'Base fare', 'quote.tax': 'Taxes', 'quote.fee': 'Fare fees', 'quote.baggage': 'Extra baggage', 'quote.seat': 'Seat selection',
  'quote.validUntil': 'Quote valid until {time}', 'quote.expired': 'This quote expired. Please refresh it.',
  'quote.changed': 'The current price differs from your estimate. Please review and acknowledge the new price.',
  'quote.authRequired': 'Please sign in again to request a quote.', 'quote.invalid': 'Invalid quote data. Please check your selections.',
  'quote.unavailable': 'Your flight or fare is no longer on sale. Please choose flights again.',
  'quote.offerUnavailable': 'A baggage offer is no longer available. Go back and choose another package.',
  'quote.seatUnavailable': 'Your selected seat is no longer available. Go back and select another seat.',
  'quote.seatIneligible': 'A traveller is not eligible for the selected seat. Please choose another.',
  'quote.soldOut': 'There are not enough seats in this cabin. Please choose another flight.',
  'quote.loadError': 'Could not request a quote. Check your connection and retry.',
  'bags.allowance': '{pieces} pieces · {kg} kg', 'bags.allowanceUnavailable': 'Baggage allowance unavailable.',
  'bags.package': 'Add {kg} kg checked baggage',
  'extras.loadError': 'Could not load services. Check your connection and retry.',
  'extras.unavailable': 'Your fare or service is no longer available. Please choose flights again.',
  'extras.checkDetails': 'Please check traveller and contact details first.',
  'extras.changed': 'Baggage offers or prices changed. Select the package again or remove it.',
  ...discoveryEnglish,
  ...ticketEnglish,
  ...authEnglish,
  ...catalogueEnglish,
  'common.language': 'Language',
  'common.languageStorage': 'Language preference could not be saved on this device.',
  'currency.loading': 'Loading exchange rate. Showing VND for now.',
  'currency.unavailable': 'Exchange rate unavailable or expired. Showing VND.',
  'currency.fallback': 'VND shown until a valid USD rate is available.',
  'currency.reference': 'USD is indicative only. Base booking and payment amounts remain VND.',
  'currency.rate': '1 USD ≈ {rate} VND',
  'currency.updated': 'Rate updated: {date}',
  'currency.original': 'Base price: {amount}',
  'currency.source': 'Rates by ExchangeRate-API',
  'currency.retry': 'Retry rate',
} as const;
export type MessageKey = keyof typeof en;
export const vi: Record<MessageKey, string> = {
  ...mockVietnamese,
  ...bookingVietnamese,
  ...checkoutMessages,
  ...discoveryVietnamese,
  ...ticketVietnamese,
  ...authVietnamese,
  ...catalogueVietnamese,
  'common.language': 'Ngôn ngữ',
  'common.languageStorage': 'Chưa thể lưu lựa chọn ngôn ngữ trên thiết bị này.',
  'currency.loading': 'Đang tải tỷ giá. Tạm hiển thị VND.',
  'currency.unavailable': 'Chưa có tỷ giá hợp lệ hoặc tỷ giá đã cũ. Đang hiển thị VND.',
  'currency.fallback': 'Tạm hiển thị VND cho đến khi có tỷ giá USD hợp lệ.',
  'currency.reference': 'USD chỉ để tham khảo. Giá gốc đặt vé và thanh toán vẫn là VND.',
  'currency.rate': '1 USD ≈ {rate} VND',
  'currency.updated': 'Tỷ giá cập nhật: {date}',
  'currency.original': 'Giá gốc: {amount}',
  'currency.source': 'Tỷ giá từ ExchangeRate-API',
  'currency.retry': 'Thử lại tỷ giá',
};
