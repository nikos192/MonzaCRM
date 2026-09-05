export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { supabaseEnv } = await import('./lib/env');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url || key) supabaseEnv();
    if (process.env.LEAD_INTAKE_SECRET && process.env.LEAD_INTAKE_SECRET.length < 32)
      throw new Error('LEAD_INTAKE_SECRET must contain at least 32 characters.');
  }
}
