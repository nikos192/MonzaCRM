import { NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { intakeInput } from '@/lib/validation';
import { readJson, apiError } from '@/lib/http';
import { supabaseEnv } from '@/lib/env';
export async function POST(request: Request) {
  const secret = process.env.LEAD_INTAKE_SECRET,
    service = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32 || !service)
    return NextResponse.json({ error: 'Lead intake is not configured.' }, { status: 503 });
  const presented = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const hash = (v: string) => createHash('sha256').update(v).digest();
  if (!timingSafeEqual(hash(secret), hash(presented)))
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const db = createClient(supabaseEnv().url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowed, error: rateError } = await db.rpc('take_rate_limit', {
      p_key: 'website-intake',
      p_limit: 30,
      p_seconds: 60,
    });
    if (rateError) throw rateError;
    if (!allowed)
      return NextResponse.json(
        { error: 'Too many enquiries. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    const body = intakeInput.parse(await readJson(request, 12000));
    const { request_id, website: honeypot, ...payload } = body;
    void honeypot;
    const { data, error } = await db.rpc('intake_lead', { payload, p_request_id: request_id });
    if (error) throw error;
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
