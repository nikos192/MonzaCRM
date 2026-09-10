import { NextResponse } from 'next/server';
import type { Activity } from '@/lib/types';
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
    else if (m.action === 'delete_lead') {
      const { data: attachments, error: attachmentError } = await db
        .from('attachments')
        .select('storage_path')
        .eq('lead_id', m.id);
      if (attachmentError) throw attachmentError;
      const paths = (attachments ?? []).map((attachment) => attachment.storage_path);
      if (paths.length) {
        const { error: storageError } = await db.storage.from('crm-files').remove(paths);
        if (storageError) throw storageError;
      }
      result = await db.rpc('delete_lead', { p_lead_id: m.id });
    } else {
      if (['leads', 'orders'].includes(m.table) && !m.id)
        return NextResponse.json(
          { error: 'Use lead creation or deposit conversion.' },
          { status: 400 },
        );
      result = m.id
        ? await db
            .from(m.table)
            .update(m.values)
            .eq('id', m.id)
            .select(m.table === 'leads' ? '*' : 'id')
            .single()
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
    // A lead edit only changes that lead and its audit trail. Avoid reloading every CRM table.
    if (m.action === 'save' && m.table === 'leads' && m.id) {
      const activity: Activity[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: page, error } = await db
          .from('activity_logs')
          .select('*')
          .eq('entity', 'leads')
          .eq('entity_id', m.id)
          .order('id')
          .range(offset, offset + 999);
        // The write has already succeeded. Let the client fall back to its full refresh.
        if (error) return NextResponse.json({ data: result.data });
        activity.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
      return NextResponse.json({
        data: result.data,
        leadPatch: { lead: result.data, activity_logs: activity },
      });
    }
    return NextResponse.json({ data: result.data });
  } catch (e) {
    return apiError(e);
  }
}
