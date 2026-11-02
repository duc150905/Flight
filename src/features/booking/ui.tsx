import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguagePicker, useLanguage } from '../i18n/provider';
import { displayText, formatMoney } from '../i18n/translate';
import { useCheckout } from './checkout-provider';
import { checkoutEstimate } from './estimate';

const colors = { background: '#FFFFFF', surface: '#FFFFFF', text: '#434A54', muted: '#66717E', primary: '#00B8D0', tint: '#E4F8FB', border: '#C9CDD2', error: '#B42318' };
export function useCheckoutColors() { return colors; }
export function CheckoutButton({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const c = useCheckoutColors(); const { t } = useLanguage();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [checkoutStyles.button, { backgroundColor: secondary ? c.tint : c.primary, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
    <Text style={[checkoutStyles.buttonText, { color: '#00414B' }]}>{t(title)}</Text>
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
const stages = [
  { label: 'Travellers', name: { ios: 'person', android: 'person', web: 'person' } },
  { label: 'Baggage', name: { ios: 'suitcase.fill', android: 'luggage', web: 'luggage' } },
  { label: 'Seats', name: { ios: 'chair.fill', android: 'event_seat', web: 'event_seat' } },
  { label: 'Payment', name: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' } },
] as const;
export function CheckoutProgress() {
  const { t } = useLanguage();
  return <View accessibilityLabel={t('Step {number} of {total}', { number: 1, total: 4 })} style={checkoutStyles.progress}>
    <View style={checkoutStyles.connector} />
    {stages.map((stage, index) => <View key={stage.label} accessible accessibilityLabel={t(stage.label)} accessibilityState={{ selected: index === 0, disabled: index > 0 }}
      style={[checkoutStyles.circle, { backgroundColor: index === 0 ? colors.primary : '#F1F3F4' }]}>
      <SymbolView name={stage.name} size={25} tintColor={index === 0 ? '#00414B' : colors.muted} />
    </View>)}
  </View>;
}
type FooterAction = { title: string; onPress(): void; disabled?: boolean };
export function CheckoutShell({ title, step, children, back, footer }: PropsWithChildren<{ title: string; step?: number; back?: () => void; footer?: FooterAction }>) {
  const draft = useCheckout(); const [discard, setDiscard] = useState(false); const { t, language } = useLanguage();
  const estimate = checkoutEstimate(draft);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={checkoutStyles.header}>
        <View style={checkoutStyles.toolbar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Back')} onPress={back ?? (() => setDiscard(true))} style={checkoutStyles.iconButton}>
            <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} size={23} tintColor={colors.muted} />
          </Pressable>
          {step !== undefined ? <CheckoutProgress /> : <View style={{ flex: 1 }} />}
          <Pressable accessibilityRole="button" accessibilityLabel={t('Cancel')} onPress={() => setDiscard(true)} style={checkoutStyles.iconButton}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={19} tintColor={colors.muted} />
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={checkoutStyles.screenTitle}>{t(title)}</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={checkoutStyles.scroll}>
        <View style={checkoutStyles.content}>{children}<LanguagePicker /></View>
      </ScrollView>
      {footer && <View style={checkoutStyles.footer}>
        <View style={checkoutStyles.footerContent}>
          <View style={{ flex: 1, minWidth: 130, gap: 3 }}>
            <Text style={checkoutStyles.caption}>{t('Estimated total')}</Text>
            <Text style={checkoutStyles.amount}>{estimate ? formatMoney(language, estimate.amount, estimate.currency) : t('Price unavailable')}</Text>
            <Text style={checkoutStyles.caption}>{t(draft.passengers.length === 1 ? '{count} traveller' : '{count} travellers', { count: draft.passengers.length })}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 140 }}><CheckoutButton {...footer} /></View>
        </View>
        <Text style={checkoutStyles.caption}>{t('Final price is checked when booking.')}</Text>
      </View>}
    </KeyboardAvoidingView>
    <Modal visible={discard} transparent animationType="none" onRequestClose={() => setDiscard(false)}>
      <View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
        <CheckoutText title message={"Discard your details?"} />
        <CheckoutText muted message={"Your contact and traveller information will be cleared."} />
        <CheckoutButton title="Keep editing" onPress={() => setDiscard(false)} />
        <CheckoutButton title="Discard and leave" secondary onPress={() => { draft.reset(); setDiscard(false); router.replace('/'); }} />
      </View></View>
    </Modal>
  </SafeAreaView>;
}
export function MissingCheckout() {
  return <CheckoutShell title="Choose your flights first"><CheckoutText muted message={"Your checkout is empty or has expired. Return to flight search to start again."} />
    <CheckoutButton title="Back to home" onPress={() => router.replace('/')} /></CheckoutShell>;
}
export const checkoutStyles = StyleSheet.create({
  header: { borderBottomWidth: 1, borderColor: '#EFF0F2', paddingBottom: 24 },
  toolbar: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center', color: colors.text, paddingHorizontal: 20, marginTop: 12 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 28 },
  content: { width: '100%', maxWidth: 580, alignSelf: 'center', gap: 24 },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 26 }, body: { fontSize: 16, lineHeight: 24 },
  card: { gap: 22, paddingBottom: 28, borderBottomWidth: 1, borderColor: '#EFF0F2' },
  button: { minHeight: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 24 },
  progress: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: 290, marginHorizontal: 10 },
  connector: { position: 'absolute', left: 20, right: 20, height: 4, backgroundColor: '#F1F3F4' },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderTopWidth: 1, borderColor: '#EFF0F2', gap: 8, backgroundColor: colors.surface },
  footerContent: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', width: '100%', maxWidth: 580, alignSelf: 'center' },
  amount: { color: colors.text, fontWeight: '700', fontSize: 22, lineHeight: 30 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  dialog: { alignSelf: 'center', width: '100%', maxWidth: 460, backgroundColor: colors.surface, borderRadius: 12, padding: 24, gap: 20 },
});
