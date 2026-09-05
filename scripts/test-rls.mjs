import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
try {
  process.loadEnvFile('.env.local');
} catch {
  /* Shell environment is supported. */
}
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: legacyAnonKey,
  TEST_APPROVED_EMAIL,
  TEST_APPROVED_PASSWORD,
  TEST_UNAPPROVED_EMAIL,
  TEST_UNAPPROVED_PASSWORD,
} = process.env;
const key = publishableKey ?? legacyAnonKey;
if (
  !url ||
  !key ||
  !TEST_APPROVED_EMAIL ||
  !TEST_APPROVED_PASSWORD ||
  !TEST_UNAPPROVED_EMAIL ||
  !TEST_UNAPPROVED_PASSWORD
)
  throw new Error(
    'Set Supabase URL/publishable key and TEST_APPROVED_EMAIL/PASSWORD, TEST_UNAPPROVED_EMAIL/PASSWORD for a dedicated test project. See SECURITY.md.',
  );
const client = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = client(),
  approved = client(),
  unapproved = client();
for (const [db, email, password] of [
  [approved, TEST_APPROVED_EMAIL, TEST_APPROVED_PASSWORD],
  [unapproved, TEST_UNAPPROVED_EMAIL, TEST_UNAPPROVED_PASSWORD],
]) {
  const { error } = await db.auth.signInWithPassword({ email, password });
  assert.equal(error, null, 'Test account login failed');
}
const tables = [
  'customers',
  'leads',
  'vehicles',
  'messages',
  'quotes',
  'quote_revisions',
  'wheel_specs',
  'follow_ups',
  'orders',
  'payments',
  'attachments',
  'suppliers',
  'activity_logs',
  'profiles',
  'settings',
  'pipeline_stages',
  'lead_stage_history',
  'order_stage_history',
];
for (const table of tables) {
  for (const [name, db] of [
    ['anonymous', anon],
    ['unapproved', unapproved],
  ]) {
    const { data } = await db.from(table).select('*').limit(1);
    assert.ok(!data?.length, `${name} can read ${table}`);
  }
  const { error } = await approved.from(table).select('id').limit(1);
  assert.equal(error, null, `Approved user cannot read ${table}`);
}
for (const db of [anon, unapproved]) {
  const { error } = await db
    .from('customers')
    .insert({ first_name: 'RLS PROBE — SHOULD NOT EXIST' });
  assert.ok(error, 'Unauthorized customer insertion succeeded');
}
const path = `security-probes/${crypto.randomUUID()}.pdf`;
const bytes = new TextEncoder().encode('%PDF-1.4\n% private access probe\n');
try {
  const { error } = await approved.storage
    .from('crm-files')
    .upload(path, bytes, { contentType: 'application/pdf' });
  assert.equal(error, null, 'Approved storage upload failed');
  for (const db of [anon, unapproved]) {
    const { data, error } = await db.storage.from('crm-files').createSignedUrl(path, 60);
    assert.ok(error || !data?.signedUrl, 'Unauthorized signed URL creation succeeded');
    const download = await db.storage.from('crm-files').download(path);
    assert.ok(download.error, 'Unauthorized private file download succeeded');
  }
  const { data, error } = await approved.storage.from('crm-files').createSignedUrl(path, 60);
  assert.equal(error, null);
  assert.ok(data.signedUrl);
  const publicUrl = approved.storage.from('crm-files').getPublicUrl(path).data.publicUrl;
  const response = await fetch(publicUrl);
  assert.ok(!response.ok, 'Storage bucket exposes public files');
  console.log(
    'Hosted RLS checks passed: approved access, anonymous/unapproved denial, private storage and signed URLs.',
  );
} finally {
  await approved.storage.from('crm-files').remove([path]);
  await approved.auth.signOut();
  await unapproved.auth.signOut();
}
