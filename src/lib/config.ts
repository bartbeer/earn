// Single place that reads environment configuration. Nothing else in the app
// should read `process.env` directly — this keeps environment/URL handling in
// one spot so local vs. hosted Supabase is purely a config change, never a
// code change (see AGENTS.md / master spec section 36-37).
//
// Each EXPO_PUBLIC_* variable must be accessed as a literal `process.env.X`
// expression (not a dynamic lookup) because Expo's bundler statically inlines
// these at build time; a dynamic `process.env[name]` would be undefined in
// production builds.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const config = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
};
