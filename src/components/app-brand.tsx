import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

/** One shared identity for public discovery and account screens. */
export function AppBrand({ compact = false }: { compact?: boolean }) {
  return <View accessible accessibilityRole="image" accessibilityLabel="Flyora" style={[styles.row, compact && styles.rowCompact]}>
    <Image source={require('../../assets/branding/logo.png')} accessible={false} alt=""
      contentFit="contain" style={[styles.logo, compact && styles.logoCompact]} />
    <Text style={[styles.name, compact && styles.nameCompact]}>Flyora<Text style={styles.dot}>.</Text></Text>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCompact: { gap: 6 },
  logo: { width: 44, height: 44, borderRadius: 11 },
  logoCompact: { width: 28, height: 28, borderRadius: 7 },
  name: { color: '#102A43', fontSize: 28, fontWeight: '900', letterSpacing: 3, flexShrink: 1 },
  nameCompact: { fontSize: 20, letterSpacing: 0.5 },
  dot: { color: '#00B8D0' },
});
