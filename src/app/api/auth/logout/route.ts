import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sameOrigin, apiError } from '@/lib/http';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const db = await createClient();
    await db.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
