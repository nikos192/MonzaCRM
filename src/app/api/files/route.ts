import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApproved } from '@/lib/supabase/server';
import { apiError, sameOrigin } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const { db } = await requireApproved();
    const id = z.uuid().parse(new URL(request.url).searchParams.get('id'));
    const { data: file, error } = await db
      .from('attachments')
      .select('storage_path')
      .eq('id', id)
      .single();
    if (error || !file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    const { data, error: signedError } = await db.storage
      .from('crm-files')
      .createSignedUrl(file.storage_path, 60, { download: true });
    if (signedError) throw signedError;
    return NextResponse.json({ url: data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const { db, user } = await requireApproved();
    if (Number(request.headers.get('content-length')) > 4400000)
      return NextResponse.json({ error: 'Maximum file size is 4 MB.' }, { status: 413 });
    const form = await request.formData();
    const leadId = z.uuid().parse(form.get('lead_id'));
    const category = z.string().min(1).max(100).parse(form.get('category'));
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 4194304 ||
      !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)
    )
      return NextResponse.json(
        { error: 'Choose a JPG, PNG, WebP or PDF under 4 MB.' },
        { status: 400 },
      );
    const { data: lead } = await db
      .from('leads')
      .select('id,customer_id')
      .eq('id', leadId)
      .is('archived_at', null)
      .single();
    if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === 'application/pdf'
        ? String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
        : file.type === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216
          : file.type === 'image/png'
            ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
            : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
              String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (!valid)
      return NextResponse.json(
        { error: 'The file contents do not match its type.' },
        { status: 400 },
      );
    const filename = file.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
    const path = `${leadId}/${crypto.randomUUID()}/${filename}`;
    const { error: uploadError } = await db.storage
      .from('crm-files')
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: order } = await db
      .from('orders')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();
    const { error } = await db.from('attachments').insert({
      lead_id: leadId,
      customer_id: lead.customer_id,
      order_id: order?.id ?? null,
      filename,
      category,
      storage_path: path,
      uploaded_by: user.id,
      mime_type: file.type,
      size: file.size,
    });
    if (error) {
      await db.storage.from('crm-files').remove([path]);
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const { db } = await requireApproved();
    const id = z.uuid().parse(new URL(request.url).searchParams.get('id'));
    const { data: file, error } = await db
      .from('attachments')
      .select('storage_path')
      .eq('id', id)
      .single();
    if (error || !file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    const { error: storageError } = await db.storage.from('crm-files').remove([file.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await db.from('attachments').delete().eq('id', id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
