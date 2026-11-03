import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useLanguage } from '../i18n/provider';
import { useCurrency, useDisplayMoney } from './provider';
import { RATE_ATTRIBUTION } from './rates';

export function CurrencyRateNote() {
  const { t } = useLanguage(); const { currency, rate, loading, retryRate } = useCurrency();
  if (currency !== 'USD') return null;
  return <View style={styles.controls}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Link href={RATE_ATTRIBUTION} target="_blank" rel="noopener noreferrer" style={styles.source}>{t('currency.source')}</Link>
        {!rate && !loading && <Pressable accessibilityRole="button" onPress={retryRate} style={styles.choice}>
          <Text style={styles.label}>{t('currency.retry')}</Text>
        </Pressable>}
      </View>
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
  label: { color: '#24515B', fontSize: 14, lineHeight: 20 },
  choice: { minWidth: 60, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9CDD2', borderRadius: 8, backgroundColor: '#FFFFFF' },
  value: { color: '#434A54', fontSize: 18, lineHeight: 26, fontWeight: '700' },
  note: { color: '#536570', fontSize: 12, lineHeight: 18 }, error: { color: '#B42318', fontSize: 12, lineHeight: 18 },
  source: { color: '#007E91', fontSize: 12, lineHeight: 20, paddingVertical: 12, textDecorationLine: 'underline' },
});
