'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UsersRound,
  Columns3,
  Clock3,
  Package,
  ContactRound,
  Settings as SettingsIcon,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  Menu,
  LogOut,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { type Data, fullName, vehicleName } from '@/lib/types';
import { analytics } from '@/lib/analytics';
import { Provider, useCRM } from './store';
import { Avatar, Button, Empty, Modal } from './ui';
import { Dashboard } from './dashboard';
import { LeadList, Pipeline } from './leads';
import { LeadCreate } from './lead-create';
import { LeadImport } from './lead-import';
import { LeadDetail } from './lead-detail';
import { FollowUps, Orders, Customers, Settings } from './screens';
const navigation = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'leads', label: 'Leads', icon: UsersRound },
  { key: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { key: 'follow-ups', label: 'Follow-ups', icon: Clock3 },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'customers', label: 'Customers', icon: ContactRound },
];
export function Workspace({
  data,
  userId,
  demo = false,
  section = 'dashboard',
}: {
  data: Data;
  userId: string;
  demo?: boolean;
  section?: string;
}) {
  return (
    <Provider initial={data} userId={userId} demo={demo}>
      <Shell initialSection={section} />
    </Provider>
  );
}
function Shell({ initialSection }: { initialSection: string }) {
  const { data, demo, userId, selected, openLead, notify } = useCRM();
  const router = useRouter();
  const validSection = (value: string) =>
    navigation.some((item) => item.key === value) || value === 'settings' ? value : 'dashboard';
  const [section, setSection] = useState(validSection(initialSection));
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [newLead, setNewLead] = useState(false);
  const [importLeads, setImportLeads] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [account, setAccount] = useState(false);
  const a = analytics(data);
  const name = data.profiles.find((p) => p.id === userId)?.display_name ?? 'Monza team';
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    function pop() {
      const url = new URL(window.location.href);
      setSection(
        demo
          ? validSection(url.searchParams.get('view') ?? 'dashboard')
          : validSection(url.pathname.split('/')[1] || 'dashboard'),
      );
    }
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [demo]);
  function navigate(v: string) {
    setSection(v);
    setMobile(false);
    setNotifications(false);
    const url = demo
      ? `/demo${v === 'dashboard' ? '' : `?view=${v}`}`
      : v === 'dashboard'
        ? '/'
        : `/${v}`;
    window.history.pushState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const title = navigation.find((n) => n.key === section)?.label ?? 'Settings';
  const results = data.leads
    .map((l) => {
      const c = data.customers.find((c) => c.id === l.customer_id),
        v = data.vehicles.find((v) => v.id === l.vehicle_id),
        o = data.orders.find((o) => o.lead_id === l.id);
      return {
        lead: l,
        customer: c,
        vehicle: v,
        order: o,
        text: `${fullName(c)} ${c?.phone} ${c?.email} ${c?.instagram} ${vehicleName(v)} ${v?.registration} ${l.id} ${o?.id} ${o?.tracking_number} ${o?.supplier_reference}`,
      };
    })
    .filter((r) => r.text.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <a
          className="brand"
          href={demo ? '/demo' : '/'}
          onClick={(e) => {
            e.preventDefault();
            navigate('dashboard');
          }}
        >
          <span className="brand-symbol">Ⅲ</span>
          <span className="wordmark">
            MONZA<small>FORGED WHEELS</small>
          </span>
        </a>
        <div className="workspace-switch">
          <div className="workspace-icon">M</div>
          <div>
            <strong>Monza workspace</strong>
            <span>
              <i /> Private CRM
            </span>
          </div>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-heading">WORKSPACE</div>
        <nav className="main-nav">
          {navigation.map((n) => (
            <a
              href={demo ? `/demo?view=${n.key}` : n.key === 'dashboard' ? '/' : `/${n.key}`}
              className={section === n.key ? 'active' : ''}
              key={n.key}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.key);
              }}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.key === 'leads' && a.newLeads.length > 0 && <b>{a.newLeads.length}</b>}
              {n.key === 'follow-ups' && a.overdue.length > 0 && (
                <i className="nav-alert">{a.overdue.length}</i>
              )}
              {section === n.key && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-motto">
            <div className="motto-line" />
            <span>
              MADE TO FIT.
              <br />
              BUILT TO STAND OUT.
            </span>
            <small>MONZA WHEELS / AUSTRALIA</small>
          </div>
          <button
            className={`settings-link ${section === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <SettingsIcon size={18} />
            Settings
          </button>
          <button className="sidebar-user" onClick={() => setAccount(true)}>
            <Avatar name={name} />
            <span>
              <strong>{name}</strong>
              <small>Monza Wheels</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{title}</strong>
          </div>
          <button className="global-search" onClick={() => setSearch(true)}>
            <Search size={15} />
            <span>Search anything…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar-right">
            {demo && (
              <span className="demo-label">
                <i /> DEMO WORKSPACE
              </span>
            )}
            <button
              className="notification-button"
              aria-label="View items needing attention"
              onClick={() => setNotifications(true)}
            >
              <Bell size={18} />
              {a.attention.length > 0 && <i />}
            </button>
            <span className="topbar-divider" />
            <button className="avatar-button" aria-label="Account" onClick={() => setAccount(true)}>
              <Avatar name={name} size="small" />
            </button>
          </div>
        </header>
        {section === 'dashboard' ? (
          <Dashboard
            navigate={navigate}
            onNew={() => setNewLead(true)}
            onImport={demo ? undefined : () => setImportLeads(true)}
          />
        ) : section === 'leads' ? (
          <LeadList
            navigate={navigate}
            onNew={() => setNewLead(true)}
            onImport={demo ? undefined : () => setImportLeads(true)}
          />
        ) : section === 'pipeline' ? (
          <Pipeline navigate={navigate} onNew={() => setNewLead(true)} />
        ) : section === 'follow-ups' ? (
          <FollowUps />
        ) : section === 'orders' ? (
          <Orders />
        ) : section === 'customers' ? (
          <Customers />
        ) : (
          <Settings />
        )}
        {demo && (
          <div className="demo-footer">
            <span>
              <ShieldCheck size={13} /> Fictional demo data · Changes stay in this browser
            </span>
            <Link href="/login">
              Open private workspace <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
      </div>
      {selected && <LeadDetail key={selected} />}{' '}
      {newLead && <LeadCreate onClose={() => setNewLead(false)} />}{' '}
      {importLeads && <LeadImport onClose={() => setImportLeads(false)} />}{' '}
      {search && (
        <Modal
          title="Find anything."
          subtitle="Customers, vehicles, enquiries, orders, tracking and supplier references."
          onClose={() => {
            setSearch(false);
            setQuery('');
          }}
        >
          <div className="global-search-dialog">
            <div className="search-field">
              <Search size={18} />
              <input
                autoFocus
                placeholder="Start typing a name, vehicle or reference…"
                aria-label="Global search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>ESC</kbd>
            </div>
            <div className="search-results">
              {results.map((r) => (
                <button
                  key={r.lead.id}
                  onClick={() => {
                    setSearch(false);
                    setQuery('');
                    openLead(
                      r.lead.id,
                      r.order &&
                        query &&
                        `${r.order.id} ${r.order.tracking_number} ${r.order.supplier_reference}`
                          .toLowerCase()
                          .includes(query.toLowerCase())
                        ? 'Order'
                        : 'Overview',
                    );
                  }}
                >
                  <Avatar name={fullName(r.customer)} />
                  <div>
                    <strong>{fullName(r.customer)}</strong>
                    <span>
                      {vehicleName(r.vehicle)} · {r.lead.source}
                      {r.lead.archived_at ? ' · Archived' : ''}
                    </span>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))}
              {!results.length && (
                <Empty
                  title="No matching records"
                  description="Try a name, phone number, vehicle or reference."
                />
              )}
            </div>
          </div>
        </Modal>
      )}
      {notifications && (
        <Modal
          title="Needs attention"
          subtitle="The next best actions for your customers."
          onClose={() => setNotifications(false)}
        >
          <div className="notification-list">
            {a.attention.map((r) => (
              <button
                key={r.leadId}
                onClick={() => {
                  setNotifications(false);
                  openLead(r.leadId, r.tab);
                }}
              >
                <span className={`notification-dot ${r.tone}`} />
                <div>
                  <strong>{r.name}</strong>
                  <p>
                    {r.reason} · {r.vehicle}
                  </p>
                </div>
                <ArrowRight size={16} />
              </button>
            ))}
            {!a.attention.length && (
              <Empty title="All caught up." description="Nothing needs immediate attention." />
            )}
          </div>
        </Modal>
      )}
      {account && (
        <Modal
          title={name}
          subtitle={
            demo ? 'You are exploring a fictional demo.' : 'Your approved Monza workspace account.'
          }
          onClose={() => setAccount(false)}
        >
          <div className="account-details">
            <Avatar name={name} size="large" />
            <p>
              {demo
                ? 'Demo changes are saved only in this browser.'
                : 'Both approved users have equal access to CRM records.'}
            </p>
          </div>
          <div className="modal-footer">
            <Button
              variant="secondary"
              onClick={() => {
                setAccount(false);
                navigate('settings');
              }}
            >
              Settings
            </Button>
            <Button
              onClick={async () => {
                if (demo) {
                  router.push('/login');
                  return;
                }
                try {
                  const r = await fetch('/api/auth/logout', { method: 'POST' });
                  if (!r.ok) throw new Error('Sign out failed');
                  router.push('/login');
                  router.refresh();
                } catch {
                  notify('Could not sign out. Please try again.');
                }
              }}
            >
              <LogOut size={15} />
              {demo ? 'Go to sign in' : 'Sign out'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
