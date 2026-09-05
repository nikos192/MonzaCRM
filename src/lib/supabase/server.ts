import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv, isConfigured } from '../env';
export async function createClient() {
  const store = await cookies();
  const env = supabaseEnv();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server component cookies refreshed by proxy. */
        }
      },
    },
  });
}
export async function requireApproved() {
  if (!isConfigured()) throw new Error('UNAUTHENTICATED');
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error('UNAUTHENTICATED');
  const { data: approved } = await db
    .from('approved_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!approved) throw new Error('UNAPPROVED');
  return { db, user };
}
