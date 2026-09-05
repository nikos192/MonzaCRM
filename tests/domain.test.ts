import { describe, it, expect } from 'vitest';
import { makeDemo, applyDemoMutation, demoId } from '../src/lib/demo';
import { validateMutation, intakeInput } from '../src/lib/validation';
import { analytics, dayKey } from '../src/lib/analytics';
import { orderPaid, quoteTotal } from '../src/lib/types';
describe('CRM business workflow', () => {
  it('creates a lead, matching contact details without overwriting a customer', () => {
    const data = makeDemo(),
      c = data.customers[0];
    const values = {
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email.toUpperCase(),
      phone: '',
      instagram: '',
      location: '',
      preferred_contact: 'Email',
      notes: 'Second enquiry',
      make: 'BMW',
      model: 'M3',
      year: '2025',
      chassis: 'G80',
      source: 'Website',
      priority: 'Normal',
      handled_by: demoId(1),
      stage_id: demoId(100),
    };
    const m = validateMutation({ action: 'create_lead', values });
    const next = applyDemoMutation(data, m, demoId(1));
    expect(next.customers).toHaveLength(data.customers.length);
    expect(next.leads).toHaveLength(data.leads.length + 1);
    expect(next.vehicles).toHaveLength(data.vehicles.length + 1);
    expect(next.customers[0].notes).toBe(c.notes);
  });
  it('edits leads and audits who moved their stage', () => {
    const d = makeDemo();
    const n = applyDemoMutation(
      d,
      {
        action: 'save',
        table: 'leads',
        id: d.leads[0].id,
        values: { stage_id: demoId(104), notes: 'Follow up shortly' },
      },
      demoId(2),
    );
    expect(n.leads[0].stage_id).toBe(demoId(104));
    expect(d.leads[0].stage_id).toBe(demoId(103));
    expect(n.activity_logs[0].actor_id).toBe(demoId(2));
    expect(n.activity_logs[0].metadata.before).toMatchObject({ stage_id: demoId(103) });
  });
  it('keeps quote revisions and converts a deposit into a linked order', () => {
    const d = makeDemo(),
      q = d.quotes[0];
    const { id, created_at, ...values } = q;
    void created_at;
    const n = applyDemoMutation(
      d,
      { action: 'save', table: 'quotes', id, values: { ...values, base_price: 7000 } },
      demoId(1),
    );
    expect(n.quote_revisions[0].previous_value.base_price).toBe(6800);
    const converted = applyDemoMutation(
      n,
      { action: 'convert', lead_id: q.lead_id, amount: 3500, reference: 'TEST-DEP' },
      demoId(2),
    );
    const order = converted.orders.find((o) => o.lead_id === q.lead_id)!;
    expect(order.final_price).toBe(7000);
    expect(orderPaid(converted, order.id)).toBe(3500);
    expect(converted.leads).toHaveLength(d.leads.length);
    expect(converted.quotes.find((x) => x.id === q.id)?.status).toBe('Accepted');
    expect(() =>
      applyDemoMutation(
        converted,
        { action: 'convert', lead_id: q.lead_id, amount: 3500, reference: '' },
        demoId(1),
      ),
    ).toThrow('already has an order');
  });
  it('creates and completes a follow-up with completion identity', () => {
    const d = makeDemo();
    const n = applyDemoMutation(
      d,
      {
        action: 'save',
        table: 'follow_ups',
        values: {
          lead_id: d.leads[0].id,
          type: 'Quote follow-up',
          due_at: new Date().toISOString(),
          notes: 'Check fitment',
          status: 'Open',
        },
      },
      demoId(1),
    );
    const f = n.follow_ups[0];
    expect(f.created_by).toBe(demoId(1));
    const completed = applyDemoMutation(
      n,
      { action: 'save', table: 'follow_ups', id: f.id, values: { ...f, status: 'Completed' } },
      demoId(2),
    );
    expect(completed.follow_ups[0].completed_by).toBe(demoId(2));
    expect(completed.follow_ups[0].completed_at).toBeTruthy();
  });
  it('rejects overpayments and refunds beyond paid amount', () => {
    const d = makeDemo(),
      o = d.orders[0];
    const payment = {
      order_id: o.id,
      type: 'Balance',
      amount: o.final_price,
      paid_at: new Date().toISOString(),
      provider: 'Bank transfer',
      reference: 'TEST',
      status: 'Paid',
      notes: '',
    };
    expect(() =>
      applyDemoMutation(d, { action: 'save', table: 'payments', values: payment }, demoId(1)),
    ).toThrow('exceeds');
    expect(() =>
      applyDemoMutation(
        d,
        { action: 'save', table: 'payments', values: { ...payment, type: 'Refund' } },
        demoId(1),
      ),
    ).toThrow('exceeds');
  });
  it('calculates analytics from the records and Brisbane calendar dates', () => {
    const d = makeDemo();
    expect(analytics(d).openValue).toBe(
      d.quotes
        .filter((q) => ['Sent', 'Negotiating'].includes(q.status))
        .reduce((s, q) => s + quoteTotal(q), 0),
    );
    expect(dayKey('2026-09-05T16:00:00Z')).toBe('2026-09-06');
  });
});
describe('untrusted input validation', () => {
  it('rejects arbitrary tables, privileged fields and actor spoofing', () => {
    expect(() =>
      validateMutation({ action: 'save', table: 'approved_users', values: { user_id: demoId(1) } }),
    ).toThrow();
    expect(() =>
      validateMutation({
        action: 'save',
        table: 'leads',
        id: demoId(400),
        values: { customer_id: demoId(201) },
      }),
    ).toThrow();
    expect(() =>
      validateMutation({
        action: 'save',
        table: 'messages',
        values: {
          lead_id: demoId(400),
          direction: 'Outgoing',
          channel: 'Email',
          content: 'Hi',
          status: 'Logged',
          staff_user: demoId(2),
        },
      }),
    ).toThrow();
  });
  it('validates intake contact data, idempotency key and honeypot', () => {
    const valid = {
      first_name: 'Example',
      email: 'fake@example.com',
      make: 'BMW',
      model: 'M4',
      request_id: demoId(400),
    };
    expect(intakeInput.parse(valid).website).toBe('');
    expect(() => intakeInput.parse({ ...valid, email: 'invalid' })).toThrow();
    expect(() => intakeInput.parse({ ...valid, website: 'spam' })).toThrow();
    expect(() => intakeInput.parse({ ...valid, request_id: undefined })).toThrow();
    expect(() => intakeInput.parse({ ...valid, notes: 'a'.repeat(4001) })).toThrow();
  });
  it('rejects invalid quote totals and non-finite amounts', () => {
    const q = makeDemo().quotes[0];
    const { id, created_at, ...values } = q;
    void created_at;
    expect(() =>
      validateMutation({
        action: 'save',
        table: 'quotes',
        id,
        values: { ...values, discount: 999999 },
      }),
    ).toThrow();
    expect(() =>
      validateMutation({ action: 'convert', lead_id: q.lead_id, amount: NaN, reference: '' }),
    ).toThrow();
  });
});
