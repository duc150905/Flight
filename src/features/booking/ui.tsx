import { router } from 'expo-router';
import { useState, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCheckout } from './checkout-provider';
import { LanguagePicker } from '../i18n/provider';

const palettes = {
  light: { background: '#F5F9FA', surface: '#FFFFFF', text: '#253540', muted: '#536570', primary: '#007E91', tint: '#E4F5F6', border: '#BCCBD1', error: '#B42318' },
  dark: { background: '#101C22', surface: '#192B33', text: '#F0F7FA', muted: '#B3C6CF', primary: '#79DEE8', tint: '#203E48', border: '#69818D', error: '#FFABA3' },
};
export function useCheckoutColors() { return palettes[useColorScheme() === 'dark' ? 'dark' : 'light']; }
export function CheckoutButton({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const c = useCheckoutColors();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [checkoutStyles.button, { backgroundColor: secondary ? c.tint : c.primary, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
    <Text style={[checkoutStyles.buttonText, { color: secondary ? c.primary : c.background }]}>{title}</Text>
  </Pressable>;
}
export function CheckoutText({ children, muted = false, title = false }: PropsWithChildren<{ muted?: boolean; title?: boolean }>) {
  const c = useCheckoutColors();
  return <Text accessibilityRole={title ? 'header' : undefined} style={[title ? checkoutStyles.title : checkoutStyles.body, { color: muted ? c.muted : c.text }]}>{children}</Text>;
}
export function CheckoutCard({ children }: PropsWithChildren) {
  const c = useCheckoutColors();
  return <View style={[checkoutStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>;
}
export function CheckoutError({ message }: { message?: string }) {
  const c = useCheckoutColors();
  return message ? <Text accessibilityLiveRegion="polite" style={[checkoutStyles.body, { color: c.error }]}>{message}</Text> : null;
}
export function CheckoutShell({ title, step, children, back }: PropsWithChildren<{ title: string; step?: number; back?: () => void }>) {
  const c = useCheckoutColors(); const draft = useCheckout(); const [discard, setDiscard] = useState(false);
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={checkoutStyles.scroll}>
        <View style={checkoutStyles.content}>
          <View style={checkoutStyles.toolbar}>
            {back ? <CheckoutButton title="Back" secondary onPress={back} /> : <CheckoutText muted>FLIGHT / BOOKING</CheckoutText>}
            <Pressable accessibilityRole="button" onPress={() => setDiscard(true)} style={checkoutStyles.cancel}>
              <Text style={[checkoutStyles.body, { color: c.muted }]}>Cancel</Text>
            </Pressable>
          </View>
          <LanguagePicker />
          {step !== undefined && <View accessibilityLabel={`Step ${step + 1} of 3`} style={checkoutStyles.progress}>
            {['Contact', 'Travellers', 'Review'].map((label, index) => <View key={label} style={checkoutStyles.progressItem}>
              <View style={[checkoutStyles.circle, { backgroundColor: index <= step ? c.primary : c.tint }]}>
                <Text style={{ fontWeight: '700', color: index <= step ? c.background : c.muted }}>{index + 1}</Text>
              </View><Text style={{ color: index === step ? c.primary : c.muted, fontSize: 13 }}>{label}</Text>
            </View>)}
          </View>}
          <CheckoutText title>{title}</CheckoutText>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={discard} transparent animationType="none" onRequestClose={() => setDiscard(false)}>
      <View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={[checkoutStyles.dialog, { backgroundColor: c.surface }]}>
        <CheckoutText title>Discard your details?</CheckoutText>
        <CheckoutText muted>Your contact and traveller information will be cleared.</CheckoutText>
        <CheckoutButton title="Keep editing" onPress={() => setDiscard(false)} />
        <CheckoutButton title="Discard and leave" secondary onPress={() => { draft.reset(); setDiscard(false); router.replace('/'); }} />
      </View></View>
    </Modal>
  </SafeAreaView>;
}
export function MissingCheckout() {
  return <CheckoutShell title="Choose your flights first"><CheckoutText muted>Your checkout is empty or has expired. Return to flight search to start again.</CheckoutText>
    <CheckoutButton title="Back to home" onPress={() => router.replace('/')} /></CheckoutShell>;
}
export const checkoutStyles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 20 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  cancel: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  title: { fontSize: 26, fontWeight: '700', lineHeight: 34 }, body: { fontSize: 16, lineHeight: 24 },
  card: { borderRadius: 18, borderWidth: 1, padding: 20, gap: 16 },
  button: { minHeight: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 14 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  progress: { flexDirection: 'row', justifyContent: 'space-around', gap: 8, paddingVertical: 8 },
  progressItem: { flex: 1, alignItems: 'center', gap: 8 }, circle: { minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  dialog: { alignSelf: 'center', width: '100%', maxWidth: 460, borderRadius: 20, padding: 24, gap: 20 },
});
