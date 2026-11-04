import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../i18n/provider';

export function AiFab({ onPress }: { onPress: () => void }) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isEn ? 'Find flights with AI Assistant' : 'Tìm chuyến bay bằng Trợ lý AI'}
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.icon}>✨</Text>
        <Text style={styles.label}>{isEn ? 'AI Search' : 'Tìm bằng AI'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 999,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007E91',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#00414B',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#7FE3EE',
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#006574',
  },
  icon: {
    fontSize: 18,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

