import type { Language } from '../i18n/language.ts';
import { formatMoney } from '../i18n/translate.ts';
import type { DisplayCurrency } from './preferences.ts';
import { isFreshRate, type ExchangeRate } from './rates.ts';

export function presentMoney({ amount, sourceCurrency, currency, language, rate, now = Date.now() }: {
  amount: number; sourceCurrency: string; currency: DisplayCurrency; language: Language; rate?: ExchangeRate | null; now?: number;
}) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !/^[A-Z]{3}$/.test(sourceCurrency)) return null;
  const baseFormatted = formatMoney(language, amount, sourceCurrency);
  if (currency !== 'USD' || sourceCurrency !== 'VND') {
    return { formatted: baseFormatted, baseFormatted, value: amount, currency: sourceCurrency, converted: false, fallback: false };
  }
  if (isFreshRate(rate, now)) {
    const cents = Math.round(amount / rate.vndPerUsd * 100);
    if (Number.isSafeInteger(cents)) {
      return { formatted: `≈ ${formatMoney(language, cents / 100, 'USD')}`, baseFormatted, value: cents / 100,
        currency: 'USD', converted: true, fallback: false };
    }
  }
  return { formatted: baseFormatted, baseFormatted, value: amount, currency: 'VND', converted: false, fallback: true };
}

export function inlineMoney(money: ReturnType<typeof presentMoney>) {
  if (!money) return '—';
  return money.converted ? `${money.formatted} (${money.baseFormatted})` : money.formatted;
}
