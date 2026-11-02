import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStore } from 'zustand';
import { createLanguageStore } from './language';
import { translate } from './translate';

const LanguageContext = createContext<ReturnType<typeof createLanguageStore> | null>(null);
export function LanguageProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createLanguageStore(AsyncStorage, getLocales().map(locale => locale.languageTag)));
  useEffect(() => { void store.getState().hydrate(); }, [store]);
  return <LanguageContext.Provider value={store}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const store = useContext(LanguageContext);
  if (!store) throw new Error('LanguageProvider is required');
  const state = useStore(store);
  return { ...state, t: (message: string, params?: Record<string, string | number>) => translate(state.language, message, params) };
}
export function LanguagePicker({ compact }: { compact?: boolean } = {}) {
  const { language, setLanguage, t, storageError } = useLanguage();
  return <View style={{ gap: 4 }}>
    <View accessibilityLabel={t('common.language')} style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
      {(['vi', 'en'] as const).map(code => <Pressable key={code} accessibilityRole="button"
        accessibilityState={{ selected: language === code }} onPress={() => { void setLanguage(code); }}
        style={{
          minHeight: compact ? 34 : 44,
          minWidth: compact ? 34 : 64,
          paddingHorizontal: compact ? 6 : 8,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 8,
          backgroundColor: language === code ? '#E0F7FA' : '#FFFFFF',
          borderWidth: compact ? 1 : 0,
          borderColor: language === code ? '#0891B2' : '#CBD5E1',
        }}>
        <Text style={{
          color: language === code ? '#0E7490' : '#475569',
          fontWeight: language === code ? '700' : '500',
          fontSize: compact ? 12 : 14,
        }}>
          {compact ? (code === 'vi' ? 'VN' : 'EN') : (code === 'vi' ? 'Tiếng Việt' : 'English')}
        </Text>
      </Pressable>)}
    </View>
    {storageError && <Text accessibilityLiveRegion="polite" style={{ color: '#B42318', fontSize: 12 }}>{t('common.languageStorage')}</Text>}
  </View>;
}
