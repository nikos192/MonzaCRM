import { z } from 'zod';
import { CHANNELS, ORDER_STAGES } from './types';
const text = z.string().trim().max(4000);
const short = z.string().trim().max(200);
const required = short.min(1);
const uuid = z.uuid();
const optionalId = uuid.nullable();
const amount = z.coerce.number().finite().min(0).max(1000000);
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date');
const optionalDate = z.union([date, z.literal(''), z.null()]).transform((v) => v || null);
const contact = {
  first_name: required,
  last_name: short,
  email: z.union([z.email(), z.literal('')]),
  phone: z.string().trim().max(40),
  instagram: short,
  facebook: short.optional(),
  location: short,
  preferred_contact: short,
  notes: text,
};
const vehicle = {
  customer_id: uuid,
  make: required,
  model: required,
  year: short,
  chassis: short,
  variant: short.optional(),
  colour: short.optional(),
  registration: short.optional(),
  suspension: text.optional(),
  brakes: text.optional(),
  current_wheels: short.optional(),
  current_tyres: short.optional(),
  notes: text.optional(),
};
export const leadInput = z
  .object({
    ...contact,
    make: required,
    model: required,
    year: short,
    chassis: short,
    source: required,
    priority: z.enum(['Low', 'Normal', 'High']),
    handled_by: optionalId,
    stage_id: uuid,
  })
  .strict()
  .refine((v) => v.email || v.phone || v.instagram, {
    message: 'Add an email, phone number, or Instagram handle',
  });
export const schemas = {
  customers: z.object(contact).strict(),
  vehicles: z.object(vehicle).strict(),
  leads: z
    .object({
      stage_id: uuid,
      source: required,
      handled_by: optionalId,
      priority: z.enum(['Low', 'Normal', 'High']),
      notes: text,
      last_contacted: optionalDate,
      vehicle_id: optionalId,
      follow_up_step: z.coerce.number().int().min(0).max(3),
      call_step: z.coerce.number().int().min(0).max(3),
    })
    .partial()
    .strict(),
  wheel_specs: z
    .object({
      lead_id: uuid,
      design: short,
      design_reference: short.optional(),
      construction: z.enum(['One-piece', 'Two-piece', 'Three-piece']),
      diameter: short,
      front_width: short,
      rear_width: short,
      front_offset: short,
      rear_offset: short,
      pcd: short,
      centre_bore: short,
      front_tyre: short.optional(),
      rear_tyre: short.optional(),
      finish: short,
      face_finish: short.optional(),
      lip_finish: short.optional(),
      barrel_finish: short.optional(),
      cap_finish: short.optional(),
      logo_colour: short.optional(),
      brake_clearance: text.optional(),
      load_rating: short.optional(),
      fitment_notes: text,
      customer_requests: text.optional(),
      supplier_notes: text.optional(),
    })
    .strict(),
  quotes: z
    .object({
      lead_id: uuid,
      base_price: amount,
      discount: amount,
      shipping_included: z.boolean(),
      deposit_required: amount,
      status: z.enum(['Draft', 'Sent', 'Negotiating', 'Accepted', 'Declined', 'Expired']),
      quote_date: date,
      expires_at: optionalDate,
      notes: text,
    })
    .strict()
    .refine((v) => v.discount <= v.base_price && v.deposit_required <= v.base_price - v.discount, {
      message: 'Discount and deposit cannot exceed the quote total',
    }),
  messages: z
    .object({
      lead_id: uuid,
      direction: z.enum(['Incoming', 'Outgoing']),
      channel: z.enum(CHANNELS),
      content: text.min(1),
      status: z.enum(['Logged', 'Received']),
      external_id: short.optional(),
    })
    .strict(),
  follow_ups: z
    .object({
      lead_id: uuid,
      type: required,
      due_at: date,
      notes: text,
      status: z.enum(['Open', 'Completed']),
    })
    .strict(),
  orders: z
    .object({
      stage: z.enum(ORDER_STAGES),
      supplier_id: optionalId,
      supplier_reference: short,
      render_requested_at: optionalDate.optional(),
      render_received_at: optionalDate.optional(),
      render_sent_at: optionalDate.optional(),
      render_approved_at: optionalDate.optional(),
      production_start: optionalDate.optional(),
      estimated_completion: optionalDate,
      completed_at: optionalDate.optional(),
      qc_at: optionalDate.optional(),
      shipping_provider: short,
      tracking_number: short,
      shipped_at: optionalDate,
      expected_delivery: optionalDate.optional(),
      delivered_at: optionalDate,
      notes: text,
      supplier_notes: text.optional(),
      qc_notes: text.optional(),
    })
    .strict()
    .refine(
      (v) =>
        !['Shipped', 'Delivered'].includes(v.stage) ||
        Boolean(v.tracking_number && v.shipping_provider && v.shipped_at),
      { message: 'Shipping provider, tracking and shipping date are required before shipping' },
    ),
  payments: z
    .object({
      order_id: uuid,
      type: z.enum(['Deposit', 'Balance', 'Partial payment', 'Refund', 'Other']),
      amount: amount.refine((v) => v > 0),
      paid_at: date,
      provider: required,
      reference: short,
      status: z.enum(['Pending', 'Paid', 'Failed', 'Refunded']),
      notes: text,
    })
    .strict(),
  suppliers: z
    .object({
      name: required,
      contact: short,
      email: z.union([z.email(), z.literal('')]),
      phone: short,
      social: short,
      notes: text,
      production_days: z.coerce.number().int().min(0).max(730),
      shipping_notes: text,
    })
    .strict(),
  pipeline_stages: z
    .object({
      name: required,
      position: z.coerce.number().int().min(0).max(100),
      colour: z.string().regex(/^#[a-fA-F0-9]{6}$/),
      is_terminal: z.boolean(),
    })
    .strict(),
  settings: z
    .object({
      key: z.enum(['lead_sources', 'follow_up_types']),
      value: z.array(required).min(1).max(50),
    })
    .strict(),
};
export const mutationInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('save'),
      table: z.enum(Object.keys(schemas) as [keyof typeof schemas, ...(keyof typeof schemas)[]]),
      id: uuid.optional(),
      values: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z.object({ action: z.literal('create_lead'), values: leadInput }).strict(),
  z
    .object({
      action: z.literal('convert'),
      lead_id: uuid,
      amount: amount.refine((v) => v > 0),
      reference: short,
    })
    .strict(),
  z
    .object({
      action: z.literal('archive'),
      table: z.enum(['leads', 'customers', 'orders']),
      id: uuid,
    })
    .strict(),
]);
export function validateMutation(input: unknown) {
  const m = mutationInput.parse(input);
  if (m.action === 'save') return { ...m, values: schemas[m.table].parse(m.values) };
  return m;
}
export const intakeInput = z
  .object({
    first_name: required,
    last_name: short.default(''),
    email: z.email(),
    phone: z.string().trim().max(40).default(''),
    make: required,
    model: required,
    year: short.default(''),
    chassis: short.default(''),
    notes: text.default(''),
    website: z.string().max(0).default(''),
    request_id: uuid,
  })
  .strict();
export const loginInput = z
  .object({ email: z.email(), password: z.string().min(1).max(200) })
  .strict();
