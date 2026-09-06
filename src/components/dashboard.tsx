'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  CreditCard,
  Flag,
  Plus,
  TrendingUp,
  Users,
  CircleDot,
  Package,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useCRM } from './store';
import { Avatar, Badge, Button, Empty, SectionHeading, TextLink } from './ui';
import { analytics, dayKey } from '@/lib/analytics';
import { money, fullName, vehicleName, orderPaid, isLegacyFollowUpStage } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
export function Dashboard({
  navigate,
  onNew,
  onImport,
}: {
  navigate: (v: string) => void;
  onNew: () => void;
  onImport?: () => void;
}) {
  const { data, userId, openLead } = useCRM();
  const a = analytics(data);
  const name = data.profiles.find((p) => p.id === userId)?.display_name ?? 'team';
  const [period, setPeriod] = useState('This month');
  const now = new Date();
  const periodStart =
    period === 'This month'
      ? new Date(`${dayKey(now).slice(0, 7)}-01T00:00:00+10:00`).getTime()
      : now.getTime() - (period === 'Last 7 days' ? 7 : 90) * 86400000;
  const duration = now.getTime() - periodStart;
  const periodPayments = data.payments.filter(
    (p) =>
      p.status === 'Paid' &&
      new Date(p.paid_at).getTime() >= periodStart &&
      new Date(p.paid_at).getTime() <= now.getTime(),
  );
  const periodRevenue = periodPayments.reduce(
    (s, p) => s + (p.type === 'Refund' ? -Number(p.amount) : Number(p.amount)),
    0,
  );
  const points = Array.from({ length: 12 }, (_, i) => {
    const start = periodStart + (i * duration) / 12;
    const end = start + duration / 12;
    return periodPayments
      .filter((p) => new Date(p.paid_at).getTime() >= start && new Date(p.paid_at).getTime() < end)
      .reduce((s, p) => s + (p.type === 'Refund' ? -Number(p.amount) : Number(p.amount)), 0);
  });
  const max = Math.max(...points, 1);
  const poly = points.map((v, i) => `${24 + i * 45},${116 - (v / max) * 80}`).join(' ');
  const pipeline = data.pipeline_stages
    .filter((s) => !s.is_terminal && !isLegacyFollowUpStage(s.name))
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ ...s, count: a.leads.filter((l) => l.stage_id === s.id).length }))
    .filter((s) => s.count);
  const metrics = [
    {
      label: 'Active enquiries',
      value: a.leads.filter(
        (l) => !data.pipeline_stages.find((s) => s.id === l.stage_id)?.is_terminal,
      ).length,
      icon: Users,
      sub: `${a.newLeads.length} new leads to connect with`,
      tone: 'blue',
    },
    {
      label: 'Open quote value',
      value: money(a.openValue),
      icon: TrendingUp,
      sub: `Across ${a.quotes.length} open quotes`,
      tone: 'green',
    },
    {
      label: 'Follow-ups due',
      value: a.due.length + a.overdue.length,
      icon: Clock3,
      sub: `${a.overdue.length} overdue · ${a.due.length} due today`,
      tone: 'amber',
    },
    {
      label: 'In production',
      value: a.production.length,
      icon: CircleDot,
      sub: `${a.ready.length} orders ready to ship`,
      tone: 'violet',
    },
  ];
  return (
    <div className="page dashboard">
      <div className="page-heading">
        <div className="eyebrow">
          <span className="live-dot" /> YOUR BUSINESS, IN MOTION
        </div>
        <div className="heading-row">
          <div>
            <h1>
              Good to see you, {name.split(' ')[0]}
              <span className="red-dot">.</span>
            </h1>
            <p>Here’s what’s happening at Monza today.</p>
          </div>
          <div className="heading-actions">
            <span className="date-label">
              {new Intl.DateTimeFormat('en-AU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Australia/Brisbane',
              }).format(now)}
            </span>
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
      </div>
      <div className="stats-grid">
        {metrics.map((m) => (
          <button
            key={m.label}
            className="stat-card"
            onClick={() =>
              navigate(
                m.label === 'Follow-ups due'
                  ? 'follow-ups'
                  : m.label === 'In production'
                    ? 'orders'
                    : 'leads',
              )
            }
          >
            <div className="stat-top">
              <span>{m.label}</span>
              <m.icon size={17} />
            </div>
            <div className="stat-value">
              {m.value}
              <ArrowUpRight size={19} />
            </div>
            <div className={`stat-foot ${m.tone}`}>
              <span className="tiny-dot" />
              {m.sub}
            </div>
          </button>
        ))}
      </div>
      <div className="dashboard-main">
        <section className="panel attention-panel">
          <SectionHeading
            title="Needs attention"
            aside={<TextLink onClick={() => navigate('follow-ups')}>View all</TextLink>}
          >
            <span className="count-label">{a.attention.length}</span>
          </SectionHeading>
          <div className="panel-subtitle">A few things to keep your day moving.</div>
          {a.attention.length ? (
            <div className="attention-list">
              {a.attention.slice(0, 5).map((item) => (
                <div className="attention-row" key={item.leadId}>
                  <Avatar name={item.name} />
                  <button className="person-button" onClick={() => openLead(item.leadId)}>
                    <strong>{item.name}</strong>
                    <span>{item.vehicle}</span>
                  </button>
                  <Badge tone={item.tone}>{item.reason}</Badge>
                  <button className="row-action" onClick={() => openLead(item.leadId, item.tab)}>
                    {item.action}
                    <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="All caught up" description="Your leads and orders are moving smoothly." />
          )}
          <div className="panel-bottom">
            <span>
              <span className="live-dot" /> Every detail. Nothing missed.
            </span>
            <button onClick={() => navigate('leads')}>
              Open leads <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </div>
      <div className="dashboard-secondary">
        <section className="panel revenue-panel">
          <SectionHeading
            title="Revenue overview"
            aside={
              <select
                aria-label="Revenue period"
                className="small-select"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>This month</option>
                <option>Last 7 days</option>
                <option>Last 90 days</option>
              </select>
            }
          />
          <div className="revenue-total">
            {money(periodRevenue)} <span>AUD</span>
          </div>
          <p className="muted small">Recorded payments, less refunds</p>
          <div className="chart">
            <div className="chart-labels">
              <span>{money(max)}</span>
              <span>{money(max / 2)}</span>
              <span>$0</span>
            </div>
            <svg
              viewBox="0 0 544 140"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Recorded revenue over ${period.toLowerCase()}: ${money(periodRevenue)}`}
            >
              <defs>
                <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#bc3a35" stopOpacity=".13" />
                  <stop offset="1" stopColor="#bc3a35" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[36, 76, 116].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="544"
                  y1={y}
                  y2={y}
                  stroke="#e9e9e6"
                  strokeDasharray="3 4"
                />
              ))}
              <polygon points={`24,128 ${poly} 519,128`} fill="url(#area)" />
              <polyline
                points={poly}
                fill="none"
                stroke="#bd3b35"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {points.map(
                (v, i) =>
                  v > 0 && (
                    <circle
                      key={i}
                      cx={24 + i * 45}
                      cy={116 - (v / max) * 80}
                      r="3"
                      fill="#bd3b35"
                    />
                  ),
              )}
            </svg>
          </div>
          <div className="chart-dates">
            <span>
              {new Date(periodStart).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span>Today</span>
          </div>
          <div className="revenue-footer">
            <div>
              <span>Deposits this month</span>
              <strong>{money(a.deposits)}</strong>
            </div>
            <div>
              <span>Lead conversion</span>
              <strong>{a.conversion}%</strong>
            </div>
            <div>
              <span>Delivered this month</span>
              <strong>{a.completed.length} orders</strong>
            </div>
          </div>
        </section>
        <section className="panel pipeline-summary">
          <SectionHeading
            title="Pipeline snapshot"
            aside={
              <button
                className="icon-button"
                aria-label="Open pipeline"
                onClick={() => navigate('pipeline')}
              >
                <ArrowUpRight size={17} />
              </button>
            }
          />
          <div className="snapshot-total">
            <strong>{a.leads.length}</strong>
            <span>leads in your pipeline</span>
          </div>
          <div className="segmented-bar">
            {pipeline.map((s) => (
              <div
                key={s.id}
                style={{ flex: s.count, background: s.colour }}
                title={`${s.name}: ${s.count}`}
              />
            ))}
          </div>
          <div className="pipeline-counts">
            {pipeline.slice(0, 6).map((s) => (
              <button key={s.id} onClick={() => navigate('pipeline')}>
                <span>
                  <i style={{ background: s.colour }} />
                  {s.name}
                </span>
                <b>{s.count}</b>
                <span className="micro-bar">
                  <i
                    style={{
                      width: `${(s.count / Math.max(...pipeline.map((s) => s.count))) * 100}%`,
                      background: s.colour,
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
          <button className="panel-link" onClick={() => navigate('pipeline')}>
            Go to pipeline <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <div className="dashboard-tertiary">
        <section className="panel">
          <SectionHeading
            title="Orders on the move"
            aside={<TextLink onClick={() => navigate('orders')}>All orders</TextLink>}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer / vehicle</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Order value</th>
                </tr>
              </thead>
              <tbody>
                {a.orders.slice(0, 4).map((o) => {
                  const l = data.leads.find((l) => l.id === o.lead_id),
                    c = data.customers.find((c) => c.id === l?.customer_id),
                    v = data.vehicles.find((v) => v.id === l?.vehicle_id);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => openLead(o.lead_id, 'Order')}
                      className="clickable"
                    >
                      <td>
                        <strong>{fullName(c)}</strong>
                        <small>{vehicleName(v)}</small>
                      </td>
                      <td>
                        <Badge
                          tone={
                            o.stage === 'In Production'
                              ? 'blue'
                              : o.stage === 'Balance Due'
                                ? 'amber'
                                : 'green'
                          }
                        >
                          {o.stage}
                        </Badge>
                      </td>
                      <td>{money(o.final_price - orderPaid(data, o.id))}</td>
                      <td className="number">{money(o.final_price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!a.orders.length && (
            <Empty
              title="Your first order starts here"
              description="Record a deposit on an accepted quote to create an order."
            />
          )}
        </section>
        <section className="panel activity-panel">
          <SectionHeading
            title="Recent activity"
            aside={<span className="small muted">Latest updates</span>}
          />
          <div className="activity-list">
            {[...data.activity_logs]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 4)
              .map((log) => {
                const lead = data.leads.find((l) => l.id === log.entity_id);
                const person =
                  data.profiles.find((p) => p.id === log.actor_id)?.display_name ?? 'System';
                return (
                  <button
                    key={log.id}
                    className="activity-item"
                    onClick={() => {
                      if (lead) openLead(lead.id);
                      else navigate('settings');
                    }}
                  >
                    <span className="activity-icon">
                      {log.action === 'created' ? <Plus size={13} /> : <ArrowUpRight size={13} />}
                    </span>
                    <div>
                      <p>
                        {String(
                          log.metadata.summary ??
                            `${log.entity.replaceAll('_', ' ')} ${log.action}`,
                        )}
                      </p>
                      <span>
                        {person} <i>·</i>{' '}
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </button>
                );
              })}
            {!data.activity_logs.length && <p className="muted">Your activity will appear here.</p>}
          </div>
        </section>
      </div>
      <div className="additional-metrics">
        {[
          { label: 'New leads', value: a.newLeads.length, icon: Users },
          { label: 'Balance payments due', value: a.balance.length, icon: CreditCard },
          { label: 'Ready to ship', value: a.ready.length, icon: Package },
          { label: 'Orders shipped', value: a.shipped.length, icon: Flag },
        ].map((m) => (
          <button
            key={m.label}
            onClick={() => navigate(m.label === 'New leads' ? 'leads' : 'orders')}
          >
            <m.icon size={16} />
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </button>
        ))}
      </div>
      <footer className="page-footer">
        <span>
          MONZA WHEELS <i>/</i> THE DETAILS MAKE THE DIFFERENCE.
        </span>
        <span>
          <span className="live-dot" /> All systems in your hands
        </span>
      </footer>
    </div>
  );
}
