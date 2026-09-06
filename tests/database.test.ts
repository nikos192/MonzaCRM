import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const approved = '10000000-0000-4000-8000-000000000001',
  unapproved = '10000000-0000-4000-8000-000000000002';
let db: PGlite;
let leadId: string;
let quoteId: string;
let orderId: string;
async function identity(role: string, id?: string) {
  await db.exec(
    `reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id ?? ''}',false);`,
  );
}
async function scalar<T>(sql: string, params: unknown[] = []) {
  return (await db.query<{ value: T }>(sql, params)).rows[0]?.value;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated,service_role;
 grant all on storage.objects to anon,authenticated,service_role;
 `);
  await db.exec(readFileSync('supabase/migrations/202609060001_crm.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202609060002_touchpoint_dials.sql', 'utf8'));
  await db.exec(
    readFileSync('supabase/migrations/202609060003_restore_follow_up_progress.sql', 'utf8'),
  );
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
    approved,
    'nikos@example.com',
    unapproved,
    'outsider@example.com',
  ]);
  await db.query('insert into public.approved_users(user_id) values($1)', [approved]);
});
afterAll(async () => {
  await db?.close();
});
describe('actual PostgreSQL migration, RLS and transactional workflows', () => {
  it('enables RLS on every public table, including internal intake tables', async () => {
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'",
    );
    expect(rows.rows.length).toBeGreaterThan(20);
    expect(rows.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it('denies anonymous CRM reads and storage access', async () => {
    await identity('anon');
    await expect(db.query('select * from public.customers')).rejects.toThrow();
    expect(await scalar<number>('select count(*)::int value from storage.objects')).toBe(0);
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values('crm-files','public-leak')"),
    ).rejects.toThrow();
  });
  it('denies unapproved authenticated users reads, writes and self-approval', async () => {
    await identity('authenticated', unapproved);
    expect(await scalar<number>('select count(*)::int value from public.customers')).toBe(0);
    expect(await scalar<boolean>('select public.is_approved() value')).toBe(false);
    await expect(
      db.query("insert into public.customers(first_name) values('Intruder')"),
    ).rejects.toThrow();
    await expect(
      db.query('insert into public.approved_users(user_id) values($1)', [unapproved]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.activity_logs(entity,entity_id,action) values('leads',gen_random_uuid(),'forged')",
      ),
    ).rejects.toThrow();
  });
  it('allows approved users to create a complete lead transaction and prevents duplicates', async () => {
    await identity('authenticated', approved);
    expect(await scalar<boolean>('select public.is_approved() value')).toBe(true);
    const stage = await scalar<string>(
      'select id value from public.pipeline_stages order by position limit 1',
    );
    const input = {
      first_name: 'Test',
      last_name: 'Customer',
      email: 'test@example.com',
      phone: '0400000001',
      make: 'BMW',
      model: 'M4',
      stage_id: stage,
      handled_by: approved,
    };
    leadId = (await scalar<string>('select public.create_lead($1::jsonb) value', [
      JSON.stringify(input),
    ]))!;
    expect(leadId).toBeTruthy();
    expect(await scalar<number>('select count(*)::int value from public.customers')).toBe(1);
    await db.query('select public.create_lead($1::jsonb)', [
      JSON.stringify({ ...input, email: 'TEST@EXAMPLE.COM', model: 'M3' }),
    ]);
    expect(await scalar<number>('select count(*)::int value from public.customers')).toBe(1);
    expect(await scalar<number>('select count(*)::int value from public.vehicles')).toBe(2);
  });
  it('uses three-step lead touchpoint counters without follow-up pipeline stages', async () => {
    expect(
      await scalar<number>(
        "select count(*)::int value from public.pipeline_stages where name ~* '^Follow[- ]?Up [123]$'",
      ),
    ).toBe(0);
    await db.query('update public.leads set follow_up_step=3,call_step=2 where id=$1', [leadId]);
    expect(
      await scalar<number>('select follow_up_step::int value from public.leads where id=$1', [
        leadId,
      ]),
    ).toBe(3);
    expect(
      await scalar<number>('select call_step::int value from public.leads where id=$1', [leadId]),
    ).toBe(2);
    await expect(
      db.query('update public.leads set call_step=4 where id=$1', [leadId]),
    ).rejects.toThrow();

    await identity('postgres');
    const legacyStage = await scalar<string>(
      "insert into public.pipeline_stages(name,position,colour,is_terminal) values('Legacy Follow-Up 2',92,'#c88a42',true) returning id value",
    );
    const quoteStage = await scalar<string>(
      "select id value from public.pipeline_stages where name='Quote Sent'",
    );
    await db.query(
      'insert into public.lead_stage_history(lead_id,from_stage_id,to_stage_id,actor_id) values($1,$2,$3,$4)',
      [leadId, legacyStage, quoteStage, approved],
    );
    await db.query('update public.leads set follow_up_step=0 where id=$1', [leadId]);
    await db.exec(
      readFileSync('supabase/migrations/202609060003_restore_follow_up_progress.sql', 'utf8'),
    );
    expect(
      await scalar<number>('select follow_up_step::int value from public.leads where id=$1', [
        leadId,
      ]),
    ).toBe(2);
    await identity('authenticated', approved);
  });
  it('rolls back customer and vehicle if lead creation fails', async () => {
    const before = await scalar<number>('select count(*)::int value from public.customers');
    await expect(
      db.query('select public.create_lead($1::jsonb)', [
        JSON.stringify({
          first_name: 'Rollback',
          email: 'rollback@example.com',
          make: 'BMW',
          model: 'M4',
          stage_id: '99999999-0000-4000-8000-000000000001',
        }),
      ]),
    ).rejects.toThrow();
    expect(await scalar<number>('select count(*)::int value from public.customers')).toBe(before);
  });
  it('edits a lead and records stage history with authenticated actor', async () => {
    await db.query(
      "update public.leads set stage_id=(select id from public.pipeline_stages where name='Quote Sent'),notes='Updated' where id=$1",
      [leadId],
    );
    expect(
      await scalar<string>(
        'select actor_id value from public.lead_stage_history where lead_id=$1',
        [leadId],
      ),
    ).toBe(approved);
    expect(await scalar<string>('select notes value from public.leads where id=$1', [leadId])).toBe(
      'Updated',
    );
  });
  it('creates quote revisions that approved users cannot forge or delete', async () => {
    quoteId = (await scalar<string>(
      "insert into public.quotes(lead_id,base_price,deposit_required,status) values($1,6000,3000,'Sent') returning id value",
      [leadId],
    ))!;
    await db.query('update public.quotes set base_price=6400 where id=$1', [quoteId]);
    expect(
      await scalar<number>(
        "select (previous_value->>'base_price')::numeric::int value from public.quote_revisions where quote_id=$1",
        [quoteId],
      ),
    ).toBe(6000);
    await expect(db.query('delete from public.quote_revisions')).rejects.toThrow();
    await expect(
      db.query('update public.activity_logs set actor_id=$1', [unapproved]),
    ).rejects.toThrow();
  });
  it('stamps follow-up authors and completion instead of trusting supplied identities', async () => {
    const id = await scalar<string>(
      "insert into public.follow_ups(lead_id,type,due_at,created_by) values($1,'Quote follow-up',now(),$2) returning id value",
      [leadId, unapproved],
    );
    expect(
      await scalar<string>('select created_by value from public.follow_ups where id=$1', [id]),
    ).toBe(approved);
    await db.query("update public.follow_ups set status='Completed',completed_by=$2 where id=$1", [
      id,
      unapproved,
    ]);
    expect(
      await scalar<string>('select completed_by value from public.follow_ups where id=$1', [id]),
    ).toBe(approved);
  });
  it('converts a deposit to order without losing the lead, and blocks duplicate conversion', async () => {
    orderId = (await scalar<string>('select public.convert_lead($1,3200,$2) value', [
      leadId,
      'TEST-DEP',
    ]))!;
    expect(
      await scalar<number>('select final_price::int value from public.orders where id=$1', [
        orderId,
      ]),
    ).toBe(6400);
    expect(
      await scalar<number>('select count(*)::int value from public.leads where id=$1', [leadId]),
    ).toBe(1);
    expect(
      await scalar<string>('select status value from public.quotes where id=$1', [quoteId]),
    ).toBe('Accepted');
    await expect(
      db.query('select public.convert_lead($1,3200,$2)', [leadId, 'DUP']),
    ).rejects.toThrow();
    expect(
      await scalar<number>('select count(*)::int value from public.payments where order_id=$1', [
        orderId,
      ]),
    ).toBe(1);
  });
  it('enforces payment balances and shipping rules at the database boundary', async () => {
    await expect(
      db.query(
        "insert into public.payments(order_id,type,amount,provider,status) values($1,'Balance',4000,'Manual','Paid')",
        [orderId],
      ),
    ).rejects.toThrow('exceeds');
    await expect(
      db.query("update public.orders set stage='Ready to Ship' where id=$1", [orderId]),
    ).rejects.toThrow('full balance');
    await db.query(
      "insert into public.payments(order_id,type,amount,provider,status) values($1,'Balance',3200,'Manual','Paid')",
      [orderId],
    );
    await db.query("update public.orders set stage='Ready to Ship' where id=$1", [orderId]);
    await expect(
      db.query("update public.orders set stage='Shipped' where id=$1", [orderId]),
    ).rejects.toThrow();
    await db.query(
      "update public.orders set stage='Shipped',tracking_number='TEST123',shipping_provider='DHL',shipped_at=now() where id=$1",
      [orderId],
    );
    expect(
      await scalar<number>(
        'select count(*)::int value from public.order_stage_history where order_id=$1',
        [orderId],
      ),
    ).toBe(2);
    await expect(
      db.query('update public.orders set final_price=100 where id=$1', [orderId]),
    ).rejects.toThrow('cannot change');
  });
  it('keeps storage private and denies unapproved users access to existing files', async () => {
    await identity('postgres');
    expect(
      await scalar<boolean>("select public value from storage.buckets where id='crm-files'"),
    ).toBe(false);
    await identity('authenticated', approved);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('crm-files','test/private.pdf')",
    );
    expect(await scalar<number>('select count(*)::int value from storage.objects')).toBe(1);
    await identity('authenticated', unapproved);
    expect(await scalar<number>('select count(*)::int value from storage.objects')).toBe(0);
    await db.exec("delete from storage.objects where name='test/private.pdf'");
    await identity('authenticated', approved);
    expect(await scalar<number>('select count(*)::int value from storage.objects')).toBe(1);
  });
  it('revocation immediately removes CRM and file visibility', async () => {
    await identity('postgres');
    await db.query('delete from public.approved_users where user_id=$1', [approved]);
    await identity('authenticated', approved);
    expect(await scalar<number>('select count(*)::int value from public.leads')).toBe(0);
    expect(await scalar<number>('select count(*)::int value from storage.objects')).toBe(0);
    await identity('postgres');
    await db.query('insert into public.approved_users(user_id) values($1)', [approved]);
  });
  it('restricts rate-limit RPCs to service role and enforces cross-request limits', async () => {
    await identity('authenticated', approved);
    await expect(db.query("select public.take_rate_limit('test',2,60)")).rejects.toThrow();
    await identity('service_role');
    expect(await scalar<boolean>("select public.take_rate_limit('test',2,60) value")).toBe(true);
    expect(await scalar<boolean>("select public.take_rate_limit('test',2,60) value")).toBe(true);
    expect(await scalar<boolean>("select public.take_rate_limit('test',2,60) value")).toBe(false);
  });
  it('makes public intake transactional and idempotent', async () => {
    const payload = JSON.stringify({
      first_name: 'Website',
      email: 'web@example.com',
      make: 'Toyota',
      model: 'Supra',
    });
    const id = '30000000-0000-4000-8000-000000000001';
    const first = await scalar<string>('select public.intake_lead($1::jsonb,$2::uuid) value', [
      payload,
      id,
    ]);
    const second = await scalar<string>('select public.intake_lead($1::jsonb,$2::uuid) value', [
      payload,
      id,
    ]);
    expect(first).toBe(second);
    expect(await scalar<number>('select count(*)::int value from public.intake_requests')).toBe(1);
  });
});
