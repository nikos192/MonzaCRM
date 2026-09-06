'use client';
import { useState } from 'react';
import {
  Search,
  Plus,
  ArrowUpRight,
  Clock3,
  Check,
  ShieldCheck,
  Users,
  Factory,
  Flag,
  Tag,
  Settings2,
  RotateCcw,
} from 'lucide-react';
import { useCRM } from './store';
import { Avatar, Badge, Button, Empty, Form, Modal, SectionHeading, type Field } from './ui';
import { FollowForm } from './lead-detail';
import { MonzaLogo } from './logo';
import {
  type FollowUp,
  type Supplier,
  type Stage,
  fullName,
  vehicleName,
  money,
  orderPaid,
  isLegacyFollowUpStage,
} from '@/lib/types';
import { dayKey, analytics } from '@/lib/analytics';
import { addDays } from 'date-fns';
export function FollowUps() {
  const { data, openLead, mutate, notify } = useCRM();
  const [selected, setSelected] = useState('All open');
  const [add, setAdd] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [edit, setEdit] = useState<FollowUp | null>(null);
  const today = dayKey(new Date()),
    tomorrow = dayKey(addDays(new Date(), 1));
  const follows = data.follow_ups.filter((f) =>
    data.leads.some((l) => l.id === f.lead_id && !l.archived_at),
  );
  const groups = [
    {
      name: 'Overdue',
      rows: follows.filter((f) => f.status === 'Open' && dayKey(f.due_at) < today),
      tone: 'red',
    },
    {
      name: 'Due today',
      rows: follows.filter((f) => f.status === 'Open' && dayKey(f.due_at) === today),
      tone: 'amber',
    },
    {
      name: 'Tomorrow',
      rows: follows.filter((f) => f.status === 'Open' && dayKey(f.due_at) === tomorrow),
      tone: 'blue',
    },
    {
      name: 'Upcoming',
      rows: follows.filter((f) => f.status === 'Open' && dayKey(f.due_at) > tomorrow),
      tone: 'neutral',
    },
    { name: 'Completed', rows: follows.filter((f) => f.status === 'Completed'), tone: 'green' },
  ];
  async function change(f: FollowUp, patch: Record<string, unknown>) {
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
          ...patch,
        },
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Unable to update.');
    }
  }
  return (
    <div className="page">
      <div className="heading-row page-heading">
        <div>
          <div className="eyebrow">NEVER LET A GOOD ENQUIRY GO QUIET</div>
          <h1>
            Follow-ups<span className="red-dot">.</span>
          </h1>
          <p>A little attention goes a long way.</p>
        </div>
        <Button onClick={() => setAdd(true)}>
          <Plus size={16} />
          New follow-up
        </Button>
      </div>
      <div className="follow-summary">
        {groups.slice(0, 4).map((g) => (
          <button
            className={selected === g.name ? 'selected' : ''}
            key={g.name}
            onClick={() => setSelected(selected === g.name ? 'All open' : g.name)}
          >
            <span className={g.tone}>
              <Clock3 size={16} />
              {g.name}
            </span>
            <strong>{g.rows.length}</strong>
          </button>
        ))}
      </div>
      <div className="filter-tabs">
        {['All open', 'Overdue', 'Due today', 'Tomorrow', 'Upcoming', 'Completed'].map((t) => (
          <button className={selected === t ? 'active' : ''} key={t} onClick={() => setSelected(t)}>
            {t}
          </button>
        ))}
      </div>
      {groups
        .filter((g) => (selected === 'All open' ? g.name !== 'Completed' : g.name === selected))
        .map((g) => (
          <section className="panel follow-group" key={g.name}>
            <SectionHeading title={g.name}>
              <span className={`count-label ${g.tone}`}>{g.rows.length}</span>
            </SectionHeading>
            {g.rows
              .sort((a, b) => a.due_at.localeCompare(b.due_at))
              .map((f) => {
                const l = data.leads.find((l) => l.id === f.lead_id),
                  c = data.customers.find((c) => c.id === l?.customer_id);
                return (
                  <div className="follow-row" key={f.id}>
                    <button
                      className="complete-button"
                      aria-label={
                        f.status === 'Completed' ? 'Reopen follow-up' : 'Complete follow-up'
                      }
                      onClick={() =>
                        change(f, { status: f.status === 'Completed' ? 'Open' : 'Completed' })
                      }
                    >
                      {f.status === 'Completed' && <Check size={14} />}
                    </button>
                    <Avatar name={fullName(c)} />
                    <div className="follow-info">
                      <button
                        className="person-button"
                        onClick={() => openLead(f.lead_id, 'Follow-Ups')}
                      >
                        <strong>{fullName(c)}</strong>
                      </button>
                      <p>
                        {f.type} · {f.notes}
                      </p>
                      <span className="muted small">
                        {new Date(f.due_at).toLocaleString('en-AU', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <div className="follow-actions">
                      {f.status !== 'Completed' && (
                        <button
                          onClick={() =>
                            change(f, { due_at: addDays(new Date(), 1).toISOString() })
                          }
                        >
                          Snooze 1 day
                        </button>
                      )}
                      <Button variant="secondary" onClick={() => setEdit(f)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            {!g.rows.length && (
              <div className="compact-empty">
                <Check size={16} /> Nothing {g.name.toLowerCase()}. You’re on track.
              </div>
            )}
          </section>
        ))}
      {add && (
        <Modal
          title="Choose a lead"
          subtitle="Who would you like to follow up with?"
          onClose={() => {
            setLeadId('');
            setAdd(false);
          }}
        >
          <div className="form-body">
            <label className="field">
              <span>Lead</span>
              <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">Select a customer…</option>
                {data.leads
                  .filter((l) => !l.archived_at)
                  .map((l) => (
                    <option value={l.id} key={l.id}>
                      {fullName(data.customers.find((c) => c.id === l.customer_id))} ·{' '}
                      {vehicleName(data.vehicles.find((v) => v.id === l.vehicle_id))}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="modal-footer">
            <Button disabled={!leadId} onClick={() => setAdd(false)}>
              Continue
            </Button>
          </div>
        </Modal>
      )}
      {!add && leadId && <FollowForm leadId={leadId} onClose={() => setLeadId('')} />}{' '}
      {edit && <FollowForm leadId={edit.lead_id} existing={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
export function Orders() {
  const { data, openLead } = useCRM();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All orders');
  const a = analytics(data);
  const rows = a.orders.filter((o) => {
    const l = data.leads.find((l) => l.id === o.lead_id),
      c = data.customers.find((c) => c.id === l?.customer_id);
    return (
      `${fullName(c)} ${o.supplier_reference} ${o.tracking_number} ${o.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'All orders' || o.stage === filter)
    );
  });
  return (
    <div className="page">
      <div className="heading-row page-heading">
        <div>
          <div className="eyebrow">CRAFTED TO ORDER. TRACKED TO DELIVERY.</div>
          <h1>
            Orders<span className="red-dot">.</span>
          </h1>
          <p>Every build, from deposit to the driveway.</p>
        </div>
        <Badge tone="green">{a.orders.length} total orders</Badge>
      </div>
      <div className="order-overview">
        {[
          { title: 'In production', value: a.production.length },
          {
            title: 'Balance outstanding',
            value: money(
              a.orders.reduce((s, o) => s + Math.max(0, o.final_price - orderPaid(data, o.id)), 0),
            ),
          },
          { title: 'Ready to ship', value: a.ready.length },
          { title: 'Delivered this month', value: a.completed.length },
        ].map((m) => (
          <div key={m.title}>
            <span>{m.title}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              placeholder="Search customers, orders, supplier refs or tracking…"
              aria-label="Search orders"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Order stage filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {['All orders', ...new Set(data.orders.map((o) => o.stage))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order / customer</th>
                <th>Wheel setup</th>
                <th>Status</th>
                <th>Completion</th>
                <th>Balance</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const l = data.leads.find((l) => l.id === o.lead_id),
                  c = data.customers.find((c) => c.id === l?.customer_id),
                  w = data.wheel_specs.find((w) => w.lead_id === o.lead_id);
                return (
                  <tr key={o.id}>
                    <td>
                      <button
                        className="customer-cell"
                        onClick={() => openLead(o.lead_id, 'Order')}
                      >
                        <Avatar name={fullName(c)} />
                        <span>
                          <strong>{fullName(c)}</strong>
                          <small>{o.supplier_reference || `MZ-${o.id.slice(-6)}`}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <strong>{w?.design ?? 'Custom forged'}</strong>
                      <small>{w ? `${w.diameter}" · ${w.finish}` : 'Specs pending'}</small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          o.stage === 'Balance Due'
                            ? 'amber'
                            : o.stage === 'Delivered'
                              ? 'green'
                              : 'blue'
                        }
                      >
                        {o.stage}
                      </Badge>
                    </td>
                    <td>
                      {o.estimated_completion
                        ? new Date(o.estimated_completion).toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : 'To confirm'}
                    </td>
                    <td
                      className={
                        o.final_price - orderPaid(data, o.id) > 0 ? 'danger-text number' : 'number'
                      }
                    >
                      {money(o.final_price - orderPaid(data, o.id))}
                    </td>
                    <td className="number">{money(Number(o.final_price))}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${fullName(c)} order`}
                        onClick={() => openLead(o.lead_id, 'Order')}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="Ready for your next build."
            description="Record a deposit in a lead profile to create its order."
          />
        )}
        <div className="table-footer">
          <span>{rows.length} orders</span>
          <span>Payments are business records · AUD</span>
        </div>
      </section>
    </div>
  );
}
export function Customers() {
  const { data, openLead } = useCRM();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const customers = data.customers.filter(
    (c) =>
      !c.archived_at &&
      `${fullName(c)} ${c.email} ${c.phone} ${c.instagram}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const current = data.customers.find((c) => c.id === selected);
  const leads = data.leads.filter((l) => l.customer_id === selected);
  const orders = data.orders.filter((o) => leads.some((l) => l.id === o.lead_id));
  return (
    <div className="page">
      <div className="heading-row page-heading">
        <div>
          <div className="eyebrow">MORE THAN A SINGLE SET OF WHEELS</div>
          <h1>
            Customers<span className="red-dot">.</span>
          </h1>
          <p>The people behind every build. The history behind every connection.</p>
        </div>
        <Badge>{customers.length} customers</Badge>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search customers"
              placeholder="Search names, emails, phone numbers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="customer-grid">
          {customers.map((c) => {
            const ls = data.leads.filter((l) => l.customer_id === c.id),
              os = data.orders.filter((o) => ls.some((l) => l.id === o.lead_id));
            return (
              <button className="customer-card" key={c.id} onClick={() => setSelected(c.id)}>
                <div>
                  <Avatar name={fullName(c)} />
                  <ArrowUpRight size={16} />
                </div>
                <h3>{fullName(c)}</h3>
                <p>{c.location || 'Location not set'}</p>
                <span>{c.email || c.phone || c.instagram}</span>
                <div className="customer-card-stats">
                  <span>
                    {data.vehicles.filter((v) => v.customer_id === c.id).length} vehicles ·{' '}
                    {os.length} orders
                  </span>
                  <strong>{money(os.reduce((s, o) => s + orderPaid(data, o.id), 0))}</strong>
                </div>
              </button>
            );
          })}
        </div>
        {!customers.length && (
          <Empty
            title="Your community starts here."
            description="Customers are created when you add a lead."
          />
        )}
      </section>
      {current && (
        <Modal
          title={fullName(current)}
          subtitle="Customer history"
          wide
          onClose={() => setSelected(null)}
        >
          <div className="customer-profile">
            <div className="customer-profile-summary">
              <Avatar name={fullName(current)} size="large" />
              <div>
                <h3>{fullName(current)}</h3>
                <p>
                  {current.location} · {current.preferred_contact}
                </p>
                <a href={`mailto:${current.email}`}>{current.email}</a>
                <a href={`tel:${current.phone}`}>{current.phone}</a>
              </div>
              <div>
                <span>Lifetime net payments</span>
                <strong>{money(orders.reduce((s, o) => s + orderPaid(data, o.id), 0))}</strong>
              </div>
            </div>
            <p className="note-text">{current.notes || 'No customer notes.'}</p>
            <SectionHeading title="Garage" />
            <div className="garage-grid">
              {data.vehicles
                .filter((v) => v.customer_id === current.id)
                .map((v) => (
                  <div key={v.id}>
                    <strong>{vehicleName(v)}</strong>
                    <span>
                      {v.year} · {v.colour || 'Colour not set'}
                    </span>
                  </div>
                ))}
            </div>
            <SectionHeading title="Enquiries & orders" />
            {leads.map((l) => (
              <button
                className="customer-history-row"
                key={l.id}
                onClick={() => {
                  setSelected(null);
                  openLead(l.id);
                }}
              >
                <div>
                  <strong>{vehicleName(data.vehicles.find((v) => v.id === l.vehicle_id))}</strong>
                  <span>
                    {new Date(l.created_at).toLocaleDateString('en-AU')} · {l.source}
                    {l.archived_at ? ' · Archived' : ''}
                  </span>
                </div>
                <Badge>{data.pipeline_stages.find((s) => s.id === l.stage_id)?.name}</Badge>
                <span>{data.orders.find((o) => o.lead_id === l.id)?.stage ?? 'Enquiry'}</span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            <p className="muted small">
              Open an enquiry to edit contact details and view its conversations, files, payments
              and full activity history.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Settings() {
  const { data, demo, mutate, resetDemo } = useCRM();
  const [tab, setTab] = useState('General');
  const [edit, setEdit] = useState<{
    title: string;
    table: string;
    id?: string;
    initial: Record<string, unknown>;
    fields: Field[];
  } | null>(null);
  const [reset, setReset] = useState(false);
  const [options, setOptions] = useState<{ id: string; key: string; value: string } | null>(null);
  const tabs = [
    { name: 'General', icon: Settings2 },
    { name: 'Users', icon: Users },
    { name: 'Pipeline stages', icon: Flag },
    { name: 'Lead sources', icon: Tag },
    { name: 'Follow-up types', icon: Clock3 },
    { name: 'Suppliers', icon: Factory },
  ];
  function supplier(s?: Supplier) {
    setEdit({
      title: s ? 'Edit supplier' : 'Add supplier',
      table: 'suppliers',
      id: s?.id,
      initial: s ? { ...s } : { production_days: 35 },
      fields: [
        { name: 'name', label: 'Supplier name', required: true },
        { name: 'contact', label: 'Contact person' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        { name: 'social', label: 'WeChat / WhatsApp' },
        { name: 'production_days', label: 'Typical production time (days)', type: 'number' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
        { name: 'shipping_notes', label: 'Shipping notes', type: 'textarea' },
      ],
    });
  }
  function stage(s?: Stage) {
    setEdit({
      title: s ? 'Edit pipeline stage' : 'Add pipeline stage',
      table: 'pipeline_stages',
      id: s?.id,
      initial: s
        ? { ...s }
        : { position: data.pipeline_stages.length, colour: '#668aaa', is_terminal: false },
      fields: [
        { name: 'name', label: 'Stage name', required: true },
        { name: 'position', label: 'Sort position (lowest first)', type: 'number', required: true },
        { name: 'colour', label: 'Colour', type: 'colour' },
        { name: 'is_terminal', label: 'Closed stage (completed or lost)', type: 'checkbox' },
      ],
    });
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div className="eyebrow">YOUR WORKSPACE, YOUR WAY</div>
        <h1>
          Settings<span className="red-dot">.</span>
        </h1>
        <p>Keep Monza working the way you do.</p>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map((t) => (
            <button
              className={tab === t.name ? 'active' : ''}
              key={t.name}
              onClick={() => setTab(t.name)}
            >
              <t.icon size={16} />
              {t.name}
            </button>
          ))}
        </nav>
        <section className="panel settings-content">
          <SectionHeading
            title={tab}
            aside={
              tab === 'Suppliers' ? (
                <Button onClick={() => supplier()}>
                  <Plus size={14} />
                  Add supplier
                </Button>
              ) : tab === 'Pipeline stages' ? (
                <Button onClick={() => stage()}>
                  <Plus size={14} />
                  Add stage
                </Button>
              ) : null
            }
          />
          {tab === 'General' && (
            <>
              <div className="settings-brand">
                <MonzaLogo />
                <Badge tone={demo ? 'amber' : 'green'}>
                  {demo ? 'Development demo' : 'Private workspace'}
                </Badge>
              </div>
              <dl className="settings-properties">
                <dt>Workspace</dt>
                <dd>Monza Wheels CRM</dd>
                <dt>Currency</dt>
                <dd>AUD — Australian dollar</dd>
                <dt>Reporting timezone</dt>
                <dd>Australia/Brisbane</dd>
                <dt>Customer messaging</dt>
                <dd>Handled externally</dd>
                <dt>Payments</dt>
                <dd>Business records only · no card processing</dd>
                <dt>Files</dt>
                <dd>Private storage · signed download links</dd>
              </dl>
              {demo && (
                <div className="settings-callout">
                  <div>
                    <h3>Explore with a clean slate.</h3>
                    <p>
                      Restore the fictional example customers and discard your local demo changes.
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setReset(true)}>
                    <RotateCcw size={14} />
                    Reset demo
                  </Button>
                </div>
              )}
            </>
          )}
          {tab === 'Users' && (
            <>
              <div className="form-info">
                <ShieldCheck size={18} /> Approved users have equal access. Account approval is
                managed securely in Supabase, outside the browser.
              </div>
              {data.profiles.map((p) => (
                <div className="user-setting" key={p.id}>
                  <Avatar name={p.display_name} />
                  <div>
                    <strong>{p.display_name}</strong>
                    <span>Account profile · approval checked at login and by RLS</span>
                  </div>
                  <Badge>Equal access when approved</Badge>
                </div>
              ))}
              <p className="muted small">
                Profiles alone do not grant access. Use the approval query in the README to activate
                or revoke an account.
              </p>
            </>
          )}
          {tab === 'Pipeline stages' && (
            <>
              <p className="muted small">
                Edit a stage’s sort position to reorder it. Existing leads retain their stage when
                its name changes.
              </p>
              {[...data.pipeline_stages]
                .sort((a, b) => a.position - b.position)
                .filter((s) => !isLegacyFollowUpStage(s.name))
                .map((s) => (
                  <button className="stage-setting" key={s.id} onClick={() => stage(s)}>
                    <span className="stage-position">
                      {String(s.position + 1).padStart(2, '0')}
                    </span>
                    <i style={{ background: s.colour }} />
                    <strong>{s.name}</strong>
                    {s.is_terminal && <Badge>Closed</Badge>}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
            </>
          )}
          {(tab === 'Lead sources' || tab === 'Follow-up types') &&
            (() => {
              const setting = data.settings.find(
                (s) => s.key === (tab === 'Lead sources' ? 'lead_sources' : 'follow_up_types'),
              );
              return (
                <>
                  <p className="muted small">
                    These options appear when creating or editing records. Existing record values
                    are preserved.
                  </p>
                  <div className="setting-tags">
                    {setting?.value.map((v) => (
                      <Badge key={v}>{v}</Badge>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (setting)
                        setOptions({
                          id: setting.id,
                          key: setting.key,
                          value: setting.value.join('\n'),
                        });
                    }}
                  >
                    Edit options
                  </Button>
                </>
              );
            })()}
          {tab === 'Suppliers' && (
            <>
              {data.suppliers.map((s) => (
                <button className="supplier-setting" key={s.id} onClick={() => supplier(s)}>
                  <Factory size={24} />
                  <div>
                    <strong>{s.name}</strong>
                    <span>
                      {s.contact} · {s.production_days} day typical production
                    </span>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))}
              {!data.suppliers.length && (
                <Empty
                  title="Add your production partner"
                  description="Keep supplier contacts and lead times close to every order."
                />
              )}
            </>
          )}
        </section>
      </div>
      {edit && (
        <Modal title={edit.title} onClose={() => setEdit(null)}>
          <Form
            fields={edit.fields}
            initial={edit.initial}
            onClose={() => setEdit(null)}
            onSubmit={async (v) => {
              await mutate({ action: 'save', table: edit.table, id: edit.id, values: v });
            }}
          />
        </Modal>
      )}
      {options && (
        <Modal
          title="Edit options"
          subtitle="One option per line. Renaming does not change historical records."
          onClose={() => setOptions(null)}
        >
          <Form
            fields={[{ name: 'value', label: 'Options', type: 'textarea', required: true }]}
            initial={{ value: options.value }}
            onClose={() => setOptions(null)}
            onSubmit={async (v) => {
              await mutate({
                action: 'save',
                table: 'settings',
                id: options.id,
                values: {
                  key: options.key,
                  value: Array.from(
                    new Set(
                      String(v.value)
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    ),
                  ),
                },
              });
            }}
          />
        </Modal>
      )}
      {reset && (
        <Modal
          title="Reset the demo?"
          subtitle="This removes your demo changes from this browser and restores the example records."
          onClose={() => setReset(false)}
        >
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setReset(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                resetDemo();
                setReset(false);
              }}
            >
              Reset demo
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
