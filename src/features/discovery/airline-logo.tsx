import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { isHttpsMediaPath } from './media-paths';

/** Remote logos may fail or be legacy seed references: always retain an initial fallback. */
export function AirlineLogo({ name, logoPath }: { name: string; logoPath: string | null }) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const showImage = isHttpsMediaPath(logoPath) && failedPath !== logoPath;
  return <View style={styles.mark}>
    {showImage ? <Image source={{ uri: logoPath! }} contentFit="contain" style={styles.image}
      accessibilityLabel={name} onError={() => setFailedPath(logoPath)} cachePolicy="memory-disk" />
      : <Text style={styles.initial}>{name.trim().charAt(0)}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  mark: { width: 36, height: 36, borderRadius: 7, backgroundColor: '#D4F0F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: 32, height: 32 },
  initial: { color: '#007E91', fontSize: 19, fontWeight: '800' },
});
