import type { Language } from '../i18n/language.ts';

export type DisplayCurrency = 'VND' | 'USD';
export function currencyForLanguage(language: Language): DisplayCurrency {
  return language === 'en' ? 'USD' : 'VND';
}
