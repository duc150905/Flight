import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, colors } from '@/features/auth/ui';

export const ticketStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
  back: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 18, gap: 10 },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  strong: { color: colors.text, fontSize: 17, fontWeight: '700' },
  status: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  column: { flex: 1, gap: 4 },
  divider: { height: 1, backgroundColor: colors.border },
  state: { flex: 1, justifyContent: 'center' },
});

export function TicketBack({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={ticketStyles.back}>
    <Text style={ticketStyles.backText}>‹ {label}</Text>
  </Pressable>;
}

export function TicketState({ title, description, loading = false, action, onAction, children }: PropsWithChildren<{
  title: string; description: string; loading?: boolean; action?: string; onAction?: () => void;
}>) {
  return <SafeAreaView style={ticketStyles.safe}>
    <View style={[ticketStyles.content, ticketStyles.state]}>
      <Text accessibilityRole="header" style={ticketStyles.title}>{title}</Text>
      <Text style={ticketStyles.subtitle}>{description}</Text>
      {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Đang tải" />}
      {children}
      {action && onAction && <ActionButton title={action} onPress={onAction} />}
    </View>
  </SafeAreaView>;
}
