import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { type Database } from '@/types/database';

import { isSupabaseConfigured, supabaseConfig, SUPABASE_CONFIGURATION_ERROR } from './config';

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseConfig.url!, supabaseConfig.publishableKey!, {
      auth: {
        ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      return;
    }
    supabase.auth.stopAutoRefresh();
  });
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(SUPABASE_CONFIGURATION_ERROR);
  }
  return supabase;
}
