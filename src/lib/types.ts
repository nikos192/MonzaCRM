export type Row = {
  id: string;
  created_at: string;
  updated_at?: string;
  archived_at?: string | null;
};
export type Customer = Row & {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  instagram: string;
  facebook?: string;
  location: string;
  preferred_contact: string;
  notes: string;
};
export type Vehicle = Row & {
  customer_id: string;
  make: string;
  model: string;
  year: string;
  variant?: string;
  chassis: string;
  colour?: string;
  registration?: string;
  suspension?: string;
  brakes?: string;
  current_wheels?: string;
  current_tyres?: string;
  notes?: string;
};
export type Stage = Row & { name: string; position: number; colour: string; is_terminal: boolean };
export type Lead = Row & {
  customer_id: string;
  vehicle_id: string | null;
  stage_id: string;
  source: string;
  handled_by: string | null;
  priority: string;
  notes: string;
  last_contacted: string | null;
  follow_up_step: number;
  call_step: number;
};
export type WheelSpec = Row & {
  lead_id: string;
  design: string;
  design_reference?: string;
  construction: string;
  diameter: string;
  front_width: string;
  rear_width: string;
  front_offset: string;
  rear_offset: string;
  pcd: string;
  centre_bore: string;
  front_tyre?: string;
  rear_tyre?: string;
  finish: string;
  face_finish?: string;
  lip_finish?: string;
  barrel_finish?: string;
  cap_finish?: string;
  logo_colour?: string;
  brake_clearance?: string;
  load_rating?: string;
  fitment_notes: string;
  customer_requests?: string;
  supplier_notes?: string;
};
export type Quote = Row & {
  lead_id: string;
  base_price: number;
  discount: number;
  shipping_included: boolean;
  deposit_required: number;
  status: string;
  quote_date: string;
  expires_at: string | null;
  notes: string;
};
export type Message = Row & {
  lead_id: string;
  direction: string;
  channel: string;
  content: string;
  staff_user: string | null;
  external_id?: string;
  status: string;
};
export type FollowUp = Row & {
  lead_id: string;
  type: string;
  due_at: string;
  notes: string;
  status: string;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
};
export type Order = Row & {
  lead_id: string;
  stage: string;
  final_price: number;
  supplier_id: string | null;
  supplier_reference: string;
  render_requested_at?: string;
  render_received_at?: string;
  render_sent_at?: string;
  render_approved_at?: string;
  production_start?: string;
  estimated_completion: string | null;
  completed_at?: string;
  qc_at?: string;
  shipping_provider: string;
  tracking_number: string;
  shipped_at: string | null;
  expected_delivery?: string;
  delivered_at: string | null;
  notes: string;
  supplier_notes?: string;
  qc_notes?: string;
};
export type Payment = Row & {
  order_id: string;
  type: string;
  amount: number;
  paid_at: string;
  provider: string;
  reference: string;
  status: string;
  notes: string;
};
export type Activity = Row & {
  entity: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
};
export type Attachment = Row & {
  lead_id: string;
  order_id?: string | null;
  customer_id?: string | null;
  filename: string;
  category: string;
  storage_path: string;
  uploaded_by: string | null;
  mime_type: string;
  size: number;
};
export type Supplier = Row & {
  name: string;
  contact: string;
  email: string;
  phone: string;
  social: string;
  notes: string;
  production_days: number;
  shipping_notes: string;
};
export type Profile = Row & { display_name: string };
export type Setting = Row & { key: string; value: string[] };
export type Revision = Row & {
  quote_id: string;
  previous_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  actor_id: string | null;
};
export type Data = {
  customers: Customer[];
  vehicles: Vehicle[];
  leads: Lead[];
  pipeline_stages: Stage[];
  wheel_specs: WheelSpec[];
  quotes: Quote[];
  messages: Message[];
  follow_ups: FollowUp[];
  orders: Order[];
  payments: Payment[];
  activity_logs: Activity[];
  attachments: Attachment[];
  suppliers: Supplier[];
  profiles: Profile[];
  settings: Setting[];
  quote_revisions: Revision[];
};
export type Table = keyof Data;
export type Mutation =
  | { action: 'save'; table: string; id?: string; values: Record<string, unknown> }
  | { action: 'create_lead'; values: Record<string, unknown> }
  | { action: 'convert'; lead_id: string; amount: number; reference: string }
  | { action: 'delete_lead'; id: string };
export const STAGES = [
  'New Lead',
  'Contacted',
  'Replied',
  'Quote Sent',
  'Follow-Up 1',
  'Follow-Up 2',
  'Follow-Up 3',
  'Deposit Paid',
  'In Production',
  'Balance Due',
  'Paid',
  'Shipped',
  'Completed',
  'Lost',
];
export const isLegacyFollowUpStage = (name: string) => /^Legacy Follow[- ]?Up [123]$/i.test(name);
export const ORDER_STAGES = [
  'Deposit Paid',
  'Awaiting Render',
  'Render Sent',
  'Render Approved',
  'Sent to Supplier',
  'In Production',
  'QC',
  'Balance Due',
  'Balance Paid',
  'Ready to Ship',
  'Shipped',
  'Delivered',
];
export const SOURCES = [
  'Website',
  'Instagram',
  'Facebook',
  'SMS',
  'Phone',
  'Email',
  'Referral',
  'Marketplace',
  'Walk-in',
  'Other',
];
export const FOLLOW_TYPES = [
  'First outreach',
  'Quote follow-up',
  'Second follow-up',
  'Deposit follow-up',
  'Render approval',
  'Balance reminder',
  'Delivery follow-up',
  'General',
];
export const CHANNELS = [
  'SMS',
  'Email',
  'Instagram',
  'Facebook',
  'WhatsApp',
  'Website',
  'Manual note',
  'Other',
];
export const money = (n: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(n);
export const fullName = (c?: Customer) =>
  c ? `${c.first_name} ${c.last_name}`.trim() : 'Unknown customer';
export const vehicleName = (v?: Vehicle) =>
  v ? [v.make, v.chassis, v.model].filter(Boolean).join(' ') : 'Vehicle to confirm';
export const quoteTotal = (q?: Quote) => (q ? Number(q.base_price) - Number(q.discount) : 0);
export const orderPaid = (data: Data, id: string) =>
  data.payments
    .filter((p) => p.order_id === id && p.status === 'Paid')
    .reduce((s, p) => s + (p.type === 'Refund' ? -Number(p.amount) : Number(p.amount)), 0);
export function emptyData(): Data {
  return {
    customers: [],
    vehicles: [],
    leads: [],
    pipeline_stages: [],
    wheel_specs: [],
    quotes: [],
    messages: [],
    follow_ups: [],
    orders: [],
    payments: [],
    activity_logs: [],
    attachments: [],
    suppliers: [],
    profiles: [],
    settings: [],
    quote_revisions: [],
  };
}
