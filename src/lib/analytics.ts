import { type Data, fullName, vehicleName, quoteTotal, orderPaid } from './types';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Brisbane',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const dayKey = (date: Date | string) => dayFormatter.format(new Date(date));
export function analytics(data: Data, now = new Date()) {
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const leads = data.leads.filter((l) => !l.archived_at);
  const orders = data.orders.filter((o) => !o.archived_at);
  const activeIds = new Set(leads.map((l) => l.id));
  const follows = data.follow_ups.filter((f) => activeIds.has(f.lead_id) && f.status === 'Open');
  const quotes = data.quotes.filter(
    (q) => activeIds.has(q.lead_id) && ['Sent', 'Negotiating'].includes(q.status),
  );
  const payments = data.payments.filter(
    (p) =>
      p.status === 'Paid' &&
      dayKey(p.paid_at).startsWith(month) &&
      new Date(p.paid_at).getTime() <= now.getTime(),
  );
  const due = follows.filter((f) => dayKey(f.due_at) === today);
  const overdue = follows.filter((f) => dayKey(f.due_at) < today);
  const stage = (id: string) => data.pipeline_stages.find((s) => s.id === id)?.name;
  const newLeads = leads.filter((l) => stage(l.stage_id) === 'New Lead');
  const revenue = payments.reduce(
    (s, p) => s + (p.type === 'Refund' ? -Number(p.amount) : Number(p.amount)),
    0,
  );
  const deposits = payments
    .filter((p) => p.type === 'Deposit')
    .reduce((s, p) => s + Number(p.amount), 0);
  const attention: {
    leadId: string;
    name: string;
    vehicle: string;
    reason: string;
    tone: string;
    action: string;
    tab: string;
  }[] = [];
  leads.forEach((l) => {
    const c = data.customers.find((c) => c.id === l.customer_id),
      v = data.vehicles.find((v) => v.id === l.vehicle_id),
      q = data.quotes.find((q) => q.lead_id === l.id),
      o = orders.find((o) => o.lead_id === l.id);
    let reason = '',
      tone = 'amber',
      action = 'View lead',
      tab = 'Overview';
    if (overdue.some((f) => f.lead_id === l.id)) {
      reason = 'Follow-up overdue';
      tone = 'red';
      action = 'Follow up';
      tab = 'Follow-Ups';
    } else if (stage(l.stage_id) === 'New Lead') {
      reason = 'New enquiry';
      action = 'Open lead';
    } else if (o?.stage === 'Balance Due' && orderPaid(data, o.id) < o.final_price) {
      reason = 'Balance outstanding';
      action = 'View order';
      tab = 'Order';
    } else if (o?.stage === 'Render Sent') {
      reason = 'Render awaiting approval';
      action = 'View order';
      tab = 'Order';
    } else if (
      o?.estimated_completion &&
      new Date(o.estimated_completion).getTime() - now.getTime() < 3 * 86400000 &&
      o.stage === 'In Production'
    ) {
      reason = 'Production due soon';
      action = 'View order';
      tab = 'Order';
    } else if (o?.stage === 'Ready to Ship' && !o.tracking_number) {
      reason = 'Tracking number needed';
      action = 'Add tracking';
      tab = 'Order';
    } else if (
      q?.status === 'Sent' &&
      now.getTime() - new Date(q.quote_date).getTime() > 3 * 86400000
    ) {
      reason = 'Quote awaiting reply';
      action = 'Follow up';
      tab = 'Follow-Ups';
    }
    if (reason)
      attention.push({
        leadId: l.id,
        name: fullName(c),
        vehicle: vehicleName(v),
        reason,
        tone,
        action,
        tab,
      });
  });
  return {
    leads,
    orders,
    follows,
    quotes,
    newLeads,
    due,
    overdue,
    revenue,
    deposits,
    attention,
    openValue: quotes.reduce((s, q) => s + quoteTotal(q), 0),
    production: orders.filter((o) => o.stage === 'In Production'),
    balance: orders.filter((o) => o.stage === 'Balance Due'),
    ready: orders.filter((o) => o.stage === 'Ready to Ship'),
    shipped: orders.filter((o) => o.stage === 'Shipped'),
    completed: orders.filter((o) => o.delivered_at && dayKey(o.delivered_at).startsWith(month)),
    conversion: leads.length ? Math.round((orders.length / leads.length) * 100) : 0,
  };
}
