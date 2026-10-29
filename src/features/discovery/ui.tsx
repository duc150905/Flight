import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/features/auth/ui';

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
  return <Text style={styles.brand}>FLIGHT<Text style={{ color: colors.primary }}>.</Text></Text>;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 18 },
  brand: { fontSize: 28, fontWeight: '900', letterSpacing: 3, color: colors.text },
  title: { fontSize: 27, fontWeight: '800', lineHeight: 34, color: colors.text },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
  card: { padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E4EBF4', gap: 14 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 52, paddingHorizontal: 14, color: colors.text, fontSize: 16 },
  picker: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 54, paddingHorizontal: 14, justifyContent: 'center' },
  pickerText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 10, minHeight: 42, justifyContent: 'center' },
  selectedChip: { borderColor: colors.primary, backgroundColor: colors.light },
  chipText: { color: colors.text, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#E4EBF4' },
});
