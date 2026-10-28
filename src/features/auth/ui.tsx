import { useState, type PropsWithChildren } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  background: '#F3F7FC', surface: '#FFFFFF', text: '#102A43', muted: '#526579',
  primary: '#1457CF', border: '#CBD5E1', error: '#B42318', errorBg: '#FFF0ED',
  success: '#15603A', successBg: '#EAF7EF', light: '#E9F0FF',
};

export function AuthShell({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.brand}>FLIGHT<Text style={styles.brandDot}>.</Text></Text>
          <Text style={styles.tagline}>Your next journey starts here.</Text>
          <View style={styles.card}>{children}</View>
          <Text style={styles.footer}>A little planning. A world of possibilities.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function FormField<T extends FieldValues>({ control, name, label, password, ...props }: {
  control: Control<T>; name: FieldPath<T>; label: string; password?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'>) {
  const [visible, setVisible] = useState(false);
  return <Controller control={control} name={name} render={({ field, fieldState }) =>
    <View style={styles.field}>
      <Text nativeID={`${name}-label`} style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, fieldState.error && styles.invalid]}>
        <TextInput {...props} ref={field.ref} value={field.value ?? ''} onChangeText={field.onChange}
          onBlur={field.onBlur} accessibilityLabel={label} accessibilityLabelledBy={`${name}-label`}
          secureTextEntry={password && !visible} placeholderTextColor={colors.muted} style={styles.input} />
        {password && <Pressable onPress={() => setVisible(value => !value)} accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} style={styles.reveal}>
          <Text style={styles.link}>{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>}
      </View>
      {fieldState.error && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{fieldState.error.message}</Text>}
    </View>} />;
}

export function ActionButton({ title, onPress, busy = false, disabled = false, secondary = false }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button"
    accessibilityState={{ disabled: disabled || busy, busy }}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
    {busy ? <ActivityIndicator color={secondary ? colors.primary : colors.surface} accessibilityLabel="Please wait" />
      : <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>}
  </Pressable>;
}

export function Notice({ text, success = false }: { text: string; success?: boolean }) {
  if (!text) return null;
  return <View style={[styles.notice, success && styles.successNotice]}>
    <Text accessibilityLiveRegion="polite" style={{ color: success ? colors.success : colors.error, lineHeight: 22 }}>{text}</Text>
  </View>;
}

export const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 3 },
  brandDot: { color: colors.primary }, tagline: { color: colors.muted, fontSize: 16, marginBottom: 16 },
  card: { backgroundColor: colors.surface, padding: 24, borderRadius: 24, gap: 16, borderWidth: 1, borderColor: '#E4EBF4' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  field: { gap: 8 }, label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  inputRow: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  invalid: { borderColor: colors.error }, input: { flex: 1, minWidth: 0, padding: 14, fontSize: 16, color: colors.text },
  reveal: { minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 }, errorText: { color: colors.error, fontSize: 13, lineHeight: 19 },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  secondary: { backgroundColor: colors.light }, secondaryText: { color: colors.primary },
  disabled: { opacity: 0.55 }, pressed: { opacity: 0.8 },
  notice: { borderRadius: 12, padding: 12, backgroundColor: colors.errorBg }, successNotice: { backgroundColor: colors.successBg },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 13, marginTop: 12, lineHeight: 20 },
});
