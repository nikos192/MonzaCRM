'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { type Data, type Mutation } from '@/lib/types';
import { applyDemoMutation, makeDemo, restoreDemoFollowUpSections } from '@/lib/demo';
import { validateMutation } from '@/lib/validation';
import { mergeLeadSave, optimisticLeadSave } from '@/lib/lead-save';
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
type Actions = Pick<Context, 'mutate' | 'notify' | 'openLead' | 'busy'>;
const ActionsStore = createContext<Actions | null>(null);
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
  const refreshVersion = useRef(0);
  const commitData = useCallback((next: Data) => {
    dataRef.current = next;
    setData(next);
  }, []);
  useEffect(() => {
    if (demo) {
      try {
        const raw = localStorage.getItem('monza-demo-v1');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.leads && saved.profiles && saved.settings) {
            const restored = restoreDemoFollowUpSections(saved);
            localStorage.setItem('monza-demo-v1', JSON.stringify(restored));
            commitData(restored);
          }
        }
      } catch {
        localStorage.removeItem('monza-demo-v1');
      }
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('lead')) setSelected(params.get('lead'));
  }, [demo, commitData]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4200);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const refresh = useCallback(
    async (duringSave = false) => {
      if (demo || (lock.current && !duringSave)) return;
      const version = ++refreshVersion.current;
      const response = await fetch('/api/crm', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) router.push('/login');
        throw new Error(body.error);
      }
      if (version === refreshVersion.current) commitData(body.data);
    },
    [demo, router, commitData],
  );
  useEffect(() => {
    if (demo) return;
    const onFocus = () => {
      if (!lock.current && document.visibilityState === 'visible') void refresh().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [demo, refresh]);
  const mutate = useCallback(
    async (m: Mutation) => {
      if (lock.current) throw new Error('Please wait for the current change to finish.');
      validateMutation(m);
      lock.current = true;
      refreshVersion.current += 1;
      setBusy(true);
      const previous = dataRef.current;
      let saved = false;
      try {
        if (demo) {
          const updated = applyDemoMutation(previous, m, userId);
          localStorage.setItem('monza-demo-v1', JSON.stringify(updated));
          commitData(updated);
        } else {
          commitData(optimisticLeadSave(previous, m, userId, new Date().toISOString()));
          const response = await fetch('/api/crm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          saved = true;
          if (body.leadPatch) commitData(mergeLeadSave(dataRef.current, body.leadPatch));
          else await refresh(true);
        }
        setToast(
          m.action === 'convert'
            ? 'Deposit recorded. Order created.'
            : m.action === 'delete_lead'
              ? 'Lead permanently deleted.'
              : 'Changes saved.',
        );
      } catch (e) {
        if (saved) {
          setToast(
            'Saved, but the view could not refresh. Refresh the page to load the latest data.',
          );
          return;
        }
        commitData(previous);
        throw e;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [demo, refresh, userId, commitData],
  );
  const openLead = useCallback((id: string, t = 'Overview') => {
    setSelected(id);
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('lead', id);
    window.history.replaceState(null, '', url);
  }, []);
  const closeLead = useCallback(() => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('lead');
    window.history.replaceState(null, '', url);
  }, []);
  const resetDemo = useCallback(() => {
    const next = makeDemo();
    localStorage.setItem('monza-demo-v1', JSON.stringify(next));
    commitData(next);
    setToast('Demo restored to its starting point.');
  }, [commitData]);
  const value = useMemo(
    () => ({
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
    }),
    [data, demo, userId, busy, mutate, refresh, openLead, selected, tab, closeLead, resetDemo],
  );
  const actions = useMemo(
    () => ({ mutate, notify: setToast, openLead, busy }),
    [mutate, openLead, busy],
  );
  return (
    <Store.Provider value={value}>
      <ActionsStore.Provider value={actions}>
        {children}
        {toast && (
          <div className="toast" role="status">
            <span>✓</span>
            {toast}
          </div>
        )}
      </ActionsStore.Provider>
    </Store.Provider>
  );
}
export function useCRM() {
  const ctx = useContext(Store);
  if (!ctx) throw new Error('CRM provider missing');
  return ctx;
}

export function useCRMActions() {
  const actions = useContext(ActionsStore);
  if (!actions) throw new Error('CRM provider missing');
  return actions;
}
