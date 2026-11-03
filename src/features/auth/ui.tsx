import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguagePicker, useLanguage } from '@/features/i18n/provider';
import { AppBrand } from '@/components/app-brand';

export const colors = {
  background: '#F2FBFC', surface: '#FFFFFF', text: '#253540', muted: '#536570',
  primary: '#007E91', border: '#C9DDE2', error: '#B42318', errorBg: '#FFF0ED',
  success: '#15603A', successBg: '#EAF7EF', light: '#E4F8FB',
};

export function AuthShell({ children }: PropsWithChildren) {
  const { t } = useLanguage();
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <AppBrand />
          <LanguagePicker />
          <Text style={styles.tagline}>{t('Hành trình tiếp theo bắt đầu từ đây.')}</Text>
          <View style={styles.card}>{children}</View>
          <Text style={styles.footer}>{t('Lên kế hoạch gọn gàng cho mỗi chuyến đi.')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function FormField<T extends FieldValues>({ control, name, label, password, ...props }: {
  control: Control<T>; name: FieldPath<T>; label: string; password?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'>) {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();
  return <Controller control={control} name={name} render={({ field, fieldState }) =>
    <View style={styles.field}>
      <Text nativeID={`${name}-label`} style={styles.label}>{t(label)}</Text>
      <View style={[styles.inputRow, fieldState.error && styles.invalid]}>
        <TextInput {...props} ref={field.ref} value={field.value ?? ''} onChangeText={field.onChange}
          onBlur={field.onBlur} accessibilityLabel={t(label)} accessibilityLabelledBy={`${name}-label`}
          placeholder={props.placeholder ? t(props.placeholder) : undefined}
          secureTextEntry={password && !visible} placeholderTextColor={colors.muted} style={styles.input} />
        {password && <Pressable onPress={() => setVisible(value => !value)} accessibilityRole="button"
          disabled={props.editable === false} accessibilityState={{ disabled: props.editable === false }}
          accessibilityLabel={`${t(visible ? 'Ẩn' : 'Hiện')} ${t(label).toLowerCase()}`} style={styles.reveal}>
          <SymbolView name={visible
            ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
            : { ios: 'eye', android: 'visibility', web: 'visibility' }} size={22} tintColor={colors.primary} />
        </Pressable>}
      </View>
      {fieldState.error && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{t(fieldState.error.message ?? '')}</Text>}
    </View>} />;
}

export function GoogleIcon() {
  return <View style={styles.googleIcon} pointerEvents="none">
    <Image source={require('../../../assets/branding/google-sign-in.png')} accessible={false} alt=""
      contentFit="contain" style={styles.googleGlyph} />
  </View>;
}

export function ActionButton({ title, onPress, busy = false, disabled = false, secondary = false, outlined = false, icon }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; outlined?: boolean; icon?: ReactNode;
}) {
  const { t } = useLanguage();
  const countdown = /^Gửi lại sau (\d+) giây$/.exec(title);
  const displayTitle = countdown ? t('Gửi lại sau {seconds} giây', { seconds: countdown[1] }) : t(title);
  return <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button"
    accessibilityState={{ disabled: disabled || busy, busy }}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, outlined && styles.outlined, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
    {busy ? <ActivityIndicator color={secondary || outlined ? colors.primary : colors.surface} accessibilityLabel={t('Vui lòng chờ')} />
      : <>{icon}<Text style={[styles.buttonText, secondary && styles.secondaryText, outlined && styles.outlinedText]}>{displayTitle}</Text></>}
  </Pressable>;
}

export function Notice({ text, success = false }: { text: string; success?: boolean }) {
  const { t } = useLanguage();
  if (!text) return null;
  return <View style={[styles.notice, success && styles.successNotice]}>
    <Text accessibilityLiveRegion="polite" style={{ color: success ? colors.success : colors.error, lineHeight: 22 }}>{t(text)}</Text>
  </View>;
}

export const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 3 },
  brandDot: { color: colors.primary }, tagline: { color: colors.muted, fontSize: 16, marginBottom: 16 },
  card: { backgroundColor: colors.surface, padding: 24, borderRadius: 24, gap: 16, borderWidth: 1, borderColor: '#D6ECEF' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  field: { gap: 8 }, label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  inputRow: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  invalid: { borderColor: colors.error }, input: { flex: 1, minWidth: 0, padding: 14, fontSize: 16, color: colors.text },
  reveal: { minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 }, errorText: { color: colors.error, fontSize: 13, lineHeight: 19 },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 16, textAlign: 'center', flexShrink: 1 },
  secondary: { backgroundColor: colors.light }, secondaryText: { color: colors.primary },
  outlined: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#747775' },
  outlinedText: { color: '#1F1F1F', fontWeight: '500' },
  googleIcon: { width: 20, height: 20, overflow: 'hidden' },
  googleGlyph: { position: 'absolute', width: 40, height: 40, left: -10, top: -10 },
  forgotLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 4, marginVertical: -8 },
  disabled: { opacity: 0.55 }, pressed: { opacity: 0.8 },
  notice: { borderRadius: 12, padding: 12, backgroundColor: colors.errorBg }, successNotice: { backgroundColor: colors.successBg },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 13, marginTop: 12, lineHeight: 20 },
});
