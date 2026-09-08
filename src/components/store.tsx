'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { type Data, type Mutation } from '@/lib/types';
import { applyDemoMutation, makeDemo, restoreDemoFollowUpSections } from '@/lib/demo';
import { validateMutation } from '@/lib/validation';
type Context = {
  data: Data;
  demo: boolean;
  userId: string;
  busy: boolean;
  mutate: (m: Mutation) => Promise<void>;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  openLead: (id: string, tab?: string) => void;
  selected: string | null;
  tab: string;
  setTab: (tab: string) => void;
  closeLead: () => void;
  resetDemo: () => void;
};
const Store = createContext<Context | null>(null);
export function Provider({
  initial,
  userId,
  demo,
  children,
}: {
  initial: Data;
  userId: string;
  demo: boolean;
  children: ReactNode;
}) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState('Overview');
  const router = useRouter();
  const dataRef = useRef(data);
  const lock = useRef(false);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    if (demo) {
      try {
        const raw = localStorage.getItem('monza-demo-v1');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.leads && saved.profiles && saved.settings) {
            const restored = restoreDemoFollowUpSections(saved);
            localStorage.setItem('monza-demo-v1', JSON.stringify(restored));
            setData(restored);
          }
        }
      } catch {
        localStorage.removeItem('monza-demo-v1');
      }
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('lead')) setSelected(params.get('lead'));
  }, [demo]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4200);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const refresh = useCallback(async () => {
    if (demo) return;
    const response = await fetch('/api/crm', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) router.push('/login');
      throw new Error(body.error);
    }
    setData(body.data);
  }, [demo, router]);
  const mutate = useCallback(
    async (m: Mutation) => {
      if (lock.current) throw new Error('Please wait for the current change to finish.');
      validateMutation(m);
      lock.current = true;
      setBusy(true);
      const previous = dataRef.current;
      try {
        if (demo) {
          const updated = applyDemoMutation(previous, m, userId);
          localStorage.setItem('monza-demo-v1', JSON.stringify(updated));
          setData(updated);
        } else {
          if (m.action === 'save' && m.table === 'leads' && m.id && m.values.stage_id)
            setData((d) => ({
              ...d,
              leads: d.leads.map((l) =>
                l.id === m.id ? { ...l, stage_id: String(m.values.stage_id) } : l,
              ),
            }));
          const response = await fetch('/api/crm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          await refresh();
        }
        setToast(
          m.action === 'convert'
            ? 'Deposit recorded. Order created.'
            : m.action === 'delete_lead'
              ? 'Lead permanently deleted.'
              : 'Changes saved.',
        );
      } catch (e) {
        setData(previous);
        throw e;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [demo, refresh, userId],
  );
  function openLead(id: string, t = 'Overview') {
    setSelected(id);
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('lead', id);
    window.history.replaceState(null, '', url);
  }
  function closeLead() {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('lead');
    window.history.replaceState(null, '', url);
  }
  function resetDemo() {
    const next = makeDemo();
    localStorage.setItem('monza-demo-v1', JSON.stringify(next));
    setData(next);
    setToast('Demo restored to its starting point.');
  }
  return (
    <Store.Provider
      value={{
        data,
        demo,
        userId,
        busy,
        mutate,
        refresh,
        notify: setToast,
        openLead,
        selected,
        tab,
        setTab,
        closeLead,
        resetDemo,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </Store.Provider>
  );
}
export function useCRM() {
  const ctx = useContext(Store);
  if (!ctx) throw new Error('CRM provider missing');
  return ctx;
}
