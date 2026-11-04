import AsyncStorage from '@react-native-async-storage/async-storage';

export const LAST_SEARCH_STORAGE_KEY = 'flyora_last_flight_search';

export type LastSearchInput =
  | {
      type: 'one_way';
      params: Record<string, any>;
      label?: string;
    }
  | {
      type: 'itinerary';
      searchJson: string;
      label?: string;
    };

export type LastSearchData = LastSearchInput & {
  timestamp: number;
};

export async function saveLastSearch(data: LastSearchInput): Promise<void> {
  try {
    const payload: LastSearchData = {
      ...data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export async function getLastSearch(): Promise<LastSearchData | null> {
  try {
    const val = await AsyncStorage.getItem(LAST_SEARCH_STORAGE_KEY);
    if (!val) return null;
    const parsed = JSON.parse(val) as LastSearchData;
    // Expire after 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      await clearLastSearch();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLastSearch(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_SEARCH_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
