// Single Supabase client for the whole app. Nothing else should call
// createClient() — this keeps session storage and auth options consistent,
// and matches the "local vs hosted is a config change, not a code change"
// principle from config.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

import { config } from '@/lib/config';

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no browser URL to parse a session out of.
    detectSessionInUrl: false,
  },
});

// Supabase's token auto-refresh timer only ticks while something calls
// startAutoRefresh()/stopAutoRefresh() around app foreground/background —
// without this, a session can silently fail to refresh while the app is
// backgrounded on a phone.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
