import { NextResponse } from 'next/server';
import { requireApproved } from '@/lib/supabase/server';
import { loadData } from '@/lib/data';
import { validateMutation } from '@/lib/validation';
import { apiError, readJson, sameOrigin } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json(await loadData(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const { db } = await requireApproved();
    const m = validateMutation(await readJson(request));
    let result;
    if (m.action === 'create_lead') result = await db.rpc('create_lead', { payload: m.values });
    else if (m.action === 'convert')
      result = await db.rpc('convert_lead', {
        p_lead_id: m.lead_id,
        p_amount: m.amount,
        p_reference: m.reference,
      });
    else if (m.action === 'archive')
      result = await db
        .from(m.table)
        .update({ archived_at: new Date().toISOString() })
        .eq('id', m.id)
        .select('id')
        .single();
    else {
      if (['leads', 'orders'].includes(m.table) && !m.id)
        return NextResponse.json(
          { error: 'Use lead creation or deposit conversion.' },
          { status: 400 },
        );
      result = m.id
        ? await db.from(m.table).update(m.values).eq('id', m.id).select('id').single()
        : await db
            .from(m.table)
            .insert(m.values as Record<string, unknown>)
            .select('id')
            .single();
    }
    if (result.error) {
      const code = result.error.code;
      if (['23505', '23514', '23503', 'P0001'].includes(code ?? ''))
        return NextResponse.json(
          {
            error:
              code === '23505'
                ? 'This record already exists. Refresh before trying again.'
                : code === 'P0001'
                  ? result.error.message
                  : 'The change conflicts with an existing record or business rule.',
          },
          { status: 409 },
        );
      throw result.error;
    }
    return NextResponse.json({ data: result.data });
  } catch (e) {
    return apiError(e);
  }
}
