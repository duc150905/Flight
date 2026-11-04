import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/provider';
import { displayText } from '../i18n/translate';
import { CurrencyRateNote, MoneyText } from '../currency/ui';
import { useCheckout } from './checkout-provider';
import { checkoutEstimate } from './estimate';
import { clearPendingSelection } from './pending-selection-storage';

const colors = { background: '#FFFFFF', surface: '#FFFFFF', text: '#434A54', muted: '#66717E', primary: '#00B8D0', tint: '#E4F8FB', border: '#C9CDD2', error: '#B42318' };
export function useCheckoutColors() { return colors; }
export function CheckoutButton({ title, onPress, secondary = false, disabled = false, variant = 'filled', tone = 'default' }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
  variant?: 'filled' | 'text'; tone?: 'default' | 'danger';
}) {
  const c = useCheckoutColors(); const { t } = useLanguage();
  const backgroundColor = variant === 'text' ? 'transparent' : tone === 'danger' ? '#FEECE9' : secondary ? c.tint : c.primary;
  const color = tone === 'danger' ? c.error : variant === 'text' ? '#006D7D' : '#00414B';
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [checkoutStyles.button, { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
    <Text style={[checkoutStyles.buttonText, { color }]}>{t(title)}</Text>
  </Pressable>;
}
export function CheckoutText({ children, message, muted = false, title = false }: PropsWithChildren<{ message?: string; muted?: boolean; title?: boolean }>) {
  const { language } = useLanguage();
  return <Text accessibilityRole={title ? 'header' : undefined} style={[title ? checkoutStyles.title : checkoutStyles.body, { color: muted ? colors.muted : colors.text }]}>{displayText(language, children, message)}</Text>;
}
export function CheckoutCard({ children }: PropsWithChildren) {
  return <View style={checkoutStyles.card}>{children}</View>;
}
export function CheckoutError({ message }: { message?: string }) {
  const { t } = useLanguage();
  return message ? <Text accessibilityLiveRegion="polite" style={[checkoutStyles.body, { color: colors.error }]}>{t(message)}</Text> : null;
}
export function CheckoutSymbol({
  name,
  size = 22,
  tintColor = colors.muted,
}: {
  name: any;
  size?: number;
  tintColor?: string;
}) {
  if (Platform.OS !== 'web') {
    return <SymbolView name={name} size={size} tintColor={tintColor} />;
  }

  const key = typeof name === 'string'
    ? name
    : (name?.web ?? name?.android ?? name?.ios ?? '');

  let svg = '';
  switch (key) {
    case 'person':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      break;
    case 'luggage':
    case 'suitcase.fill':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="12" height="12" rx="2"/><path d="M9 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3"/><line x1="10" y1="12" x2="10" y2="16"/><line x1="14" y1="12" x2="14" y2="16"/></svg>`;
      break;
    case 'event_seat':
    case 'chair.fill':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v11a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V3"/><path d="M4 11h16"/><path d="M6 21v-3"/><path d="M18 21v-3"/></svg>`;
      break;
    case 'credit_card':
    case 'creditcard':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
      break;
    case 'arrow_back':
    case 'arrow.left':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>`;
      break;
    case 'close':
    case 'xmark':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      break;
    case 'expand_more':
    case 'chevron.down':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      break;
    case 'check_circle':
    case 'checkmark.circle':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${tintColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      break;
    case 'flight':
    case 'airplane':
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${tintColor}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
      break;
    default:
      return <SymbolView name={name} size={size} tintColor={tintColor} />;
  }

  return (
    <Image
      source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
      alt=""
    />
  );
}

const stages = [
  { label: 'Travellers', name: { ios: 'person', android: 'person', web: 'person' } },
  { label: 'Baggage', name: { ios: 'suitcase.fill', android: 'luggage', web: 'luggage' } },
  { label: 'Seats', name: { ios: 'chair.fill', android: 'event_seat', web: 'event_seat' } },
  { label: 'Payment', name: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' } },
] as const;
export function CheckoutProgress({ step = 1 }: { step?: number }) {
  const { t } = useLanguage();
  return <View accessibilityLabel={t('Step {number} of {total}', { number: step, total: 4 })} style={checkoutStyles.progress}>
    <View style={checkoutStyles.connector} />
    {stages.map((stage, index) => <View key={stage.label} accessible accessibilityLabel={t(stage.label)} accessibilityState={{ selected: index === step - 1, disabled: index > step - 1 }}
      style={[checkoutStyles.circle, { backgroundColor: index < step ? colors.primary : '#F1F3F4' }]}>
      <CheckoutSymbol name={stage.name} size={25} tintColor={index < step ? '#00414B' : colors.muted} />
    </View>)}
  </View>;
}
type FooterAction = { title: string; onPress(): void; disabled?: boolean };
export function CheckoutShell({ title, step, children, back, footer, footerDetail, savedTotal }: PropsWithChildren<{ title: string; step?: number; back?: () => void; footer?: FooterAction; footerDetail?: ReactNode; savedTotal?: { amount: number; count: number;caption?:string } }>) {
  const draft = useCheckout(); const [discard, setDiscard] = useState(false); const { t } = useLanguage();
  const estimate = checkoutEstimate(draft);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={checkoutStyles.header}>
        <View style={checkoutStyles.toolbar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Back')} onPress={back ?? (() => setDiscard(true))} style={checkoutStyles.iconButton}>
            <CheckoutSymbol name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} size={23} tintColor={colors.muted} />
          </Pressable>
          <View style={checkoutStyles.progressSlot}>
            {step !== undefined ? <CheckoutProgress step={step} /> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(savedTotal ? 'My bookings' : 'Cancel')} onPress={() => savedTotal ? router.replace('/tickets') : setDiscard(true)} style={checkoutStyles.iconButton}>
            <CheckoutSymbol name={{ ios: 'xmark', android: 'close', web: 'close' }} size={19} tintColor={colors.muted} />
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={checkoutStyles.screenTitle}>{t(title)}</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={checkoutStyles.scroll}>
        <View style={checkoutStyles.content}>{children}</View>
      </ScrollView>
      {footer && <View style={checkoutStyles.footer}>
        {footerDetail}
        <View style={checkoutStyles.footerContent}>
          <View style={{ flex: 1, minWidth: 130, gap: 3 }}>
            <Text style={checkoutStyles.caption}>{t(savedTotal ? 'Booking total' : 'Estimated total')}</Text>
            {savedTotal ? <MoneyText amount={savedTotal.amount} style={checkoutStyles.amount} /> : estimate ? <MoneyText amount={estimate.amount} currency={estimate.currency} style={checkoutStyles.amount} />
              : <Text style={checkoutStyles.amount}>{t('Price unavailable')}</Text>}
            {(savedTotal || estimate) && <CurrencyRateNote />}
            <Text style={checkoutStyles.caption}>{t((savedTotal?.count ?? draft.passengers.length) === 1 ? '{count} traveller' : '{count} travellers', { count: savedTotal?.count ?? draft.passengers.length })}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 140 }}><CheckoutButton {...footer} /></View>
        </View>
        <Text style={checkoutStyles.caption}>{t(savedTotal ? savedTotal.caption??'No payment has been taken.' : 'Final price is checked when booking.')}</Text>
      </View>}
    </KeyboardAvoidingView>
    <Modal visible={discard} transparent animationType="none" onRequestClose={() => setDiscard(false)}>
      <View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
        <CheckoutText title message={"Discard your details?"} />
        <CheckoutText muted message={"Your contact and traveller information will be cleared."} />
        <CheckoutButton title="Keep editing" onPress={() => setDiscard(false)} />
        <CheckoutButton title="Discard and leave" secondary onPress={() => { draft.reset(); setDiscard(false); void clearPendingSelection(); router.replace('/'); }} />
      </View></View>
    </Modal>
  </SafeAreaView>;
}
export function MissingCheckout() {
  return <CheckoutShell title="Choose your flights first"><CheckoutText muted message={"Your checkout is empty or has expired. Return to flight search to start again."} />
    <CheckoutButton title="Back to home" onPress={() => router.replace('/')} /></CheckoutShell>;
}
export const checkoutStyles = StyleSheet.create({
  header: { borderBottomWidth: 1, borderColor: '#EFF0F2', paddingBottom: 24, width: '100%' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  progressSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center', color: colors.text, paddingHorizontal: 20, marginTop: 12 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 28 },
  content: { width: '100%', maxWidth: 580, alignSelf: 'center', gap: 24 },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 26 }, body: { fontSize: 16, lineHeight: 24 },
  card: { gap: 22, paddingBottom: 28, borderBottomWidth: 1, borderColor: '#EFF0F2' },
  button: { minHeight: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 24 },
  progress: {
    width: '100%',
    maxWidth: 290,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connector: { position: 'absolute', left: 20, right: 20, height: 4, backgroundColor: '#F1F3F4' },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderTopWidth: 1, borderColor: '#EFF0F2', gap: 8, backgroundColor: colors.surface },
  footerContent: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', width: '100%', maxWidth: 580, alignSelf: 'center' },
  amount: { color: colors.text, fontWeight: '700', fontSize: 22, lineHeight: 30 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  dialog: { alignSelf: 'center', width: '100%', maxWidth: 460, backgroundColor: colors.surface, borderRadius: 12, padding: 24, gap: 20 },
});
