'use client';
import { useState, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Download,
  Edit3,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Upload,
  Car,
  MapPin,
  History,
} from 'lucide-react';
import { useCRM } from './store';
import { Avatar, Badge, Button, Empty, Form, Modal, SectionHeading, type Field } from './ui';
import {
  fullName,
  vehicleName,
  money,
  quoteTotal,
  orderPaid,
  FOLLOW_TYPES,
  ORDER_STAGES,
  type FollowUp,
  isLegacyFollowUpStage,
} from '@/lib/types';
import { dayKey } from '@/lib/analytics';
import { addDays, formatDistanceToNow } from 'date-fns';
import { MonzaLogo } from './logo';
const asRecord = (v: unknown) => v as Record<string, unknown>;
const textFields = (pairs: string[]) =>
  pairs.map((p) => {
    const [name, label] = p.split('|');
    return { name, label } as Field;
  });
const dateInput = (v: unknown) => (v ? String(v).slice(0, 10) : '');
const localDateTime = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
type Editor = {
  title: string;
  table: string;
  id?: string;
  fields: Field[];
  initial: Record<string, unknown>;
  extra?: Record<string, unknown>;
  description?: string;
};
export function FollowForm({
  leadId,
  existing,
  onClose,
}: {
  leadId: string;
  existing?: FollowUp;
  onClose: () => void;
}) {
  const { data, mutate } = useCRM();
  return (
    <Modal
      title={existing ? 'Edit follow-up' : 'Keep the conversation moving.'}
      subtitle="A small reminder. A better customer experience."
      onClose={onClose}
    >
      <Form
        fields={[
          {
            name: 'type',
            label: 'Follow-up type',
            type: 'select',
            options: data.settings.find((s) => s.key === 'follow_up_types')?.value ?? FOLLOW_TYPES,
            required: true,
          },
          {
            name: 'due_at',
            label: 'Due date & time (your device timezone)',
            type: 'datetime-local',
            required: true,
          },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: ['Open', 'Completed'],
            required: true,
          },
          { name: 'notes', label: 'Notes / reason', type: 'textarea' },
        ]}
        initial={{
          type: 'Quote follow-up',
          status: 'Open',
          notes: '',
          ...(existing ? asRecord(existing) : {}),
          due_at: localDateTime(existing?.due_at ?? addDays(new Date(), 1).toISOString()),
        }}
        onClose={onClose}
        onSubmit={async (values) => {
          await mutate({
            action: 'save',
            table: 'follow_ups',
            id: existing?.id,
            values: {
              ...values,
              lead_id: leadId,
              due_at: new Date(String(values.due_at)).toISOString(),
            },
          });
        }}
        submitLabel={existing ? 'Save follow-up' : 'Create follow-up'}
      />
    </Modal>
  );
}
export function FollowList({ leadId }: { leadId?: string }) {
  const { data, mutate, notify, openLead } = useCRM();
  const [edit, setEdit] = useState<FollowUp | null>(null);
  const follows = data.follow_ups
    .filter((f) => !leadId || f.lead_id === leadId)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  async function change(f: FollowUp, values: Record<string, unknown>) {
    try {
      await mutate({
        action: 'save',
        table: 'follow_ups',
        id: f.id,
        values: {
          lead_id: f.lead_id,
          type: f.type,
          due_at: f.due_at,
          notes: f.notes,
          status: f.status,
          ...values,
        },
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not update follow-up.');
    }
  }
  return (
    <>
      {follows.map((f) => (
        <div className={`follow-row ${f.status === 'Completed' ? 'completed' : ''}`} key={f.id}>
          <button
            className="complete-button"
            aria-label={f.status === 'Completed' ? 'Reopen follow-up' : 'Complete follow-up'}
            onClick={() => change(f, { status: f.status === 'Completed' ? 'Open' : 'Completed' })}
          >
            {f.status === 'Completed' && <Check size={14} />}
          </button>
          <div className="follow-info">
            <strong>{f.type}</strong>
            {!leadId && (
              <button className="inline-link" onClick={() => openLead(f.lead_id)}>
                {fullName(
                  data.customers.find(
                    (c) => c.id === data.leads.find((l) => l.id === f.lead_id)?.customer_id,
                  ),
                )}
              </button>
            )}
            <p>{f.notes}</p>
            <span
              className={
                f.status !== 'Completed' && dayKey(f.due_at) < dayKey(new Date())
                  ? 'danger-text'
                  : 'muted'
              }
            >
              <Clock3 size={12} />
              {new Date(f.due_at).toLocaleString('en-AU', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
          <div className="follow-actions">
            {f.status !== 'Completed' && (
              <button onClick={() => change(f, { due_at: addDays(new Date(), 1).toISOString() })}>
                Snooze 1 day
              </button>
            )}
            <button aria-label="Edit follow-up" onClick={() => setEdit(f)}>
              <Edit3 size={14} />
            </button>
          </div>
        </div>
      ))}
      {!follows.length && (
        <Empty
          title="Nothing to follow up. Yet."
          description="Set a reminder so this enquiry gets the attention it deserves."
        />
      )}
      {edit && <FollowForm leadId={edit.lead_id} existing={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
function Files({ leadId }: { leadId: string }) {
  const { data, demo, refresh, notify } = useCRM();
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('Wheel reference');
  const [remove, setRemove] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const files = data.attachments.filter((f) => f.lead_id === leadId);
  async function upload(file: File) {
    if (file.size > 4194304) {
      notify('Choose a file under 4 MB.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set('lead_id', leadId);
      form.set('category', category);
      form.set('file', file);
      const response = await fetch('/api/files', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await refresh();
      notify('File uploaded securely.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div>
      <div className="file-upload">
        <Upload size={26} />
        <h3>Keep the details together.</h3>
        <p>Vehicle photos, wheel references, renders, and documents.</p>
        <div>
          <select
            aria-label="File category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              'Vehicle photo',
              'Wheel reference',
              'Screenshot',
              '3D render',
              'Engineering drawing',
              'Supplier drawing',
              'Invoice',
              'Receipt',
              'QC photo',
              'Shipping document',
              'Other',
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            disabled={demo || busy}
            onClick={() => input.current?.click()}
          >
            <Plus size={15} />
            {busy ? 'Uploading…' : 'Upload file'}
          </Button>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              if (e.target.files?.[0]) upload(e.target.files[0]);
            }}
          />
        </div>
        <small>
          {demo
            ? 'File uploads require the authenticated Supabase workspace.'
            : 'Private storage · JPG, PNG, WebP, PDF · Maximum 4 MB'}
        </small>
      </div>
      {files.map((f) => (
        <div className="file-row" key={f.id}>
          <FileText size={22} />
          <div>
            <strong>{f.filename}</strong>
            <small>
              {f.category} · {Math.round(f.size / 1024)} KB
            </small>
          </div>
          <button
            className="icon-button"
            aria-label={`Download ${f.filename}`}
            onClick={async () => {
              try {
                const r = await fetch(`/api/files?id=${f.id}`);
                const b = await r.json();
                if (!r.ok) throw new Error(b.error);
                window.open(b.url, '_blank', 'noopener,noreferrer');
              } catch (e) {
                notify(e instanceof Error ? e.message : 'Download failed.');
              }
            }}
          >
            <Download size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={`Remove ${f.filename}`}
            onClick={() => setRemove(f.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {remove && (
        <Modal
          title="Remove this file?"
          subtitle="The file will be permanently removed from private storage."
          onClose={() => setRemove(null)}
        >
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch(`/api/files?id=${remove}`, { method: 'DELETE' });
                  if (!r.ok) throw new Error((await r.json()).error);
                  await refresh();
                  setRemove(null);
                  notify('File removed.');
                } catch (e) {
                  notify(e instanceof Error ? e.message : 'Remove failed.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove file
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function ActivityTimeline({ leadId }: { leadId: string }) {
  const { data } = useCRM();
  const lead = data.leads.find((l) => l.id === leadId);
  const related = new Set([
    leadId,
    lead?.customer_id,
    lead?.vehicle_id,
    ...data.quotes.filter((q) => q.lead_id === leadId).map((q) => q.id),
    ...data.orders.filter((o) => o.lead_id === leadId).map((o) => o.id),
    ...data.messages.filter((m) => m.lead_id === leadId).map((m) => m.id),
    ...data.follow_ups.filter((f) => f.lead_id === leadId).map((f) => f.id),
    ...data.wheel_specs.filter((w) => w.lead_id === leadId).map((w) => w.id),
    ...data.attachments.filter((f) => f.lead_id === leadId).map((f) => f.id),
  ]);
  data.payments.filter((p) => related.has(p.order_id)).forEach((p) => related.add(p.id));
  const logs = data.activity_logs
    .filter(
      (a) =>
        related.has(a.entity_id) ||
        related.has(String((a.metadata.after as Record<string, unknown> | undefined)?.lead_id)),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="detail-timeline">
      {logs.map((a) => {
        const before = a.metadata.before as Record<string, unknown> | undefined,
          after = a.metadata.after as Record<string, unknown> | undefined;
        let summary = String(a.metadata.summary ?? `${a.entity.replaceAll('_', ' ')} ${a.action}`);
        if (before?.stage_id && after?.stage_id && before.stage_id !== after.stage_id)
          summary = `Moved from ${data.pipeline_stages.find((s) => s.id === before.stage_id)?.name ?? 'previous stage'} to ${data.pipeline_stages.find((s) => s.id === after.stage_id)?.name ?? 'next stage'}`;
        if (before?.stage && after?.stage && before.stage !== after.stage)
          summary = `Order moved from ${before.stage} to ${after.stage}`;
        return (
          <div key={a.id}>
            <span className="timeline-node">
              <History size={13} />
            </span>
            <div>
              <strong>{summary}</strong>
              <p>
                {data.profiles.find((p) => p.id === a.actor_id)?.display_name ?? 'System / website'}{' '}
                · {new Date(a.created_at).toLocaleString('en-AU')}
              </p>
            </div>
          </div>
        );
      })}
      {!logs.length && (
        <Empty
          title="A fresh start"
          description="Important changes to this customer will be recorded here."
        />
      )}
    </div>
  );
}
export function LeadDetail() {
  const { data, selected, closeLead, tab, setTab, mutate, notify, busy } = useCRM();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [follow, setFollow] = useState(false);
  const [deposit, setDeposit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lead = data.leads.find((l) => l.id === selected);
  if (!lead) return null;
  const customer = data.customers.find((c) => c.id === lead.customer_id),
    vehicle = data.vehicles.find((v) => v.id === lead.vehicle_id),
    spec = data.wheel_specs.find((w) => w.lead_id === lead.id),
    quote = data.quotes.find((q) => q.lead_id === lead.id),
    order = data.orders.find((o) => o.lead_id === lead.id);
  const stage = data.pipeline_stages.find((s) => s.id === lead.stage_id);
  const name = fullName(customer);
  function editCustomer() {
    if (!customer) return;
    setEditor({
      title: 'Customer details',
      table: 'customers',
      id: customer.id,
      initial: asRecord(customer),
      fields: [
        ...textFields(['first_name|First name', 'last_name|Last name']),
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', type: 'tel' },
        ...textFields(['instagram|Instagram', 'facebook|Facebook', 'location|Location']),
        {
          name: 'preferred_contact',
          label: 'Preferred contact',
          type: 'select',
          options: ['Email', 'Phone', 'SMS', 'Instagram', 'Facebook', 'WhatsApp'],
        },
        { name: 'notes', label: 'Customer notes', type: 'textarea' },
      ],
    });
  }
  function editVehicle() {
    const fields: Field[] = [
      ...textFields([
        'make|Make',
        'model|Model',
        'year|Year',
        'chassis|Generation / chassis',
        'variant|Variant',
        'colour|Colour',
        'registration|Registration',
        'suspension|Suspension',
        'brakes|Brake setup',
        'current_wheels|Current wheels',
        'current_tyres|Current tyres',
      ]),
      { name: 'notes', label: 'Vehicle notes', type: 'textarea' },
    ];
    setEditor({
      title: 'Vehicle details',
      table: 'vehicles',
      id: vehicle?.id,
      initial: vehicle ? asRecord(vehicle) : {},
      extra: { customer_id: lead!.customer_id },
      fields,
    });
  }
  function editSpecs() {
    setEditor({
      title: 'Dial in the details.',
      table: 'wheel_specs',
      id: spec?.id,
      initial: { construction: 'One-piece', ...(spec ? asRecord(spec) : {}) },
      extra: { lead_id: lead!.id },
      fields: [
        ...textFields(['design|Wheel design', 'design_reference|Design reference']),
        {
          name: 'construction',
          label: 'Construction',
          type: 'select',
          options: ['One-piece', 'Two-piece', 'Three-piece'],
          required: true,
        },
        ...textFields([
          'diameter|Diameter (inches)',
          'front_width|Front width',
          'rear_width|Rear width',
          'front_offset|Front offset (ET)',
          'rear_offset|Rear offset (ET)',
          'pcd|PCD',
          'centre_bore|Centre bore (mm)',
          'front_tyre|Front tyre size',
          'rear_tyre|Rear tyre size',
          'finish|Wheel finish',
          'face_finish|Face finish',
          'lip_finish|Lip finish',
          'barrel_finish|Barrel finish',
          'cap_finish|Centre cap finish',
          'logo_colour|Cap logo colour',
          'brake_clearance|Brake clearance',
          'load_rating|Load rating',
        ]),
        { name: 'fitment_notes', label: 'Fitment notes', type: 'textarea' },
        { name: 'customer_requests', label: 'Customer requests', type: 'textarea' },
        { name: 'supplier_notes', label: 'Supplier notes', type: 'textarea' },
      ],
    });
  }
  function editQuote() {
    setEditor({
      title: quote ? 'Revise quote' : 'Create a quote',
      table: 'quotes',
      id: quote?.id,
      initial: {
        base_price: 0,
        discount: 0,
        deposit_required: 0,
        shipping_included: true,
        status: 'Draft',
        notes: '',
        ...(quote ? asRecord(quote) : {}),
        quote_date: dateInput(quote?.quote_date ?? dayKey(new Date())),
        expires_at: dateInput(quote?.expires_at),
      },
      extra: { lead_id: lead!.id },
      description: order
        ? 'This order keeps its agreed sale price. Quote revisions remain in history.'
        : 'Every revision is saved with its previous values, timestamp and author.',
      fields: [
        { name: 'base_price', label: 'Base price (AUD)', type: 'number', required: true },
        { name: 'discount', label: 'Discount (AUD)', type: 'number' },
        { name: 'deposit_required', label: 'Deposit required (AUD)', type: 'number' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: ['Draft', 'Sent', 'Negotiating', 'Accepted', 'Declined', 'Expired'],
          required: true,
        },
        { name: 'quote_date', label: 'Quote date', type: 'date', required: true },
        { name: 'expires_at', label: 'Expiry date', type: 'date' },
        { name: 'shipping_included', label: 'Shipping included', type: 'checkbox' },
        { name: 'notes', label: 'Quote notes', type: 'textarea' },
      ],
    });
  }
  function editOrder() {
    if (!order) return;
    const dates = [
      'render_requested_at|Render requested',
      'render_received_at|Render received',
      'render_sent_at|Render sent to customer',
      'render_approved_at|Render approved',
      'production_start|Production start',
      'estimated_completion|Estimated completion',
      'completed_at|Production completed',
      'qc_at|QC date',
      'shipped_at|Shipping date',
      'expected_delivery|Expected delivery',
      'delivered_at|Delivery date',
    ];
    const initial = { ...order } as Record<string, unknown>;
    dates.forEach((d) => {
      const key = d.split('|')[0];
      initial[key] = dateInput(initial[key]);
    });
    setEditor({
      title: 'Manage order',
      table: 'orders',
      id: order.id,
      initial,
      fields: [
        {
          name: 'stage',
          label: 'Order stage',
          type: 'select',
          options: ORDER_STAGES,
          required: true,
        },
        {
          name: 'supplier_id',
          label: 'Supplier',
          type: 'select',
          options: data.suppliers.map((s) => ({ label: s.name, value: s.id })),
        },
        ...textFields([
          'supplier_reference|Supplier order reference',
          'shipping_provider|Shipping provider',
          'tracking_number|Tracking number',
        ]),
        ...dates.map((d) => ({
          name: d.split('|')[0],
          label: d.split('|')[1],
          type: 'date' as const,
        })),
        { name: 'notes', label: 'Internal notes', type: 'textarea' },
        { name: 'supplier_notes', label: 'Supplier notes', type: 'textarea' },
        { name: 'qc_notes', label: 'QC notes', type: 'textarea' },
      ],
    });
  }
  function payment(existing?: (typeof data.payments)[number]) {
    if (!order) return;
    setEditor({
      title: existing ? 'Edit payment record' : 'Record a payment',
      table: 'payments',
      id: existing?.id,
      initial: {
        type: 'Balance',
        amount: Math.max(0, order.final_price - orderPaid(data, order.id)),
        paid_at: dayKey(new Date()),
        provider: 'Bank transfer',
        status: 'Paid',
        reference: '',
        notes: '',
        ...(existing ? asRecord(existing) : {}),
        ...(existing ? { paid_at: dateInput(existing.paid_at) } : {}),
      },
      extra: { order_id: order.id },
      description: 'Business records only. Never enter card numbers, CVVs or payment credentials.',
      fields: [
        {
          name: 'type',
          label: 'Payment type',
          type: 'select',
          options: ['Deposit', 'Balance', 'Partial payment', 'Refund', 'Other'],
          required: true,
        },
        { name: 'amount', label: 'Amount (AUD)', type: 'number', required: true },
        { name: 'paid_at', label: 'Payment date', type: 'date', required: true },
        { name: 'provider', label: 'Payment provider', required: true },
        { name: 'reference', label: 'External payment reference' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: ['Pending', 'Paid', 'Failed', 'Refunded'],
          required: true,
        },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    });
  }
  async function copy(value: string | undefined) {
    try {
      if (value) {
        await navigator.clipboard.writeText(value);
        notify('Copied to clipboard.');
      }
    } catch {
      notify('Clipboard is unavailable in this browser.');
    }
  }
  const tabs = ['Overview', 'Wheel Specs', 'Quote', 'Follow-Ups', 'Order', 'Files', 'Activity'];
  return (
    <Modal
      title={name}
      subtitle={`${vehicleName(vehicle)} · ${lead.source} enquiry`}
      wide
      onClose={closeLead}
    >
      <div className="lead-titlebar">
        <Avatar name={name} />
        <div>
          <Badge tone={stage?.name === 'Quote Sent' ? 'amber' : 'blue'}>{stage?.name}</Badge>
          <span className="record-id">LEAD / {lead.id.slice(-6).toUpperCase()}</span>
        </div>
        <select
          aria-label="Change pipeline stage"
          value={lead.stage_id}
          disabled={busy}
          onChange={async (e) => {
            try {
              await mutate({
                action: 'save',
                table: 'leads',
                id: lead.id,
                values: { stage_id: e.target.value },
              });
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Stage change failed.');
            }
          }}
        >
          {[...data.pipeline_stages]
            .sort((a, b) => a.position - b.position)
            .filter((s) => !isLegacyFollowUpStage(s.name))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <Button variant="secondary" onClick={() => setFollow(true)}>
          <Clock3 size={14} /> Follow-up
        </Button>
        {!order && (
          <Button onClick={() => setDeposit(true)} disabled={!quote}>
            <Plus size={14} /> Record deposit
          </Button>
        )}
      </div>
      <div className="detail-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tab === t ? 'active' : ''}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="lead-workspace">
        <aside className="contact-sidebar">
          <div className="mini-section-title">
            CUSTOMER{' '}
            <button aria-label="Edit customer" onClick={editCustomer}>
              <Edit3 size={13} />
            </button>
          </div>
          <div className="contact-item">
            <Phone size={14} />
            <a href={`tel:${customer?.phone}`}>{customer?.phone || 'No phone added'}</a>
            {customer?.phone && (
              <button aria-label="Copy phone" onClick={() => copy(customer.phone)}>
                <Copy size={12} />
              </button>
            )}
          </div>
          <div className="contact-item">
            <Mail size={14} />
            <a href={`mailto:${customer?.email}`}>{customer?.email || 'No email added'}</a>
            {customer?.email && (
              <button aria-label="Copy email" onClick={() => copy(customer.email)}>
                <Copy size={12} />
              </button>
            )}
          </div>
          <div className="contact-item">
            <MessageSquare size={14} />
            <span>
              {customer?.instagram
                ? `@${customer.instagram.replace('@', '')}`
                : 'No Instagram added'}
            </span>
          </div>
          <div className="contact-item">
            <MapPin size={14} />
            <span>{customer?.location || 'Location not set'}</span>
          </div>
          <div className="contact-divider" />
          <dl className="contact-properties">
            <dt>Preferred contact</dt>
            <dd>{customer?.preferred_contact}</dd>
            <dt>Handled by</dt>
            <dd>
              {data.profiles.find((p) => p.id === lead.handled_by)?.display_name ?? 'Unassigned'}
            </dd>
            <dt>Priority</dt>
            <dd>
              {lead.priority === 'High' && <i className="priority-dot" />}
              {lead.priority}
            </dd>
            <dt>Created</dt>
            <dd>{new Date(lead.created_at).toLocaleDateString('en-AU')}</dd>
            <dt>Last contacted</dt>
            <dd>
              {lead.last_contacted
                ? formatDistanceToNow(new Date(lead.last_contacted), { addSuffix: true })
                : 'Not contacted'}
            </dd>
          </dl>
          <div className="contact-divider" />
          <div className="sidebar-quote">
            <span>Quote value</span>
            <strong>{quote ? money(quoteTotal(quote)) : 'Not quoted'}</strong>
            <small>{quote?.shipping_included ? 'Shipping included' : 'AUD'}</small>
          </div>
          <button className="archive-link" onClick={() => setDeleting(true)}>
            <Trash2 size={13} />
            Delete lead
          </button>
        </aside>
        <main className="detail-content" role="tabpanel">
          {tab === 'Overview' && (
            <>
              <div className="detail-intro">
                <span className="eyebrow">THE CUSTOMER, THE CAR, THE VISION</span>
                <h2>Let’s build something exceptional.</h2>
              </div>
              <section className="detail-section">
                <SectionHeading
                  title="Vehicle"
                  aside={
                    <button className="inline-link" onClick={editVehicle}>
                      <Edit3 size={13} />
                      Edit vehicle
                    </button>
                  }
                />
                <div className="vehicle-card">
                  <span className="vehicle-icon">
                    <Car size={32} strokeWidth={1.2} />
                  </span>
                  <div>
                    <h3>{vehicleName(vehicle)}</h3>
                    <p>
                      {vehicle?.year} {vehicle?.colour && `· ${vehicle.colour}`}
                    </p>
                    <span>
                      {vehicle?.suspension || 'Suspension to confirm'} ·{' '}
                      {vehicle?.brakes || 'Brakes to confirm'}
                    </span>
                  </div>
                </div>
              </section>
              <section className="detail-section">
                <SectionHeading
                  title="Enquiry notes"
                  aside={
                    <button
                      className="inline-link"
                      onClick={() =>
                        setEditor({
                          title: 'Enquiry details',
                          table: 'leads',
                          id: lead.id,
                          initial: asRecord(lead),
                          fields: [
                            {
                              name: 'priority',
                              label: 'Priority',
                              type: 'select',
                              options: ['Low', 'Normal', 'High'],
                              required: true,
                            },
                            {
                              name: 'handled_by',
                              label: 'Handled by',
                              type: 'select',
                              options: data.profiles.map((p) => ({
                                label: p.display_name,
                                value: p.id,
                              })),
                            },
                            {
                              name: 'source',
                              label: 'Lead source',
                              type: 'select',
                              options:
                                data.settings.find((s) => s.key === 'lead_sources')?.value ?? [],
                              required: true,
                            },
                            { name: 'notes', label: 'Notes', type: 'textarea' },
                          ],
                        })
                      }
                    >
                      <Edit3 size={13} />
                      Edit
                    </button>
                  }
                />
                <p className="note-text">
                  {lead.notes || 'No enquiry notes yet. Capture what matters to this customer.'}
                </p>
                {customer?.notes && (
                  <div className="customer-note">
                    <strong>Customer notes</strong>
                    <p>{customer.notes}</p>
                  </div>
                )}
              </section>
              <div className="quick-workflow">
                <button onClick={() => setTab('Wheel Specs')}>
                  <span>01</span>
                  <div>
                    <strong>Perfect the fitment</strong>
                    <small>{spec?.design || 'Add wheel specifications'}</small>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
                <button onClick={() => setTab('Quote')}>
                  <span>02</span>
                  <div>
                    <strong>Make it official</strong>
                    <small>
                      {quote
                        ? `${money(quoteTotal(quote))} · ${quote.status}`
                        : 'Create the first quote'}
                    </small>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
                <button onClick={() => setTab('Order')}>
                  <span>03</span>
                  <div>
                    <strong>Bring it to life</strong>
                    <small>{order?.stage || 'Record a deposit to start'}</small>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </>
          )}
          {tab === 'Wheel Specs' && (
            <>
              <SectionHeading
                title="Wheel specifications"
                aside={
                  <Button variant="secondary" onClick={editSpecs}>
                    <Edit3 size={14} />
                    {spec ? 'Edit specifications' : 'Add specifications'}
                  </Button>
                }
              />
              {spec ? (
                <>
                  <div className="spec-hero">
                    <div>
                      <span className="eyebrow">MONZA FORGED</span>
                      <h2>{spec.design || 'Design to confirm'}</h2>
                      <p>
                        {spec.construction} · {spec.finish || 'Finish to confirm'}
                      </p>
                    </div>
                    <span className="diameter">
                      {spec.diameter}
                      <small>INCH</small>
                    </span>
                  </div>
                  <div className="axle-grid">
                    <div>
                      <span>FRONT AXLE</span>
                      <h3>
                        {spec.diameter} × {spec.front_width}
                      </h3>
                      <p>
                        ET {spec.front_offset} · {spec.front_tyre || 'Tyres to confirm'}
                      </p>
                    </div>
                    <div>
                      <span>REAR AXLE</span>
                      <h3>
                        {spec.diameter} × {spec.rear_width}
                      </h3>
                      <p>
                        ET {spec.rear_offset} · {spec.rear_tyre || 'Tyres to confirm'}
                      </p>
                    </div>
                  </div>
                  <dl className="spec-grid">
                    {Object.entries(spec)
                      .filter(
                        ([k, v]) =>
                          ![
                            'id',
                            'lead_id',
                            'created_at',
                            'updated_at',
                            'design',
                            'diameter',
                            'construction',
                            'front_width',
                            'rear_width',
                            'front_offset',
                            'rear_offset',
                          ].includes(k) && v,
                      )
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt>{k.replaceAll('_', ' ')}</dt>
                          <dd>{String(v)}</dd>
                        </div>
                      ))}
                  </dl>
                </>
              ) : (
                <Empty
                  title="Designed around their drive."
                  description="Capture the design, staggered fitment, finishes and technical details."
                  action={
                    <Button onClick={editSpecs}>
                      <Plus size={15} />
                      Add wheel specifications
                    </Button>
                  }
                />
              )}
            </>
          )}
          {tab === 'Quote' && (
            <>
              <SectionHeading
                title="Quote"
                aside={
                  <Button variant="secondary" onClick={editQuote}>
                    <Edit3 size={14} />
                    {quote ? 'Revise quote' : 'Create quote'}
                  </Button>
                }
              />
              {quote ? (
                <>
                  <div className="quote-document">
                    <div className="quote-doc-header">
                      <MonzaLogo />
                      <div>
                        <strong>QUOTATION</strong>
                        <span>{quote.id.slice(-8).toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="quote-to">
                      <div>
                        <small>PREPARED FOR</small>
                        <strong>{name}</strong>
                        <span>{vehicleName(vehicle)}</span>
                      </div>
                      <div>
                        <Badge tone={quote.status === 'Accepted' ? 'green' : 'amber'}>
                          {quote.status}
                        </Badge>
                        <span>{dateInput(quote.quote_date)}</span>
                      </div>
                    </div>
                    <div className="quote-line">
                      <div>
                        <strong>{spec?.design || 'Custom forged wheels'}</strong>
                        <small>
                          {spec
                            ? `${spec.diameter}" · ${spec.construction} · ${spec.finish}`
                            : 'Set of four forged wheels'}
                        </small>
                      </div>
                      <strong>{money(Number(quote.base_price))}</strong>
                    </div>
                    <div className="quote-totals">
                      <p>
                        <span>Discount</span>
                        <strong>−{money(Number(quote.discount))}</strong>
                      </p>
                      <p>
                        <span>Shipping</span>
                        <strong>{quote.shipping_included ? 'Included' : 'Not included'}</strong>
                      </p>
                      <p className="final">
                        <span>Total quoted</span>
                        <strong>
                          {money(quoteTotal(quote))}
                          <small>AUD</small>
                        </strong>
                      </p>
                      <p>
                        <span>Deposit required</span>
                        <strong>{money(Number(quote.deposit_required))}</strong>
                      </p>
                      {order && (
                        <p>
                          <span>Order balance</span>
                          <strong>{money(order.final_price - orderPaid(data, order.id))}</strong>
                        </p>
                      )}
                    </div>
                    <div className="quote-notes">
                      <p>{quote.notes}</p>
                      {quote.expires_at && <small>Valid until {dateInput(quote.expires_at)}</small>}
                    </div>
                  </div>
                  <SectionHeading title="Revision history" />
                  <div className="revision-list">
                    {data.quote_revisions
                      .filter((r) => r.quote_id === quote.id)
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .map((r) => (
                        <div key={r.id}>
                          <History size={15} />
                          <span>
                            {money(
                              Number(r.previous_value.base_price) -
                                Number(r.previous_value.discount),
                            )}{' '}
                            <ArrowRight size={12} />{' '}
                            {money(Number(r.new_value.base_price) - Number(r.new_value.discount))}
                            <small>
                              {data.profiles.find((p) => p.id === r.actor_id)?.display_name ??
                                'System'}{' '}
                              · {new Date(r.created_at).toLocaleString('en-AU')}
                            </small>
                          </span>
                          <Badge>{String(r.new_value.status)}</Badge>
                        </div>
                      ))}
                  </div>
                  {!data.quote_revisions.some((r) => r.quote_id === quote.id) && (
                    <p className="muted small">
                      Original quote. Future revisions will appear here.
                    </p>
                  )}
                </>
              ) : (
                <Empty
                  title="A clear quote. A confident customer."
                  description="Set pricing, deposit requirements and terms in one place."
                  action={
                    <Button onClick={editQuote}>
                      <Plus size={15} />
                      Create quote
                    </Button>
                  }
                />
              )}
            </>
          )}
          {tab === 'Follow-Ups' && (
            <>
              <SectionHeading
                title="Follow-ups"
                aside={
                  <Button onClick={() => setFollow(true)}>
                    <Plus size={14} />
                    Add follow-up
                  </Button>
                }
              />
              <FollowList leadId={lead.id} />
            </>
          )}
          {tab === 'Order' && (
            <>
              <SectionHeading
                title="Order workspace"
                aside={
                  order && (
                    <Button variant="secondary" onClick={editOrder}>
                      <Edit3 size={14} />
                      Manage order
                    </Button>
                  )
                }
              />
              {order ? (
                <>
                  <div className="order-summary">
                    <Badge tone="blue">{order.stage}</Badge>
                    <span className="record-id">ORDER / {order.id.slice(-6).toUpperCase()}</span>
                    <div className="order-finances">
                      <div>
                        <span>Agreed sale price</span>
                        <strong>{money(Number(order.final_price))}</strong>
                      </div>
                      <div>
                        <span>Payments received</span>
                        <strong>{money(orderPaid(data, order.id))}</strong>
                      </div>
                      <div>
                        <span>Balance remaining</span>
                        <strong
                          className={
                            order.final_price - orderPaid(data, order.id) > 0 ? 'danger-text' : ''
                          }
                        >
                          {money(order.final_price - orderPaid(data, order.id))}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="order-progress">
                    {ORDER_STAGES.map((s, i) => (
                      <div
                        className={i <= ORDER_STAGES.indexOf(order.stage) ? 'reached' : ''}
                        key={s}
                      >
                        <span>
                          {i < ORDER_STAGES.indexOf(order.stage) ? <Check size={11} /> : i + 1}
                        </span>
                        <p>{s}</p>
                      </div>
                    ))}
                  </div>
                  <dl className="spec-grid">
                    {[
                      {
                        label: 'Supplier',
                        value: data.suppliers.find((s) => s.id === order.supplier_id)?.name,
                      },
                      { label: 'Supplier reference', value: order.supplier_reference },
                      {
                        label: 'Estimated completion',
                        value: dateInput(order.estimated_completion),
                      },
                      { label: 'Shipping provider', value: order.shipping_provider },
                      { label: 'Tracking number', value: order.tracking_number },
                      { label: 'Shipped', value: dateInput(order.shipped_at) },
                      { label: 'Expected delivery', value: dateInput(order.expected_delivery) },
                      { label: 'Delivered', value: dateInput(order.delivered_at) },
                    ].map((r) => (
                      <div key={r.label}>
                        <dt>{r.label}</dt>
                        <dd>{r.value || 'Not set'}</dd>
                      </div>
                    ))}
                  </dl>
                  <SectionHeading
                    title="Payments"
                    aside={
                      <Button variant="secondary" onClick={() => payment()}>
                        <Plus size={14} />
                        Record payment
                      </Button>
                    }
                  />
                  {data.payments
                    .filter((p) => p.order_id === order.id)
                    .map((p) => (
                      <div className="payment-row" key={p.id}>
                        <span className="payment-icon">
                          <Check size={15} />
                        </span>
                        <div>
                          <strong>{p.type}</strong>
                          <small>
                            {p.provider} · {dateInput(p.paid_at)} · {p.reference || 'No reference'}
                          </small>
                        </div>
                        <Badge tone={p.status === 'Paid' ? 'green' : 'neutral'}>{p.status}</Badge>
                        <strong>
                          {p.type === 'Refund' ? '−' : ''}
                          {money(Number(p.amount))}
                        </strong>
                        <button
                          className="icon-button"
                          aria-label="Edit payment record"
                          onClick={() => payment(p)}
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    ))}
                  <section className="detail-section">
                    <SectionHeading title="Order notes" />
                    <p className="note-text">{order.notes || 'No internal notes.'}</p>
                    {order.supplier_notes && (
                      <p className="note-text">Supplier: {order.supplier_notes}</p>
                    )}
                    {order.qc_notes && <p className="note-text">QC: {order.qc_notes}</p>}
                  </section>
                  <SectionHeading title="Order & customer timeline" />
                  <ActivityTimeline leadId={lead.id} />
                </>
              ) : (
                <Empty
                  title="From a vision to a set of wheels."
                  description={
                    quote
                      ? 'Record the deposit to create a linked order. All enquiry details stay intact.'
                      : 'Create a quote first, then record a deposit to start the order.'
                  }
                  action={
                    <Button onClick={() => (quote ? setDeposit(true) : setTab('Quote'))}>
                      {quote ? 'Record deposit & create order' : 'Go to quote'}
                      <ArrowRight size={15} />
                    </Button>
                  }
                />
              )}
            </>
          )}
          {tab === 'Files' && <Files leadId={lead.id} />}
          {tab === 'Activity' && (
            <>
              <SectionHeading title="Activity history" />
              <ActivityTimeline leadId={lead.id} />
            </>
          )}
        </main>
      </div>
      {editor && (
        <Modal title={editor.title} onClose={() => setEditor(null)}>
          <Form
            fields={editor.fields}
            initial={editor.initial}
            description={editor.description}
            onClose={() => setEditor(null)}
            onSubmit={async (values) => {
              const v = { ...values, ...editor.extra };
              ['handled_by', 'supplier_id'].forEach((k) => {
                if (k in v) v[k] = v[k] || null;
              });
              await mutate({ action: 'save', table: editor.table, id: editor.id, values: v });
            }}
          />
        </Modal>
      )}
      {follow && <FollowForm leadId={lead.id} onClose={() => setFollow(false)} />}{' '}
      {deposit && (
        <Modal
          title="Make it a Monza order."
          subtitle="Record the deposit and start the build."
          onClose={() => setDeposit(false)}
        >
          <Form
            fields={[
              { name: 'amount', label: 'Deposit received (AUD)', type: 'number', required: true },
              { name: 'reference', label: 'Payment reference' },
            ]}
            initial={{ amount: quote?.deposit_required ?? 0, reference: '' }}
            description={`Quote total: ${money(quoteTotal(quote))}. This records a payment you have already received; it does not charge the customer.`}
            onSubmit={async (v) => {
              await mutate({
                action: 'convert',
                lead_id: lead.id,
                amount: Number(v.amount),
                reference: String(v.reference),
              });
              setTab('Order');
            }}
            onClose={() => setDeposit(false)}
            submitLabel="Record deposit & create order"
          />
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Permanently delete this lead?"
          subtitle="This removes the enquiry, vehicle, follow-ups, quote, order, payments, files and history. This cannot be undone."
          onClose={() => setDeleting(false)}
        >
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                try {
                  await mutate({ action: 'delete_lead', id: lead.id });
                  setDeleting(false);
                  closeLead();
                } catch (e) {
                  notify(e instanceof Error ? e.message : 'Delete failed.');
                }
              }}
            >
              Delete permanently
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
