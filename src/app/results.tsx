import { useLocalSearchParams } from 'expo-router';
import { ResultsScreen } from '@/features/discovery/results-screen';

export default function Results() {
  const input = useLocalSearchParams();
  return <ResultsScreen input={input} />;
}
