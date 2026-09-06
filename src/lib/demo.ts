import { addDays, subDays } from 'date-fns';
import {
  emptyData,
  STAGES,
  SOURCES,
  FOLLOW_TYPES,
  type Data,
  type Mutation,
  type Table,
  type Lead,
  quoteTotal,
  orderPaid,
} from './types';
export const demoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function makeDemo(): Data {
  const data = emptyData();
  const now = new Date();
  const stamp = (n: number) => subDays(now, n).toISOString();
  const row = (n: number, days = 0) => ({ id: demoId(n), created_at: stamp(days) });
  data.profiles = [
    { ...row(1), display_name: 'Nikos' },
    { ...row(2), display_name: 'Max' },
  ];
  data.pipeline_stages = STAGES.map((name, i) => ({
    ...row(100 + i),
    name,
    position: i,
    colour: [
      '#88909a',
      '#668aaa',
      '#a486ba',
      '#c0904c',
      '#4b9784',
      '#668aaa',
      '#c0904c',
      '#4b9784',
      '#668aaa',
      '#4b9784',
      '#88909a',
    ][i],
    is_terminal: i > 8,
  }));
  data.settings = [
    { ...row(150), key: 'lead_sources', value: SOURCES },
    { ...row(151), key: 'follow_up_types', value: FOLLOW_TYPES },
  ];
  const people = [
    ['Oliver', 'Bennett', 'BMW', 'M4', 'G82', '2024', 'Brisbane, QLD', 'Instagram', 3, 6800, 1],
    ['James', 'Mitchell', 'Nissan', 'Silvia', 'S15', '2001', 'Sydney, NSW', 'Website', 0, 0, 0],
    [
      'Alex',
      'Chen',
      'Porsche',
      '911 GT3',
      '992',
      '2023',
      'Melbourne, VIC',
      'Referral',
      5,
      9400,
      12,
    ],
    [
      'Daniel',
      'Brooks',
      'BMW',
      'M2 Competition',
      'F87',
      '2020',
      'Gold Coast, QLD',
      'Instagram',
      2,
      6200,
      2,
    ],
    ['Sophie', 'Turner', 'Toyota', 'Supra', 'A90', '2022', 'Perth, WA', 'Website', 3, 5900, 3],
    [
      'Ethan',
      'Walker',
      'Mercedes-AMG',
      'C63',
      'W205',
      '2019',
      'Sydney, NSW',
      'Facebook',
      6,
      7600,
      22,
    ],
    ['Lucas', 'Hayes', 'Mazda', 'RX-7', 'FD', '1997', 'Adelaide, SA', 'Instagram', 1, 5400, 1],
    ['Noah', 'Reed', 'Audi', 'RS3', '8Y', '2024', 'Brisbane, QLD', 'Website', 0, 0, 0],
    ['Liam', 'Parker', 'BMW', 'M4', 'F82', '2018', 'Melbourne, VIC', 'Referral', 4, 6100, 8],
    ['Isabella', 'Rossi', 'BMW', 'M3', 'G80', '2023', 'Sydney, NSW', 'Instagram', 3, 7200, 5],
    ['Jack', 'Wilson', 'Nissan', 'GT-R', 'R35', '2017', 'Gold Coast, QLD', 'Phone', 8, 8800, 28],
    ['Mia', 'Sullivan', 'Audi', 'RS6', 'C8', '2023', 'Brisbane, QLD', 'Website', 9, 8600, 30],
  ];
  people.forEach((p, i) => {
    const [first, last, make, model, chassis, year, location, source, stage, price, days] = p as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      number,
      number,
      number,
    ];
    const c = {
      ...row(200 + i, days),
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone: `+61 400 000 ${String(i + 1).padStart(3, '0')}`,
      instagram: `${first.toLowerCase()}_${chassis.toLowerCase()}`,
      location,
      preferred_contact: source === 'Instagram' ? 'Instagram' : 'Email',
      notes: 'Fictional development customer. Not a real enquiry.',
    };
    data.customers.push(c);
    const v = {
      ...row(300 + i, days),
      customer_id: c.id,
      make,
      model,
      chassis,
      year,
      colour: ['Alpine White', 'Midnight Blue', 'GT Silver', 'Black Sapphire'][i % 4],
      suspension: 'Factory suspension',
      brakes: 'Factory brakes',
      notes: '',
    };
    data.vehicles.push(v);
    const l = {
      ...row(400 + i, days),
      customer_id: c.id,
      vehicle_id: v.id,
      stage_id: demoId(100 + stage),
      source,
      handled_by: demoId((i % 2) + 1),
      priority: i === 0 || i === 5 ? 'High' : 'Normal',
      notes:
        i === 0
          ? 'Looking for a clean OEM+ fitment. Satin brushed finish with a subtle concave profile.'
          : 'Confirm fitment and finish before production.',
      last_contacted: stage === 0 ? null : stamp(Math.min(days, 3)),
      follow_up_step: stage < 3 ? Math.min(stage, 2) : Math.min(3, (i % 3) + 1),
      call_step: stage === 0 ? 0 : Math.min(3, (i % 3) + 1),
    };
    data.leads.push(l);
    data.wheel_specs.push({
      ...row(500 + i, days),
      lead_id: l.id,
      design: ['MZ-01', 'MZ-07', 'MZ-03', 'MZ-05'][i % 4],
      construction: 'One-piece',
      diameter: i === 2 ? '21' : '20',
      front_width: '9.5',
      rear_width: '10.5',
      front_offset: '+22',
      rear_offset: '+35',
      pcd: make === 'BMW' ? '5×112' : '5×114.3',
      centre_bore: '66.6',
      finish: ['Satin brushed titanium', 'Brushed silver', 'Gloss black'][i % 3],
      fitment_notes: 'Flush fitment. Confirm brake clearance before sign-off.',
    });
    if (price)
      data.quotes.push({
        ...row(600 + i, days),
        lead_id: l.id,
        base_price: price,
        discount: 0,
        shipping_included: true,
        deposit_required: price / 2,
        status: stage >= 4 ? 'Accepted' : stage === 1 ? 'Draft' : 'Sent',
        quote_date: stamp(days).slice(0, 10),
        expires_at: addDays(now, 14).toISOString().slice(0, 10),
        notes: 'Set of four custom forged wheels. Tyres excluded.',
      });
    data.messages.push({
      ...row(700 + i, days),
      lead_id: l.id,
      direction: 'Incoming',
      channel: source === 'Referral' ? 'Email' : source === 'Phone' ? 'SMS' : source,
      content: `Hey! Looking at a set of forged wheels for my ${chassis} ${model}. Love the ${['MZ-01', 'MZ-07', 'MZ-03', 'MZ-05'][i % 4]} design. Could you help with sizing and pricing?`,
      staff_user: null,
      status: 'Received',
    });
    if (stage !== 0)
      data.messages.push({
        ...row(750 + i, Math.max(0, days - 1)),
        lead_id: l.id,
        direction: 'Outgoing',
        channel: c.preferred_contact,
        content: `Hey ${first}, absolutely! We can build a staggered set specifically for your ${model}. I've put together the specs and pricing for you. Let me know what you think of the brushed finish.`,
        staff_user: l.handled_by,
        status: 'Logged',
      });
    if (stage >= 4 && stage !== 10) {
      const oid = demoId(800 + i);
      data.orders.push({
        ...row(800 + i, days),
        lead_id: l.id,
        stage:
          stage === 5
            ? 'In Production'
            : stage === 6
              ? 'Balance Due'
              : stage === 8
                ? 'Shipped'
                : stage === 9
                  ? 'Delivered'
                  : 'Awaiting Render',
        final_price: price,
        supplier_id: demoId(160),
        supplier_reference: `MZ-26-${1040 + i}`,
        estimated_completion: addDays(now, i === 2 ? 9 : 3).toISOString(),
        production_start: stamp(days - 2),
        shipping_provider: stage >= 8 ? 'DHL Express' : '',
        tracking_number: stage >= 8 ? `DEMO${900000 + i}` : '',
        shipped_at: stage >= 8 ? stamp(3) : null,
        delivered_at: stage === 9 ? stamp(1) : null,
        notes: 'Confirm QC images before dispatch.',
      });
      data.payments.push({
        ...row(900 + i, Math.min(days, now.getDate() - 1)),
        order_id: oid,
        type: 'Deposit',
        amount: price / 2,
        paid_at: stamp(Math.min(days, now.getDate() - 1)),
        provider: 'Bank transfer',
        reference: `DEMO-DEP-${i}`,
        status: 'Paid',
        notes: '',
      });
      if (stage >= 8)
        data.payments.push({
          ...row(950 + i, 2),
          order_id: oid,
          type: 'Balance',
          amount: price / 2,
          paid_at: stamp(2),
          provider: 'Bank transfer',
          reference: `DEMO-BAL-${i}`,
          status: 'Paid',
          notes: '',
        });
    }
    if (stage > 0 && stage < 7)
      data.follow_ups.push({
        ...row(1000 + i, days),
        lead_id: l.id,
        type: stage >= 4 ? 'Render approval' : 'Quote follow-up',
        due_at: addDays(
          now,
          i === 0 || i === 5 ? -1 : i === 3 || i === 4 ? 0 : i === 8 ? 1 : 3,
        ).toISOString(),
        notes:
          stage >= 4
            ? 'Check in on production and customer approval.'
            : 'Check if they have any questions about the quote.',
        status: 'Open',
        created_by: l.handled_by,
        completed_by: null,
        completed_at: null,
      });
    data.activity_logs.push({
      ...row(1100 + i, Math.min(days, 1)),
      entity: 'leads',
      entity_id: l.id,
      action: stage === 0 ? 'created' : 'updated',
      actor_id: l.handled_by,
      metadata: {
        summary:
          stage === 0
            ? `${first} ${last} enquired about ${chassis} ${model}`
            : `${first} ${last} · ${STAGES[stage]}`,
      },
    });
  });
  data.messages.push({
    ...row(1200),
    lead_id: demoId(403),
    direction: 'Incoming',
    channel: 'Instagram',
    content:
      'The brushed titanium looks incredible. Would these clear the factory big brakes? And what is the current lead time?',
    staff_user: null,
    status: 'Received',
  });
  data.suppliers = [
    {
      ...row(160),
      name: 'Monza Manufacturing Partner',
      contact: 'Production team',
      email: 'production@example.com',
      phone: '',
      social: '',
      notes: 'Fictional development supplier',
      production_days: 35,
      shipping_notes: 'QC photos required before dispatch',
    },
  ];
  return data;
}
export function applyDemoMutation(original: Data, m: Mutation, userId: string): Data {
  const data = structuredClone(original);
  const now = new Date().toISOString();
  const row = () => ({ id: crypto.randomUUID(), created_at: now, updated_at: now });
  const audit = (entity: string, id: string, action: string, before: unknown, after: unknown) =>
    data.activity_logs.unshift({
      ...row(),
      entity,
      entity_id: id,
      action,
      actor_id: userId,
      metadata: { before, after },
    });
  if (m.action === 'create_lead') {
    const v = m.values;
    const norm = (x: unknown) => String(x ?? '').replace(/[^0-9]/g, '');
    let customer = data.customers.find(
      (c) =>
        !c.archived_at &&
        ((v.email && c.email.toLowerCase() === String(v.email).toLowerCase()) ||
          (v.phone && norm(c.phone) === norm(v.phone))),
    );
    if (!customer) {
      customer = {
        ...row(),
        first_name: String(v.first_name),
        last_name: String(v.last_name),
        email: String(v.email),
        phone: String(v.phone),
        instagram: String(v.instagram),
        location: String(v.location),
        preferred_contact: String(v.preferred_contact),
        notes: String(v.notes),
      };
      data.customers.push(customer);
      audit('customers', customer.id, 'created', {}, customer);
    }
    const vehicle = {
      ...row(),
      customer_id: customer.id,
      make: String(v.make),
      model: String(v.model),
      year: String(v.year),
      chassis: String(v.chassis),
    };
    data.vehicles.push(vehicle);
    const lead = {
      ...row(),
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      stage_id: String(v.stage_id),
      source: String(v.source),
      handled_by: v.handled_by as string | null,
      priority: String(v.priority),
      notes: String(v.notes),
      last_contacted: null,
      follow_up_step: 0,
      call_step: 0,
    };
    data.leads.unshift(lead);
    audit('leads', lead.id, 'created', {}, lead);
  } else if (m.action === 'save') {
    const table = m.table as Table;
    const rows = data[table] as unknown as Record<string, unknown>[];
    const index = m.id ? rows.findIndex((r) => r.id === m.id) : -1;
    if (m.id && index < 0) throw new Error('Record not found.');
    const before = index >= 0 ? structuredClone(rows[index]) : {};
    const values = { ...m.values };
    if (table === 'messages') {
      values.staff_user = userId;
      if (values.direction === 'Outgoing' && values.channel !== 'Manual note') {
        const lead = data.leads.find((l) => l.id === values.lead_id);
        if (lead) lead.last_contacted = now;
      }
    }
    if (table === 'follow_ups') {
      if (index < 0) values.created_by = userId;
      values.completed_by = values.status === 'Completed' ? userId : null;
      values.completed_at = values.status === 'Completed' ? now : null;
    }
    if (table === 'payments') {
      const order = data.orders.find((o) => o.id === values.order_id);
      if (!order) throw new Error('Order not found');
      const paid = orderPaid(
        { ...data, payments: data.payments.filter((p) => p.id !== m.id) },
        order.id,
      );
      const signed =
        values.status === 'Paid'
          ? values.type === 'Refund'
            ? -Number(values.amount)
            : Number(values.amount)
          : 0;
      if (paid + signed < 0 || paid + signed > order.final_price)
        throw new Error('Payment exceeds the outstanding balance or refundable amount.');
    }
    if (table === 'orders') {
      const order = data.orders.find((o) => o.id === m.id);
      if (!order) throw new Error('Order not found.');
      if (
        ['Balance Paid', 'Ready to Ship', 'Shipped', 'Delivered'].includes(String(values.stage)) &&
        orderPaid(data, order.id) < order.final_price
      )
        throw new Error('Record the full balance before shipping.');
      if (values.stage === 'Delivered' && !values.delivered_at)
        throw new Error('Delivery date is required.');
    }
    const updated: Record<string, unknown> = {
      ...(index >= 0 ? rows[index] : row()),
      ...values,
      updated_at: now,
    };
    if (table === 'quotes' && index >= 0)
      data.quote_revisions.unshift({
        ...row(),
        quote_id: String(updated.id),
        previous_value: before,
        new_value: updated,
        actor_id: userId,
      });
    if (index >= 0) rows[index] = updated;
    else rows.unshift(updated);
    audit(table, String(updated.id), index >= 0 ? 'updated' : 'created', before, updated);
  } else if (m.action === 'archive') {
    const r = (data[m.table] as (Lead & { archived_at?: string })[]).find((x) => x.id === m.id);
    if (!r) throw new Error('Record not found');
    const before = { ...r };
    r.archived_at = now;
    audit(m.table, r.id, 'archived', before, r);
  } else if (m.action === 'convert') {
    const lead = data.leads.find((l) => l.id === m.lead_id && !l.archived_at);
    const q = data.quotes.find((q) => q.lead_id === m.lead_id);
    if (!lead || !q || ['Declined', 'Expired'].includes(q.status))
      throw new Error('Create an active quote before recording a deposit.');
    if (data.orders.some((o) => o.lead_id === lead.id))
      throw new Error('This lead already has an order.');
    if (m.amount <= 0 || m.amount > quoteTotal(q))
      throw new Error('Deposit must be between zero and the quote total.');
    const order = {
      ...row(),
      lead_id: lead.id,
      stage: 'Deposit Paid',
      final_price: quoteTotal(q),
      supplier_id: null,
      supplier_reference: '',
      estimated_completion: null,
      shipping_provider: '',
      tracking_number: '',
      shipped_at: null,
      delivered_at: null,
      notes: '',
    };
    data.orders.unshift(order);
    const payment = {
      ...row(),
      order_id: order.id,
      type: 'Deposit',
      amount: m.amount,
      paid_at: now,
      provider: 'Manual record',
      reference: m.reference,
      status: 'Paid',
      notes: '',
    };
    data.payments.unshift(payment);
    const oldQuote = { ...q };
    q.status = 'Accepted';
    data.quote_revisions.unshift({
      ...row(),
      quote_id: q.id,
      previous_value: oldQuote as unknown as Record<string, unknown>,
      new_value: q as unknown as Record<string, unknown>,
      actor_id: userId,
    });
    const stage = data.pipeline_stages.find((s) => s.name === 'Deposit Paid');
    if (stage) {
      const before = { ...lead };
      lead.stage_id = stage.id;
      audit('leads', lead.id, 'updated', before, lead);
    }
    audit('orders', order.id, 'created', {}, order);
    audit('payments', payment.id, 'created', {}, payment);
  }
  return data;
}
