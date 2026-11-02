import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'zustand';
import { useLanguage } from '../i18n/provider';
import { createCurrencyStore, type DisplayCurrency } from './preferences';
import { createRateService, isFreshRate, MAX_RATE_AGE, type ExchangeRate } from './rates';
import { presentMoney } from './presentation';

type CurrencyContextValue = {
  currency: DisplayCurrency; setCurrency(currency: DisplayCurrency): Promise<void>; storageError: boolean;
  rate: ExchangeRate | null; now: number; loading: boolean; retryRate(): void;
};
const CurrencyContext = createContext<CurrencyContextValue | null>(null);
export function CurrencyProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createCurrencyStore(AsyncStorage));
  const [service] = useState(() => createRateService(AsyncStorage));
  const preference = useStore(store);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { void store.getState().hydrate(); }, [store]);
  const query = useQuery({
    queryKey: ['display-exchange-rate', 'USD', 'VND'], queryFn: async () => {
      const value = await service.getRate(); setNow(Date.now()); return value;
    },
    enabled: preference.ready && preference.currency === 'USD',
    staleTime: 60 * 60 * 1000, refetchInterval: preference.currency === 'USD' ? 60 * 60 * 1000 : false,
    retry: false,
  });
  const refetch = query.refetch;
  useEffect(() => {
    if (preference.currency !== 'USD') return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { setNow(Date.now()); void refetch(); }
    });
    return () => { clearInterval(timer); listener.remove(); };
  }, [preference.currency, refetch]);
  useEffect(() => {
    if (preference.currency !== 'USD' || !query.data) return;
    const remaining = query.data.updatedAt + MAX_RATE_AGE + 1 - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [preference.currency, query.data]);
  const rate = isFreshRate(query.data, now) ? query.data : null;
  return <CurrencyContext.Provider value={{ currency: preference.currency, setCurrency: currency => {
    setNow(Date.now()); return preference.setCurrency(currency);
  },
    storageError: preference.storageError, rate, now,
    loading: preference.currency === 'USD' && (!preference.ready || query.isFetching),
    retryRate: () => { void refetch(); },
  }}>{children}</CurrencyContext.Provider>;
}
export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error('CurrencyProvider is required');
  return value;
}
export function useDisplayMoney() {
  const { language } = useLanguage(); const { currency, rate, now } = useCurrency();
  return (amount: number, sourceCurrency = 'VND') => presentMoney({ amount, sourceCurrency, currency, language, rate, now });
}
