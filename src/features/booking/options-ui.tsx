import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../i18n/provider';
import { CheckoutText, useCheckoutColors } from './ui';
export function Option({ title, selected, disabled = false, onPress, children }: PropsWithChildren<{ title: string; selected: boolean; disabled?: boolean; onPress(): void }>) {
  const c = useCheckoutColors();
  return <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: selected, disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [optionStyles.option, { borderColor: selected ? c.primary : c.border,
      backgroundColor: selected ? c.tint : c.surface, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <View style={{ flex: 1, gap: 6 }}><CheckoutText>{title}</CheckoutText>{children}</View>
    <Text style={{ fontSize: 22, color: selected ? c.text : c.muted }}>{selected ? '●' : '○'}</Text>
  </Pressable>;
}
export function Tabs({ label, values, selected, onSelect }: { label: string; values: { id: string; text: string }[]; selected: string; onSelect(id: string): void }) {
  const c = useCheckoutColors(); const { t } = useLanguage();
  return <View accessibilityLabel={t(label)} style={optionStyles.tabs}>{values.map(v => <Pressable key={v.id} accessibilityRole="button"
    accessibilityState={{ selected: v.id === selected }} onPress={() => onSelect(v.id)}
    style={({ pressed }) => [optionStyles.tab, { backgroundColor: v.id === selected ? c.tint : c.surface, borderColor: v.id === selected ? c.primary : c.border, opacity: pressed ? 0.7 : 1 }]}>
    <CheckoutText>{v.text}</CheckoutText></Pressable>)}</View>;
}
const optionStyles = StyleSheet.create({ option: { padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tab: { padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 12, justifyContent: 'center' } });
