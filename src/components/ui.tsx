'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Loader2, ChevronDown, ArrowUpRight, Check } from 'lucide-react';
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button {...props} className={`button ${variant} ${className}`}>
      {children}
    </button>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Avatar({ name, size = 'normal' }: { name: string; size?: string }) {
  const n = name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2);
  const colour = name.charCodeAt(0) % 5;
  return <span className={`avatar avatar-${colour} ${size}`}>{n}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">◎</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const initialFocus = ref.current?.querySelector<HTMLElement>(
      'input:not(:disabled), textarea:not(:disabled)',
    );
    (initialFocus ?? ref.current)?.focus();
    const handler = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role=dialog]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        close.current();
      }
      if (e.key === 'Tab') {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', handler, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export type Field = {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'tel'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'colour';
  options?: { label: string; value: string }[] | string[];
  required?: boolean;
  full?: boolean;
  placeholder?: string;
};
export function Form({
  fields,
  initial = {},
  onSubmit,
  onClose,
  submitLabel = 'Save changes',
  description,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  submitLabel?: string;
  description?: ReactNode | ((values: Record<string, unknown>) => ReactNode);
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const result: Record<string, unknown> = {};
          fields.forEach((f) => {
            const v = values[f.name];
            result[f.name] =
              f.type === 'checkbox' ? Boolean(v) : f.type === 'number' ? Number(v ?? 0) : (v ?? '');
          });
          await onSubmit(result);
          onClose();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to save.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-body">
        {description && (
          <div className="form-info">
            {typeof description === 'function' ? description(values) : description}
          </div>
        )}
        <div className="form-grid">
          {fields.map((f) => (
            <label
              key={f.name}
              className={`field ${f.full || f.type === 'textarea' ? 'full' : ''}`}
            >
              <span>
                {f.label}
                {f.required && <b aria-hidden="true"> *</b>}
              </span>
              {f.type === 'textarea' ? (
                <textarea
                  aria-label={f.label}
                  required={f.required}
                  value={String(values[f.name] ?? '')}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  rows={3}
                  maxLength={4000}
                />
              ) : f.type === 'select' ? (
                <div className="select-wrap">
                  <select
                    aria-label={f.label}
                    required={f.required}
                    value={String(values[f.name] ?? '')}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  >
                    {!f.required && <option value="">Not set</option>}
                    {f.required && !values[f.name] && <option value="">Select…</option>}
                    {f.options?.map((o) =>
                      typeof o === 'string' ? (
                        <option key={o}>{o}</option>
                      ) : (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ),
                    )}
                  </select>
                  <ChevronDown size={14} />
                </div>
              ) : f.type === 'checkbox' ? (
                <input
                  aria-label={f.label}
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                />
              ) : (
                <input
                  aria-label={f.label}
                  type={f.type === 'colour' ? 'color' : (f.type ?? 'text')}
                  value={String(values[f.name] ?? '')}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  required={f.required}
                  placeholder={f.placeholder}
                  min={f.type === 'number' ? 0 : undefined}
                  step={f.type === 'number' ? '0.01' : undefined}
                  maxLength={f.type === 'email' ? 254 : 200}
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="modal-footer">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button disabled={busy}>
          {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />} {submitLabel}
        </Button>
      </footer>
    </form>
  );
}
export function SectionHeading({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h3>
        {title}
        {children}
      </h3>
      {aside}
    </div>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
