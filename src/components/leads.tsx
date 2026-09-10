'use client';
import { memo, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
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
  GripVertical,
  Sparkles,
  Trash2,
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
import { useCRM, useCRMActions } from './store';
import { Avatar, Badge, Button, Empty, Modal } from './ui';
import { fullName, vehicleName, money, quoteTotal, isLegacyFollowUpStage } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { dayKey } from '@/lib/analytics';
import { buildPipelineIndex, type PipelineCardData } from '@/lib/pipeline';
const columnTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Australia/Brisbane',
});
const fullTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'full',
  timeStyle: 'long',
  timeZone: 'Australia/Brisbane',
});
export function LeadList({
  onNew,
  onImport,
  navigate,
}: {
  onNew: () => void;
  onImport?: () => void;
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
        <div className="heading-actions">
          {onImport && (
            <Button variant="secondary" onClick={onImport}>
              <Sparkles size={15} /> Import leads
            </Button>
          )}
          <Button onClick={onNew}>
            <Plus size={16} /> New lead
          </Button>
        </div>
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
            {data.pipeline_stages
              .filter((s) => !isLegacyFollowUpStage(s.name))
              .map((s) => (
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
function TouchDial({
  label,
  value,
  tone,
  disabled,
  lastChanged,
  onChange,
}: {
  label: string;
  value: number;
  tone: 'follow' | 'call';
  disabled?: boolean;
  lastChanged?: string;
  onChange: (value: number) => void;
}) {
  const complete = value >= 3;
  return (
    <div className={`touch-dial ${tone}`}>
      <div className="dial-control">
        <svg viewBox="0 0 40 40" aria-label={`${label}: ${value} of 3 complete`}>
          <circle className="dial-track" cx="20" cy="20" r="15" pathLength="100" />
          {[1, 2, 3].map((step, index) => (
            <circle
              key={step}
              className={`dial-segment ${step <= value ? 'complete' : ''}`}
              cx="20"
              cy="20"
              r="15"
              pathLength="100"
              transform={`rotate(${-90 + index * 120} 20 20)`}
            />
          ))}
          <text x="20" y="22.5" textAnchor="middle">
            {value}/3
          </text>
        </svg>
        <button
          className="dial-button"
          type="button"
          disabled={disabled || complete}
          aria-label={complete ? `${label}: 3 of 3 recorded` : `Record call ${value + 1} of 3`}
          title={complete ? 'All 3 calls recorded' : `Record call ${value + 1} of 3`}
          onClick={() => onChange(Math.min(value + 1, 3))}
        />
      </div>
      <span className="dial-label">{label}</span>
      <div className="dial-timestamp" aria-live="polite">
        {lastChanged ? (
          <time
            dateTime={lastChanged}
            title={`Last clicked: ${new Date(lastChanged).toLocaleString('en-AU', {
              dateStyle: 'full',
              timeStyle: 'long',
              timeZone: 'Australia/Brisbane',
            })}`}
          >
            <span>Last clicked</span>
            <span>
              {new Date(lastChanged).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                timeZone: 'Australia/Brisbane',
                ...(dayKey(lastChanged).slice(0, 4) !== dayKey(new Date()).slice(0, 4)
                  ? { year: 'numeric' as const }
                  : {}),
              })}
            </span>
            <span>
              {new Date(lastChanged).toLocaleTimeString('en-AU', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'Australia/Brisbane',
              })}
            </span>
          </time>
        ) : (
          <span>No click recorded</span>
        )}
      </div>
    </div>
  );
}
const PipelineCard = memo(function PipelineCard({
  card,
  contactedStage,
  overlay = false,
}: {
  card: PipelineCardData;
  contactedStage?: string;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.lead.id,
    disabled: overlay,
  });
  const dragHandle = useMemo(
    () => (
      <button
        className="drag-handle"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${fullName(card.customer)}; use stage selector in lead for keyboard movement`}
      >
        <GripVertical size={14} />
      </button>
    ),
    [listeners, attributes, card.customer],
  );
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
      className={`kanban-card ${overlay ? 'drag-overlay' : ''}`}
    >
      <PipelineCardContent
        card={card}
        contactedStage={contactedStage}
        overlay={overlay}
        dragHandle={dragHandle}
      />
    </article>
  );
});
const PipelineCardContent = memo(function PipelineCardContent({
  card,
  contactedStage,
  overlay,
  dragHandle,
}: {
  card: PipelineCardData;
  contactedStage?: string;
  overlay: boolean;
  dragHandle: ReactNode;
}) {
  const { openLead, notify, mutate, busy } = useCRMActions();
  const { lead, enteredAt, customer: c, vehicle: v, quote: q, profile: p, follow: f } = card;
  const [updating, setUpdating] = useState<'call_step' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
  async function updateDial(field: 'call_step', value: number) {
    setUpdating(field);
    try {
      const contacted = field === 'call_step' && value > (lead.call_step ?? 0);
      await mutate({
        action: 'save',
        table: 'leads',
        id: lead.id,
        values: {
          [field]: value,
          ...(contacted ? { last_contacted: new Date().toISOString() } : {}),
          ...(contacted && !lead.last_contacted && contactedStage
            ? { stage_id: contactedStage }
            : {}),
        },
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to update progress.');
    } finally {
      setUpdating(null);
    }
  }
  return (
    <>
      <div className="kanban-top">
        <span className="source-label">{lead.source}</span>
        <div>
          {lead.priority === 'High' && <span className="priority-dot" title="High priority" />}
          {!overlay && (
            <button
              className="quick-delete"
              aria-label={`Delete ${fullName(c)}`}
              title="Delete lead"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={13} />
            </button>
          )}
          {dragHandle}
        </div>
      </div>
      <button className="kanban-name" onClick={() => openLead(lead.id)}>
        {fullName(c)}
        <ArrowUpRight size={14} />
      </button>
      <p className="kanban-vehicle">{vehicleName(v)}</p>
      <div className="kanban-column-time">
        <span>In column since</span>
        <time dateTime={enteredAt} title={fullTimeFormatter.format(new Date(enteredAt))}>
          {columnTimeFormatter.format(new Date(enteredAt))}
        </time>
      </div>
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
      <div className="touchpoint-dials">
        <div className="follow-up-progress">
          <strong>{lead.follow_up_step ?? 0}</strong>
          <span>follow-ups recorded</span>
        </div>
        <TouchDial
          label="Calls"
          tone="call"
          value={lead.call_step ?? 0}
          lastChanged={card.lastCall}
          disabled={overlay || busy || updating !== null}
          onChange={(value) => updateDial('call_step', value)}
        />
      </div>
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
      {deleteOpen && (
        <Modal
          title={`Permanently delete ${fullName(c)}?`}
          subtitle="This permanently removes this enquiry, its vehicle, follow-ups, quote, order, payments, files and history. This cannot be undone."
          onClose={() => setDeleteOpen(false)}
        >
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                try {
                  await mutate({ action: 'delete_lead', id: lead.id });
                  setDeleteOpen(false);
                } catch (error) {
                  notify(error instanceof Error ? error.message : 'Unable to delete lead.');
                }
              }}
            >
              <Trash2 size={14} /> Delete permanently
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
});
const Column = memo(function Column({
  id,
  name,
  colour,
  leads,
  contactedStage,
  onNew,
}: {
  id: string;
  name: string;
  colour: string;
  leads: PipelineCardData[];
  contactedStage?: string;
  onNew: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const total = useMemo(
    () => leads.reduce((sum, card) => sum + quoteTotal(card.quote), 0),
    [leads],
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
          <PipelineCard card={l} contactedStage={contactedStage} key={l.lead.id} />
        ))}
        {!leads.length && <div className="drop-empty">Drop a lead here</div>}
      </div>
    </section>
  );
});
export function Pipeline({
  onNew,
  navigate,
}: {
  onNew: () => void;
  navigate: (v: string) => void;
}) {
  const { data, mutate, notify } = useCRM();
  const index = useMemo(() => buildPipelineIndex(data), [data]);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('all');
  const [active, setActive] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const deferredQuery = useDeferredValue(query);
  const { leads, columns } = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    const leads = index.sorted.filter(
      (card) => (owner === 'all' || card.lead.handled_by === owner) && card.search.includes(search),
    );
    const groups = new Map<string, PipelineCardData[]>();
    for (const card of leads) {
      const group = groups.get(card.lead.stage_id);
      if (group) group.push(card);
      else groups.set(card.lead.stage_id, [card]);
    }
    const columns = [...data.pipeline_stages]
      .sort((a, b) => a.position - b.position)
      .filter((stage) => !isLegacyFollowUpStage(stage.name) && (terminal || !stage.is_terminal))
      .map((stage) => ({ stage, cards: groups.get(stage.id) ?? [] }));
    return { leads, columns };
  }, [index, deferredQuery, owner, terminal, data.pipeline_stages]);
  async function drop(e: DragEndEvent) {
    setActive(null);
    const lead = index.cards.get(String(e.active.id))?.lead;
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
        id="lead-pipeline"
        sensors={sensors}
        onDragStart={(e) => setActive(String(e.active.id))}
        onDragCancel={() => setActive(null)}
        onDragEnd={drop}
      >
        <div className="kanban-board">
          {columns.map(({ stage, cards }) => (
            <Column
              key={stage.id}
              id={stage.id}
              name={stage.name}
              colour={stage.colour}
              leads={cards}
              contactedStage={index.contactedStage}
              onNew={onNew}
            />
          ))}
        </div>
        <DragOverlay>
          {active && index.cards.has(active) ? (
            <PipelineCard
              card={index.cards.get(active)!}
              contactedStage={index.contactedStage}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="pipeline-hint">
        <GripVertical size={14} /> Drag the card handle to move a lead. You can also change stages
        inside any lead profile. Newest moves appear first in each column.
      </p>
    </div>
  );
}
