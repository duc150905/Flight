import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from './provider';

const options = [
  { code: 'vi', label: 'Tiếng Việt', flag: require('../../../assets/flags/vn.svg') },
  { code: 'en', label: 'English', flag: require('../../../assets/flags/gb.svg') },
] as const;

export function FlagLanguagePicker() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.code === language) ?? options[0];

  return <View style={styles.container}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={language === 'vi' ? 'Chọn ngôn ngữ' : 'Choose language'}
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((value) => !value)}
      style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
    >
      <Image source={current.flag} contentFit="contain" style={styles.triggerFlag} accessible={false} alt="" />
      <Text style={styles.chevron} accessible={false}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>

    {open && <View style={styles.menu}>
      {options.map(({ code, label, flag }) => {
        const selected = language === code;
        return <Pressable
          key={code}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected }}
          onPress={() => { setOpen(false); void setLanguage(code); }}
          style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
        >
          <Image source={flag} contentFit="contain" style={styles.optionFlag} accessible={false} alt="" />
          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
          {selected && <Text style={styles.check} accessible={false}>✓</Text>}
        </Pressable>;
      })}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 2 },
  trigger: {
    width: 44, height: 44, borderRadius: 22, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: '#E0F7FA',
  },
  triggerFlag: { width: 18, height: 18 },
  chevron: { color: '#007E91', fontSize: 15, fontWeight: '700', marginTop: -3 },
  pressed: { opacity: 0.65 },
  menu: {
    position: 'absolute', top: 48, right: 0, width: 158, padding: 4,
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
    borderColor: '#DCE6EB', shadowColor: '#102A43', shadowOpacity: 0.14,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  option: {
    minHeight: 44, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row',
    alignItems: 'center', gap: 10,
  },
  optionSelected: { backgroundColor: '#E0F7FA' },
  optionFlag: { width: 18, height: 18 },
  optionText: { flex: 1, color: '#344A5E', fontSize: 14 },
  optionTextSelected: { color: '#007E91', fontWeight: '700' },
  check: { color: '#007E91', fontSize: 14, fontWeight: '700' },
});
