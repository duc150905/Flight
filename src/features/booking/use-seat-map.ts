import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../lib/supabase';
import { loadSeatMap } from './seats-data';
export function useSeatMap(flightId?: string) {
  const query = useQuery({ queryKey: ['checkout-seat-map', flightId], enabled: !!flightId, staleTime: 0, gcTime: 60_000,
    queryFn: () => { if (!supabase || !flightId) throw new Error('seats.loadError'); return loadSeatMap(supabase, flightId); } });
  const refetch = query.refetch;
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && flightId) void refetch(); });
    return () => listener.remove();
  }, [refetch, flightId]);
  return query;
}
