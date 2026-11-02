import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useLanguage } from '../i18n/provider';
import { CheckoutButton, CheckoutError, CheckoutText, checkoutStyles, useCheckoutColors } from './ui';

export function CheckoutChoice<T extends FieldValues>({ control, name, label, options, onRawChange }: {
  control: Control<T>; name: FieldPath<T>; label: string; options: readonly string[]; onRawChange(value: string): void;
}) {
  const [open, setOpen] = useState(false); const { t } = useLanguage(); const c = useCheckoutColors();
  return <Controller control={control} name={name} render={({ field, fieldState }) => <View style={{ gap: 6 }}>
    <Text style={{ fontSize: 16, fontWeight: '600', lineHeight: 24, color: c.text }}>{t(label)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${t(label)}: ${t(field.value || 'Select gender')}`} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(true)} style={{ borderRadius: 8, borderWidth: 1, borderColor: fieldState.error ? c.error : c.border, padding: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: field.value ? c.text : c.muted, fontSize: 16 }}>{t(field.value || 'Select gender')}</Text>
      <SymbolView name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} size={20} tintColor={c.text} />
    </Pressable>
    <CheckoutError message={fieldState.error?.message} />
    <Modal visible={open} transparent onRequestClose={() => { setOpen(false); field.onBlur(); }}>
      <View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
        <CheckoutText title message={label} />
        {options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: field.value === option }}
          onPress={() => { field.onChange(option); onRawChange(option); field.onBlur(); setOpen(false); }}
          style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 16 }}>{t(option)}</Text>
        </Pressable>)}
        <CheckoutButton title="Close" secondary onPress={() => { setOpen(false); field.onBlur(); }} />
      </View></View>
    </Modal>
  </View>} />;
}
