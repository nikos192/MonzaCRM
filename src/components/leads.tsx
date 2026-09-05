'use client';
import { useState } from 'react';
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownUp,
  LayoutList,
  Columns3,
  MessageSquare,
  Clock3,
  Phone,
  Mail,
  Check,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useCRM } from './store';
import { Avatar, Badge, Button, Empty } from './ui';
import { fullName, vehicleName, money, quoteTotal, type Lead } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { dayKey } from '@/lib/analytics';
export function LeadList({
  onNew,
  navigate,
}: {
  onNew: () => void;
  navigate: (v: string) => void;
}) {
  const { data, openLead } = useCRM();
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState(false);
  const rows = data.leads
    .filter((l) => !l.archived_at)
    .filter((l) => {
      const c = data.customers.find((c) => c.id === l.customer_id),
        v = data.vehicles.find((v) => v.id === l.vehicle_id);
      return (
        `${fullName(c)} ${c?.email} ${c?.phone} ${c?.instagram} ${vehicleName(v)} ${l.id}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (stage === 'all' || l.stage_id === stage) &&
        (source === 'all' || l.source === source)
      );
    })
    .sort((a, b) =>
      sort ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at),
    );
  return (
    <div className="page">
      <div className="heading-row page-heading">
        <div>
          <div className="eyebrow">EVERY GREAT BUILD STARTS HERE</div>
          <h1>
            Leads<span className="red-dot">.</span>
          </h1>
          <p>Your next customers, all in one place.</p>
        </div>
        <Button onClick={onNew}>
          <Plus size={16} /> New lead
        </Button>
      </div>
      <div className="panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              placeholder="Search customers, vehicles, contact details…"
              aria-label="Search leads"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">All stages</option>
            {data.pipeline_stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All sources</option>
            {Array.from(new Set(data.leads.map((l) => l.source))).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            className="icon-button"
            onClick={() => setSort(!sort)}
            aria-label="Reverse date sorting"
          >
            <ArrowDownUp size={16} />
          </button>
          <div className="view-toggle">
            <button className="active" aria-label="List view">
              <LayoutList size={16} />
            </button>
            <button aria-label="Pipeline view" onClick={() => navigate('pipeline')}>
              <Columns3 size={16} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Stage</th>
                <th>Quote</th>
                <th>Source</th>
                <th>Next follow-up</th>
                <th>Handled by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const c = data.customers.find((c) => c.id === l.customer_id),
                  v = data.vehicles.find((v) => v.id === l.vehicle_id),
                  s = data.pipeline_stages.find((s) => s.id === l.stage_id),
                  q = data.quotes.find((q) => q.lead_id === l.id),
                  f = data.follow_ups
                    .filter((f) => f.lead_id === l.id && f.status === 'Open')
                    .sort((a, b) => a.due_at.localeCompare(b.due_at))[0],
                  p = data.profiles.find((p) => p.id === l.handled_by);
                return (
                  <tr key={l.id}>
                    <td>
                      <button className="customer-cell" onClick={() => openLead(l.id)}>
                        <Avatar name={fullName(c)} />
                        <span>
                          <strong>
                            {fullName(c)}
                            {l.priority === 'High' && (
                              <i className="priority-dot" title="High priority" />
                            )}
                          </strong>
                          <small>{c?.email || c?.phone || c?.instagram}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <strong>
                        {v?.make} {v?.model}
                      </strong>
                      <small>
                        {v?.year} · {v?.chassis}
                      </small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          s?.name === 'New Lead'
                            ? 'blue'
                            : s?.is_terminal
                              ? 'green'
                              : s?.name === 'Quote Sent'
                                ? 'amber'
                                : 'neutral'
                        }
                      >
                        {s?.name}
                      </Badge>
                    </td>
                    <td className="number">{q ? money(quoteTotal(q)) : '—'}</td>
                    <td>
                      <span className="source-label">{l.source}</span>
                    </td>
                    <td>
                      {f ? (
                        <span
                          className={dayKey(f.due_at) < dayKey(new Date()) ? 'danger-text' : ''}
                        >
                          {new Date(f.due_at).toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      ) : (
                        <span className="muted">Not scheduled</span>
                      )}
                    </td>
                    <td>
                      <span className="assignee">
                        <Avatar name={p?.display_name ?? 'Unassigned'} size="small" />
                        {p?.display_name ?? 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${fullName(c)}`}
                        onClick={() => openLead(l.id)}
                      >
                        <ArrowUpRight size={17} />
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
            title="No leads found"
            description="Try another search, or start a new connection."
            action={
              <Button onClick={onNew}>
                <Plus size={15} />
                Create lead
              </Button>
            }
          />
        )}
        <div className="table-footer">
          <span>{rows.length} leads</span>
          <span>All values in AUD</span>
        </div>
      </div>
    </div>
  );
}
function PipelineCard({ lead, overlay = false }: { lead: Lead; overlay?: boolean }) {
  const { data, openLead, notify, mutate } = useCRM();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: overlay,
  });
  const c = data.customers.find((c) => c.id === lead.customer_id),
    v = data.vehicles.find((v) => v.id === lead.vehicle_id),
    q = data.quotes.find((q) => q.lead_id === lead.id),
    p = data.profiles.find((p) => p.id === lead.handled_by),
    f = data.follow_ups
      .filter((f) => f.lead_id === lead.id && f.status === 'Open')
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
  const overdue = f && dayKey(f.due_at) < dayKey(new Date());
  async function copy(value: string | undefined) {
    if (!value) {
      notify('No contact detail saved yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      notify('Copied to clipboard.');
    } catch {
      notify('Clipboard unavailable. Open the lead to copy the detail.');
    }
  }
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
      className={`kanban-card ${overlay ? 'drag-overlay' : ''}`}
    >
      <div className="kanban-top">
        <span className="source-label">{lead.source}</span>
        <div>
          {lead.priority === 'High' && <span className="priority-dot" title="High priority" />}
          <button
            className="drag-handle"
            {...listeners}
            {...attributes}
            aria-label={`Drag ${fullName(c)}; use stage selector in lead for keyboard movement`}
          >
            <GripVertical size={14} />
          </button>
        </div>
      </div>
      <button className="kanban-name" onClick={() => openLead(lead.id)}>
        {fullName(c)}
        <ArrowUpRight size={14} />
      </button>
      <p className="kanban-vehicle">{vehicleName(v)}</p>
      <div className="kanban-quote">
        <strong>{q ? money(quoteTotal(q)) : 'Quote pending'}</strong>
        <Avatar name={p?.display_name ?? 'Unassigned'} size="small" />
      </div>
      {f && (
        <button
          className={`follow-chip ${overdue ? 'overdue' : ''}`}
          onClick={() => openLead(lead.id, 'Follow-Ups')}
        >
          <Clock3 size={12} />
          {overdue
            ? 'Follow-up overdue'
            : `Follow up ${new Date(f.due_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
        </button>
      )}
      <div className="kanban-bottom">
        <span>
          {lead.last_contacted
            ? formatDistanceToNow(new Date(lead.last_contacted), { addSuffix: true })
            : 'Not contacted'}
        </span>
        <button
          aria-label="Add follow-up"
          title="Add follow-up"
          onClick={() => openLead(lead.id, 'Follow-Ups')}
        >
          <Clock3 size={13} />
        </button>
        <button
          aria-label="Add note"
          title="Add note"
          onClick={() => openLead(lead.id, 'Overview')}
        >
          <MessageSquare size={13} />
        </button>
        <button aria-label="Copy phone" title="Copy phone" onClick={() => copy(c?.phone)}>
          <Phone size={13} />
        </button>
        <button aria-label="Copy email" title="Copy email" onClick={() => copy(c?.email)}>
          <Mail size={13} />
        </button>
      </div>
      <button
        className="mark-contacted"
        onClick={async () => {
          try {
            const s = data.pipeline_stages.find((s) => s.name === 'Contacted');
            await mutate({
              action: 'save',
              table: 'leads',
              id: lead.id,
              values: {
                last_contacted: new Date().toISOString(),
                ...(!lead.last_contacted && s ? { stage_id: s.id } : {}),
              },
            });
          } catch (e) {
            notify(e instanceof Error ? e.message : 'Unable to update');
          }
        }}
      >
        <Check size={12} /> Mark contacted
      </button>
    </article>
  );
}
function Column({
  id,
  name,
  colour,
  leads,
  onNew,
}: {
  id: string;
  name: string;
  colour: string;
  leads: Lead[];
  onNew: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const { data } = useCRM();
  const total = leads.reduce(
    (sum, l) => sum + quoteTotal(data.quotes.find((q) => q.lead_id === l.id)),
    0,
  );
  return (
    <section
      aria-label={name}
      className={`kanban-column ${isOver ? 'drag-over' : ''}`}
      ref={setNodeRef}
    >
      <header>
        <span>
          <i style={{ background: colour }} />
          {name}
          <b>{leads.length}</b>
        </span>
        <button aria-label={`Add a lead`} onClick={onNew}>
          <Plus size={15} />
        </button>
      </header>
      <div className="column-value">{money(total)}</div>
      <div className="kanban-cards">
        {leads.map((l) => (
          <PipelineCard lead={l} key={l.id} />
        ))}
        {!leads.length && <div className="drop-empty">Drop a lead here</div>}
      </div>
    </section>
  );
}
export function Pipeline({
  onNew,
  navigate,
}: {
  onNew: () => void;
  navigate: (v: string) => void;
}) {
  const { data, mutate, notify } = useCRM();
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('all');
  const [active, setActive] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const leads = data.leads.filter(
    (l) =>
      !l.archived_at &&
      (owner === 'all' || l.handled_by === owner) &&
      `${fullName(data.customers.find((c) => c.id === l.customer_id))} ${vehicleName(data.vehicles.find((v) => v.id === l.vehicle_id))}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function drop(e: DragEndEvent) {
    setActive(null);
    const lead = data.leads.find((l) => l.id === e.active.id);
    if (!lead || !e.over || lead.stage_id === e.over.id) return;
    try {
      await mutate({
        action: 'save',
        table: 'leads',
        id: lead.id,
        values: { stage_id: String(e.over.id) },
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Stage change failed.');
    }
  }
  return (
    <div className="page pipeline-page">
      <div className="heading-row page-heading">
        <div>
          <div className="eyebrow">FROM ENQUIRY TO EXTRAORDINARY</div>
          <h1>
            Sales pipeline<span className="red-dot">.</span>
          </h1>
          <p>A clear view of every conversation in motion.</p>
        </div>
        <Button onClick={onNew}>
          <Plus size={16} /> New lead
        </Button>
      </div>
      <div className="pipeline-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search pipeline"
            placeholder="Find a customer or vehicle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="all">Everyone</option>
          {data.profiles.map((p) => (
            <option value={p.id} key={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={terminal}
            onChange={(e) => setTerminal(e.target.checked)}
          />{' '}
          Show closed
        </label>
        <span className="muted small">{leads.length} leads</span>
        <Button variant="secondary" onClick={() => navigate('leads')}>
          <LayoutList size={15} /> List view
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActive(String(e.active.id))}
        onDragCancel={() => setActive(null)}
        onDragEnd={drop}
      >
        <div className="kanban-board">
          {[...data.pipeline_stages]
            .sort((a, b) => a.position - b.position)
            .filter((s) => terminal || !s.is_terminal)
            .map((s) => (
              <Column
                key={s.id}
                id={s.id}
                name={s.name}
                colour={s.colour}
                leads={leads.filter((l) => l.stage_id === s.id)}
                onNew={onNew}
              />
            ))}
        </div>
        <DragOverlay>
          {active && data.leads.find((l) => l.id === active) ? (
            <PipelineCard lead={data.leads.find((l) => l.id === active)!} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="pipeline-hint">
        <GripVertical size={14} /> Drag the card handle to move a lead. You can also change stages
        inside any lead profile.
      </p>
    </div>
  );
}
