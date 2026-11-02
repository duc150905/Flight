import { useLocalSearchParams } from 'expo-router';

import { ItineraryResultsScreen } from '@/features/discovery/itinerary-results-screen';

export default function ItineraryResultsRoute() {
  const { search } = useLocalSearchParams<{ search: string }>();
  return <ItineraryResultsScreen key={typeof search === 'string' ? search : ''} rawSearch={search} />;
}
