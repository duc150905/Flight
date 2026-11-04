import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_SELECTION_STORAGE_KEY = 'flyora_pending_checkout_selection';

export async function savePendingSelection(raw: string): Promise<void> {
  try {
    if (raw && raw.trim().length > 0) {
      await AsyncStorage.setItem(PENDING_SELECTION_STORAGE_KEY, raw.trim());
    }
  } catch {
    // Ignore storage errors
  }
}

export async function getPendingSelection(): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(PENDING_SELECTION_STORAGE_KEY);
    return val && val.trim().length > 0 ? val.trim() : null;
  } catch {
    return null;
  }
}

export async function clearPendingSelection(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_SELECTION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

