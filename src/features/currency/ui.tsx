import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useLanguage } from '../i18n/provider';
import { localeFor } from '../i18n/translate';
import { useCurrency, useDisplayMoney } from './provider';
import { RATE_ATTRIBUTION } from './rates';

export function CurrencyControls() {
  const { language, t } = useLanguage(); const { currency, setCurrency, rate, loading, storageError, retryRate } = useCurrency();
  return <View style={styles.controls}>
    <View style={styles.row} accessibilityLabel={t('currency.label')}>
      <Text style={styles.label}>{t('currency.label')}</Text>
      {(['VND', 'USD'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value}
        accessibilityState={{ selected: currency === value }} onPress={() => { void setCurrency(value); }}
        style={[styles.choice, currency === value && styles.selected]}>
        <Text style={[styles.label, currency === value && styles.strong]}>{value}</Text>
      </Pressable>)}
    </View>
    {storageError && <Text accessibilityLiveRegion="polite" style={styles.error}>{t('currency.storageError')}</Text>}
    {currency === 'USD' && <View style={{ gap: 4 }}>
      {rate ? <>
        <Text style={styles.note}>{t('currency.rate', { rate: new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 2 }).format(rate.vndPerUsd) })}</Text>
        <Text style={styles.note}>{t('currency.updated', { date: new Intl.DateTimeFormat(localeFor(language), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(rate.updatedAt)) })}</Text>
      </> : <Text accessibilityLiveRegion="polite" style={loading ? styles.note : styles.error}>{t(loading ? 'currency.loading' : 'currency.unavailable')}</Text>}
      <Text style={styles.note}>{t('currency.reference')}</Text>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Link href={RATE_ATTRIBUTION} target="_blank" rel="noopener noreferrer" style={styles.source}>{t('currency.source')}</Link>
        {!rate && !loading && <Pressable accessibilityRole="button" onPress={retryRate} style={styles.choice}>
          <Text style={styles.label}>{t('currency.retry')}</Text>
        </Pressable>}
      </View>
    </View>}
  </View>;
}
export function MoneyText({ amount, currency = 'VND', style }: { amount: number; currency?: string; style?: StyleProp<TextStyle> }) {
  const { t } = useLanguage(); const money = useDisplayMoney()(amount, currency);
  return <View style={{ gap: 3 }}>
    <Text style={[styles.value, style]}>{money?.formatted ?? t('Price unavailable')}</Text>
    {money?.converted && <Text style={styles.note}>{t('currency.original', { amount: money.baseFormatted })}</Text>}
    {money?.fallback && <Text style={styles.note}>{t('currency.fallback')}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  controls: { gap: 4 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  label: { color: '#24515B', fontSize: 14, lineHeight: 20 }, strong: { fontWeight: '700' },
  choice: { minWidth: 60, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9CDD2', borderRadius: 8, backgroundColor: '#FFFFFF' },
  selected: { borderColor: '#007E91', backgroundColor: '#E0F7FA' },
  value: { color: '#434A54', fontSize: 18, lineHeight: 26, fontWeight: '700' },
  note: { color: '#536570', fontSize: 12, lineHeight: 18 }, error: { color: '#B42318', fontSize: 12, lineHeight: 18 },
  source: { color: '#007E91', fontSize: 12, lineHeight: 20, paddingVertical: 12, textDecorationLine: 'underline' },
});
