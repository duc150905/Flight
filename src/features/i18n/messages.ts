import { checkoutMessages } from './checkout-messages.ts';
import { discoveryEnglish } from './discovery-messages.ts';
import { ticketEnglish } from './ticket-messages.ts';
import { authEnglish } from './auth-messages.ts';
const checkoutEnglish = Object.fromEntries(Object.keys(checkoutMessages).map(key => [key, key])) as { [K in keyof typeof checkoutMessages]: K };
const discoveryVietnamese = Object.fromEntries(Object.keys(discoveryEnglish).map(key => [key, key])) as { [K in keyof typeof discoveryEnglish]: K };
const ticketVietnamese = Object.fromEntries(Object.keys(ticketEnglish).map(key => [key, key])) as { [K in keyof typeof ticketEnglish]: K };
const authVietnamese = Object.fromEntries(Object.keys(authEnglish).map(key => [key, key])) as { [K in keyof typeof authEnglish]: K };
export const en = {
  ...checkoutEnglish,
  ...discoveryEnglish,
  ...ticketEnglish,
  ...authEnglish,
  'common.language': 'Language',
  'common.languageStorage': 'Language preference could not be saved on this device.',
} as const;
export type MessageKey = keyof typeof en;
export const vi: Record<MessageKey, string> = {
  ...checkoutMessages,
  ...discoveryVietnamese,
  ...ticketVietnamese,
  ...authVietnamese,
  'common.language': 'Ngôn ngữ',
  'common.languageStorage': 'Chưa thể lưu lựa chọn ngôn ngữ trên thiết bị này.',
};
