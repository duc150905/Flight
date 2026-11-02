import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useCheckoutColors } from './ui';
import { useLanguage } from '../i18n/provider';

export function CheckoutField<T extends FieldValues>({ control, name, label, onRawChange, ...props }: {
  control: Control<T>; name: FieldPath<T>; label: string; onRawChange: (value: string) => void;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'>) {
  const c = useCheckoutColors(); const { t } = useLanguage();
  const translatedLabel = t(label);
  return <Controller control={control} name={name} render={({ field, fieldState }) => <View style={styles.field}>
    <Text nativeID={`${name}-label`} style={[styles.label, { color: c.text }]}>{translatedLabel}</Text>
    <TextInput {...props} ref={field.ref} value={field.value ?? ''}
      onChangeText={value => { field.onChange(value); onRawChange(value); }} onBlur={field.onBlur}
      accessibilityLabel={translatedLabel} accessibilityLabelledBy={`${name}-label`}
      accessibilityHint={fieldState.error?.message ? t(fieldState.error.message) : props.accessibilityHint}
      placeholderTextColor={c.muted}
      style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: fieldState.error ? c.error : c.border }]} />
    {!!fieldState.error?.message && <Text accessibilityLiveRegion="polite" style={[styles.error, { color: c.error }]}>{t(fieldState.error.message)}</Text>}
  </View>} />;
}
const styles = StyleSheet.create({
  field: { gap: 8 }, label: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  error: { fontSize: 14, lineHeight: 21 },
});
