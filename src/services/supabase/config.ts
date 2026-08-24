const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const SUPABASE_CONFIGURATION_ERROR =
  'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.';
