import { useLocalSearchParams } from 'expo-router';
import { DetailScreen } from '@/features/discovery/detail-screen';

export default function FlightDetail() {
  const input = useLocalSearchParams();
  return <DetailScreen input={input} />;
}
