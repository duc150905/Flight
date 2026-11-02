import { useLocalSearchParams } from 'expo-router';
import { SeatMapScreen } from '@/features/booking/seat-map-screen';
export default function SeatMapRoute() {
  const { flightId } = useLocalSearchParams<{ flightId?: string }>();
  return <SeatMapScreen flightId={typeof flightId === 'string' ? flightId : undefined} />;
}
