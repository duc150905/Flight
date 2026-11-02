import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

/** One shared identity for public discovery and account screens. */
export function FlightBrand() {
  return <View accessible accessibilityRole="image" accessibilityLabel="Flight" style={styles.row}>
    <Image source={require('../../assets/branding/logo.png')} accessible={false} alt=""
      contentFit="contain" style={styles.logo} />
    <Text style={styles.name}>FLIGHT<Text style={styles.dot}>.</Text></Text>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 11 },
  name: { color: '#102A43', fontSize: 28, fontWeight: '900', letterSpacing: 3, flexShrink: 1 },
  dot: { color: '#00B8D0' },
});
