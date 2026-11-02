import { checkoutMessages } from './checkout-messages.ts';
const checkoutEnglish = Object.fromEntries(Object.keys(checkoutMessages).map(key => [key, key])) as { [K in keyof typeof checkoutMessages]: K };
export const en = {
  ...checkoutEnglish,
  'common.language': 'Language',
  'common.languageStorage': 'Language preference could not be saved on this device.',
} as const;
export type MessageKey = keyof typeof en;
export const vi: Record<MessageKey, string> = {
  ...checkoutMessages,
  'common.language': 'Ngôn ngữ',
  'common.languageStorage': 'Chưa thể lưu lựa chọn ngôn ngữ trên thiết bị này.',
};
