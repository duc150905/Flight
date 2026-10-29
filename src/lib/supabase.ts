import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined';
const isNative = Platform.OS !== 'web';

export const supabase = url?.startsWith('https://') && key?.startsWith('sb_publishable_')
  ? createClient(url, key, {
      auth: {
        ...(isNative ? { storage: AsyncStorage, lock: processLock } : {}),
        autoRefreshToken: isNative || isBrowser,
        persistSession: isNative || isBrowser,
        detectSessionInUrl: false,
      },
    })
  : null;
