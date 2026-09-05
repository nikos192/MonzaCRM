import { createClient } from '@supabase/supabase-js';
try {
  process.loadEnvFile('.env.local');
} catch {
  /* Environment may be supplied by shell. */
}
if (process.env.ALLOW_DEVELOPMENT_SEED !== 'true')
  throw new Error('Set ALLOW_DEVELOPMENT_SEED=true only for an empty development project.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase URL and server-only secret key are required.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const check = async (result) => {
  if (result.error)
    throw new Error(
      `Seed operation failed (${result.error.code ?? 'storage'}). No credentials were logged.`,
    );
  return result.data;
};
const { count, error } = await db.from('customers').select('id', { count: 'exact', head: true });
if (error) throw new Error('Apply the database migration before seeding.');
if (count)
  throw new Error('Refusing to seed a non-empty database. Use a separate development project.');
const stages = await check(await db.from('pipeline_stages').select('*'));
const supplier = await check(
  await db
    .from('suppliers')
    .insert({
      name: 'Example Forged Manufacturing',
      contact: 'Demo production team',
      email: 'supplier@example.com',
      production_days: 35,
      notes: 'Fictional development supplier',
    })
    .select('id')
    .single(),
);
const people = [
  ['Oliver', 'Bennett', 'BMW', 'M4', 'G82', '2024', 'Instagram', 'Quote Sent', 6800],
  ['Daniel', 'Brooks', 'BMW', 'M2 Competition', 'F87', '2020', 'Instagram', 'Replied', 6200],
  ['Liam', 'Parker', 'BMW', 'M4', 'F82', '2018', 'Referral', 'Deposit Paid', 6100],
  ['James', 'Mitchell', 'Nissan', 'Silvia', 'S15', '2001', 'Website', 'New Lead', 0],
  ['Lucas', 'Hayes', 'Mazda', 'RX-7', 'FD', '1997', 'Instagram', 'Contacted', 5400],
  ['Ethan', 'Walker', 'Mercedes-AMG', 'C63', 'W205', '2019', 'Facebook', 'Balance Due', 7600],
  ['Sophie', 'Turner', 'Toyota', 'Supra', 'A90', '2022', 'Website', 'Quote Sent', 5900],
  ['Noah', 'Reed', 'Audi', 'RS3', '8Y', '2024', 'Website', 'New Lead', 0],
  ['Alex', 'Chen', 'Porsche', '911 GT3', '992', '2023', 'Referral', 'In Production', 9400],
];
for (const [i, p] of people.entries()) {
  const [first_name, last_name, make, model, chassis, year, source, stage, price] = p;
  const payload = {
    first_name,
    last_name,
    email: `${first_name.toLowerCase()}.demo@example.com`,
    phone: `+61 400 000 ${String(i + 1).padStart(3, '0')}`,
    instagram: `demo_${first_name.toLowerCase()}`,
    location: 'Brisbane, QLD',
    preferred_contact: 'Email',
    notes: 'Fictional seed customer. Do not contact.',
    make,
    model,
    chassis,
    year,
    source,
    priority: i === 0 ? 'High' : 'Normal',
    stage_id: stages.find((s) => s.name === stage)?.id,
  };
  const leadId = await check(await db.rpc('create_lead', { payload }));
  await check(
    await db.from('wheel_specs').insert({
      lead_id: leadId,
      design: i % 2 ? 'MZ-07' : 'MZ-01',
      construction: 'One-piece',
      diameter: '20',
      front_width: '9.5',
      rear_width: '10.5',
      front_offset: '+22',
      rear_offset: '+35',
      pcd: '5×112',
      centre_bore: '66.6',
      finish: 'Satin brushed titanium',
      fitment_notes: 'Confirm brake clearance before production.',
    }),
  );
  const ordered = ['Deposit Paid', 'In Production', 'Balance Due'].includes(stage);
  if (price)
    await check(
      await db.from('quotes').insert({
        lead_id: leadId,
        base_price: price,
        deposit_required: price / 2,
        shipping_included: true,
        status: ordered ? 'Accepted' : 'Sent',
        notes: 'Set of four forged wheels. Tyres excluded.',
      }),
    );
  await check(
    await db.from('messages').insert({
      lead_id: leadId,
      direction: 'Incoming',
      channel: source === 'Referral' ? 'Email' : source,
      content: `Hello! Could you help with a forged wheel setup for my ${chassis} ${model}?`,
      status: 'Received',
    }),
  );
  await check(
    await db.from('follow_ups').insert({
      lead_id: leadId,
      type: ordered ? 'Render approval' : 'First outreach',
      due_at: new Date(Date.now() + ((i % 3) - 1) * 86400000).toISOString(),
      notes: 'Development reminder only.',
    }),
  );
  if (ordered) {
    const order = await check(
      await db
        .from('orders')
        .insert({
          lead_id: leadId,
          final_price: price,
          supplier_id: supplier.id,
          supplier_reference: `DEMO-${i + 100}`,
          estimated_completion: new Date(Date.now() + 14 * 86400000).toISOString(),
        })
        .select('id')
        .single(),
    );
    await check(
      await db.from('payments').insert({
        order_id: order.id,
        type: 'Deposit',
        amount: price / 2,
        provider: 'Development record',
        status: 'Paid',
        reference: `DEMO-DEP-${i}`,
      }),
    );
    await check(
      await db
        .from('orders')
        .update({ stage: stage === 'Deposit Paid' ? 'Awaiting Render' : stage })
        .eq('id', order.id),
    );
  }
}
console.log(
  'Development seed complete: 9 fictional customers, vehicles and enquiries with quotes, conversations, follow-ups and orders.',
);
