import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/app-brand';

export const flightColors = {
  background: '#FFFFFF', surface: '#FFFFFF', text: '#253540', muted: '#536570',
  primary: '#007E91', tint: '#E4F5F6', border: '#D7E1E5',
};

export function FlightButton({ title, onPress, secondary = false, disabled = false }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: secondary ? flightColors.tint : flightColors.primary,
      opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
    <Text style={[styles.buttonText, { color: secondary ? flightColors.primary : flightColors.surface }]}>{title}</Text>
  </Pressable>;
}

export function Page({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function Brand() {
  return <AppBrand />;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: flightColors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 18 },
  brand: { fontSize: 28, fontWeight: '900', letterSpacing: 3, color: flightColors.text },
  title: { fontSize: 27, fontWeight: '800', lineHeight: 34, color: flightColors.text },
  subtitle: { fontSize: 15, lineHeight: 23, color: flightColors.muted },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: flightColors.text },
  card: { padding: 18, borderRadius: 18, backgroundColor: flightColors.surface,
    borderWidth: 1, borderColor: flightColors.border, gap: 14 },
  label: { color: flightColors.text, fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: flightColors.border, borderRadius: 12, minHeight: 52,
    paddingHorizontal: 14, color: flightColors.text, fontSize: 16 },
  picker: { borderWidth: 1, borderColor: flightColors.border, borderRadius: 12, minHeight: 54,
    paddingHorizontal: 14, justifyContent: 'center' },
  pickerText: { color: flightColors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: flightColors.muted, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: flightColors.border,
    paddingHorizontal: 13, paddingVertical: 10, minHeight: 44, minWidth: 44,
    justifyContent: 'center', alignItems: 'center' },
  selectedChip: { borderColor: flightColors.primary, backgroundColor: flightColors.tint },
  chipText: { color: flightColors.text, fontWeight: '600' },
  link: { color: flightColors.primary, fontWeight: '700', fontSize: 15 },
  divider: { height: 1, backgroundColor: flightColors.border },
  button: { minHeight: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
