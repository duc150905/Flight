import type { Language } from './language.ts';
import { en, vi } from './messages.ts';

export function translate(language: Language, message: string, params: Record<string, string | number> = {}) {
  const dictionary = language === 'vi' ? vi : en;
  const template = dictionary[message as keyof typeof en] ?? message;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match));
}
export function localeFor(language: Language) { return language === 'vi' ? 'vi-VN' : 'en-GB'; }
export function formatMoney(language: Language, value: number, currency = 'VND') {
  return new Intl.NumberFormat(localeFor(language), { style: 'currency', currency }).format(value);
}
export function formatDate(language: Language, date: string) {
  return new Intl.DateTimeFormat(localeFor(language), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
export function formatTime(language: Language, instant: string, timeZone: string) {
  return new Intl.DateTimeFormat(localeFor(language), { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
}
