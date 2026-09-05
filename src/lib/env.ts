import 'server-only';
import { z } from 'zod';
const schema = z.object({ url: z.url(), key: z.string().min(20) });
export function supabaseEnv() {
  return schema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
export function demoEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.ENABLE_DEMO === 'true';
}
