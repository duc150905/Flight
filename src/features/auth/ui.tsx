import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/features/i18n/provider';
import { AppBrand } from '@/components/app-brand';
import { triggerOpenSearch } from '@/features/discovery/search-state';

export const colors = {
  background: '#F2FBFC', surface: '#FFFFFF', text: '#253540', muted: '#536570',
  primary: '#007E91', border: '#C9DDE2', error: '#B42318', errorBg: '#FFF0ED',
  success: '#15603A', successBg: '#EAF7EF', light: '#E4F8FB',
};

export function AuthShell({ children }: PropsWithChildren) {
  const { t, language, setLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langExpanded, setLangExpanded] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(Math.max(windowWidth * 0.78, 280), 320);

  const [slideAnim] = useState(() => new Animated.Value(320));
  const [fadeAnim] = useState(() => new Animated.Value(0));

  const openMenu = () => {
    slideAnim.setValue(drawerWidth);
    fadeAnim.setValue(0);
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: drawerWidth,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuOpen(false);
      callback?.();
    });
  };

  const goHome = () => {
    setMenuOpen(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const goSearch = () => {
    setMenuOpen(false);
    triggerOpenSearch();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/?search=1' as any);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Top Bar with Brand on left and 3-line hamburger menu on right */}
            <View style={styles.headerRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Trang chủ')}
                onPress={goHome}
              >
                <AppBrand />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Mở menu')}
                onPress={openMenu}
                style={styles.menuButton}
              >
                <Text style={styles.menuButtonIcon}>☰</Text>
              </Pressable>
            </View>

            <Text style={styles.tagline}>{t('Hành trình tiếp theo bắt đầu từ đây.')}</Text>
            <View style={styles.card}>{children}</View>
            <Text style={styles.footer}>{t('Lên kế hoạch gọn gàng cho mỗi chuyến đi.')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Side Drawer sliding in from right */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        onRequestClose={() => closeMenu()}
      >
        <View style={styles.drawerOverlay}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: fadeAnim }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityLabel={t('Đóng menu')}
              onPress={() => closeMenu()}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.drawerPanel,
              {
                width: drawerWidth,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Drawer Top Header */}
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerHeaderTitle}>{t('Menu')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Đóng menu')}
                onPress={() => closeMenu()}
                style={styles.drawerCloseBtn}
              >
                <Text style={styles.drawerCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Navigation Options */}
            <View style={styles.drawerNavList}>
              {/* Trang chủ */}
              <Pressable
                accessibilityRole="button"
                onPress={goHome}
                style={styles.drawerItem}
              >
                <Text style={styles.drawerItemIcon}>🏠</Text>
                <Text style={styles.drawerItemText}>{t('Trang chủ')}</Text>
              </Pressable>

              {/* Tìm chuyến bay */}
              <Pressable
                accessibilityRole="button"
                onPress={goSearch}
                style={styles.drawerItem}
              >
                <Text style={styles.drawerItemIcon}>🔍</Text>
                <Text style={styles.drawerItemText}>{t('Tìm chuyến bay')}</Text>
              </Pressable>

              <View style={styles.drawerDivider} />

              {/* Chọn ngôn ngữ */}
              <Pressable
                accessibilityRole="button"
                onPress={() => setLangExpanded((v) => !v)}
                style={[styles.drawerItem, styles.drawerItemBetween]}
              >
                <View style={styles.drawerItemLeft}>
                  <Text style={styles.drawerItemIcon}>🌐</Text>
                  <Text style={styles.drawerItemText}>{t('Chọn ngôn ngữ')}</Text>
                </View>
                <Text style={styles.drawerArrow}>{langExpanded ? '▲' : '▼'}</Text>
              </Pressable>

              {/* Expandable Languages: Tiếng Việt and English */}
              {langExpanded && (
                <View style={styles.drawerLangList}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: language === 'vi' }}
                    onPress={() => {
                      void setLanguage('vi');
                    }}
                    style={[
                      styles.drawerLangItem,
                      language === 'vi' && styles.drawerLangItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.drawerLangText,
                        language === 'vi' && styles.drawerLangTextActive,
                      ]}
                    >
                      Tiếng Việt
                    </Text>
                    {language === 'vi' && <Text style={styles.drawerCheck}>✓</Text>}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: language === 'en' }}
                    onPress={() => {
                      void setLanguage('en');
                    }}
                    style={[
                      styles.drawerLangItem,
                      language === 'en' && styles.drawerLangItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.drawerLangText,
                        language === 'en' && styles.drawerLangTextActive,
                      ]}
                    >
                      English
                    </Text>
                    {language === 'en' && <Text style={styles.drawerCheck}>✓</Text>}
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuButtonIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 22,
  },
  drawerOverlay: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerPanel: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: -6, height: 0 },
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  drawerHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  drawerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCloseBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  drawerNavList: {
    gap: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  drawerItemBetween: {
    justifyContent: 'space-between',
  },
  drawerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerItemIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  drawerItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  drawerArrow: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 4,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  drawerLangList: {
    gap: 8,
    marginTop: 4,
    paddingLeft: 8,
  },
  drawerLangItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drawerLangItemActive: {
    backgroundColor: '#E0F7FA',
    borderColor: '#007E91',
  },
  drawerLangText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  drawerLangTextActive: {
    color: '#007E91',
    fontWeight: '700',
  },
  drawerCheck: {
    color: '#007E91',
    fontSize: 15,
    fontWeight: '800',
  },
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
