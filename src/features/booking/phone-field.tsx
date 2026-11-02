import { useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useLanguage } from '../i18n/provider';
import { phoneCodes, splitPhone, choosePhoneCode } from './phone';
import { CheckoutButton, CheckoutError, checkoutStyles, useCheckoutColors } from './ui';

export function CheckoutPhoneField<T extends FieldValues>({ control, name, onRawChange }: { control: Control<T>; name: FieldPath<T>; onRawChange(value: string): void }) {
  const { t } = useLanguage(); const c = useCheckoutColors(); const [open, setOpen] = useState(false); const [fullNumber, setFullNumber] = useState(false);
  return <Controller control={control} name={name} render={({ field, fieldState }) => {
    const parts = fullNumber ? { code: '', number: field.value ?? '' } : splitPhone(field.value ?? '');
    const change = (raw: string) => { field.onChange(raw); onRawChange(raw); };
    return <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', lineHeight: 24 }}>{t('Phone number')}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Country calling code')} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)}
          style={{ minWidth: 88, minHeight: 48, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}>
          <Text style={{ color: c.text, fontSize: 16 }}>{parts.code || t('Calling code')} ▾</Text>
        </Pressable>
        <TextInput ref={field.ref} value={parts.number} keyboardType="phone-pad" autoComplete="tel" accessibilityLabel={t('Phone number')}
          accessibilityHint={fieldState.error?.message ? t(fieldState.error.message) : t('Enter the full number or choose a calling code.')}
          placeholder={parts.code ? '901 234 567' : '+84 901 234 567'} placeholderTextColor={c.muted}
          onBlur={field.onBlur} onChangeText={value => change(parts.code ? `${parts.code} ${value}` : value)}
          style={{ flex: 1, minWidth: 0, minHeight: 48, padding: 12, fontSize: 16, color: c.text, borderRadius: 8, borderWidth: 1, borderColor: fieldState.error ? c.error : c.border }} />
      </View>
      <CheckoutError message={fieldState.error?.message} />
      <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
        <View style={checkoutStyles.scrim}><View accessibilityViewIsModal style={checkoutStyles.dialog}>
          {phoneCodes.map(code => <CheckoutButton key={code} title={code || 'Full international number'} secondary onPress={() => {
            setFullNumber(!code); change(choosePhoneCode(field.value ?? '', code)); field.onBlur(); setOpen(false);
          }} />)}
          <CheckoutButton title="Close" onPress={() => setOpen(false)} />
        </View></View>
      </Modal>
    </View>;
  }} />;
}
