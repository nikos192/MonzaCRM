import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loginInput } from '@/lib/validation';
import { apiError, readJson, sameOrigin } from '@/lib/http';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const body = loginInput.parse(await readJson(request));
    const db = await createClient();
    const { data, error } = await db.auth.signInWithPassword(body);
    if (error || !data.user)
      return NextResponse.json(
        { error: 'Unable to sign in. Check your credentials or try again later.' },
        { status: 401 },
      );
    const { data: approved } = await db
      .from('approved_users')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (!approved) {
      await db.auth.signOut();
      return NextResponse.json(
        { error: 'This account is not approved for Monza CRM.' },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
