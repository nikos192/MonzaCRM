'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardPaste,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCRM } from './store';
import { Badge, Button, Modal } from './ui';
import { type ParsedLead } from '@/lib/lead-import';
import { matchesCustomer } from '@/lib/customer-match';

const contactOptions = ['Email', 'Phone', 'SMS', 'Instagram', 'Facebook', 'WhatsApp'];
const fields: { key: keyof ParsedLead; label: string; type?: string; full?: boolean }[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'location', label: 'Location' },
  { key: 'make', label: 'Vehicle make' },
  { key: 'model', label: 'Vehicle model' },
  { key: 'year', label: 'Year' },
  { key: 'chassis', label: 'Chassis / generation' },
  { key: 'notes', label: 'Form answers and notes', full: true },
];

async function bodyOf(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body;
}

export function LeadImport({ onClose }: { onClose: () => void }) {
  const { data, refresh, notify } = useCRM();
  const [text, setText] = useState('');
  const [leads, setLeads] = useState<ParsedLead[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(index: number, key: keyof ParsedLead, value: string) {
    setLeads((current) =>
      current.map((lead, position) => (position === index ? { ...lead, [key]: value } : lead)),
    );
  }

  function existingCustomer(lead: ParsedLead) {
    return data.customers.some(
      (customer) => !customer.archived_at && matchesCustomer(customer, lead),
    );
  }

  async function parse() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/ai/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse', text }),
      });
      const body = await bodyOf(response);
      setLeads(body.leads);
      setWarnings(body.warnings);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not analyse those leads.');
    } finally {
      setBusy(false);
    }
  }

  async function importLeads() {
    setBusy(true);
    setError('');
    try {
      const values = leads.map(({ confidence, ...lead }) => {
        void confidence;
        return lead;
      });
      const response = await fetch('/api/ai/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', leads: values }),
      });
      const body = await bodyOf(response);
      await refresh();
      notify(`${body.created} ${body.created === 1 ? 'lead' : 'leads'} imported into New Lead.`);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not import those leads.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={leads.length ? 'Review imported leads.' : 'Turn copied leads into records.'}
      subtitle={
        leads.length
          ? 'Check the details before anything is saved.'
          : 'Paste Meta lead-form results. The importer will organise the details for you.'
      }
      onClose={onClose}
      wide
    >
      {!leads.length ? (
        <form
          className="lead-import-paste"
          onSubmit={(event) => {
            event.preventDefault();
            void parse();
          }}
        >
          <div className="import-intro">
            <span className="import-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>Paste one lead or a whole batch</strong>
              <p>
                Names, phone numbers, emails, vehicles and form answers can be mixed together.
                Separate leads with a blank line when possible.
              </p>
            </div>
          </div>
          <label className="import-textarea">
            <span>Lead-form text</span>
            <textarea
              aria-label="Pasted lead details"
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                'John Smith\n0400 000 000 · john@example.com\n2021 BMW M4 G82\nInterested in 20-inch wheels\n\nNext lead…'
              }
              maxLength={30000}
              required
            />
            <small>{text.length.toLocaleString()} / 30,000 characters</small>
          </label>
          <div className="import-privacy">
            <ClipboardPaste size={15} />
            <span>
              This text is sent to the configured OpenAI API for extraction. Nothing is added to the
              CRM until you review and confirm it.
            </span>
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button disabled={busy || text.trim().length < 10}>
              {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              {busy ? 'Organising leads…' : 'Analyse leads'}
            </Button>
          </footer>
        </form>
      ) : (
        <form
          className="lead-import-review"
          onSubmit={(event) => {
            event.preventDefault();
            void importLeads();
          }}
        >
          <div className="import-summary">
            <div>
              <strong>{leads.length}</strong>
              <span>{leads.length === 1 ? 'lead found' : 'leads found'}</span>
            </div>
            <p>All records will enter the Facebook source and New Lead stage.</p>
          </div>
          {warnings.length > 0 && (
            <div className="import-warnings">
              <AlertTriangle size={16} />
              <div>
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          )}
          <div className="import-cards">
            {leads.map((lead, index) => (
              <section className="import-card" key={`${index}-${lead.email}-${lead.phone}`}>
                <header>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>
                      {[lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
                        'Unnamed lead'}
                    </strong>
                    <small>
                      {[lead.year, lead.make, lead.model].filter(Boolean).join(' ') ||
                        'Vehicle needs review'}
                    </small>
                  </div>
                  {existingCustomer(lead) && <Badge tone="blue">Existing customer</Badge>}
                  <Badge
                    tone={
                      lead.confidence === 'high'
                        ? 'green'
                        : lead.confidence === 'medium'
                          ? 'amber'
                          : 'red'
                    }
                  >
                    {lead.confidence} confidence
                  </Badge>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove lead ${index + 1}`}
                    onClick={() =>
                      setLeads((current) => current.filter((_, position) => position !== index))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </header>
                <div className="import-grid">
                  {fields.map((field) => (
                    <label className={field.full ? 'full' : ''} key={field.key}>
                      <span>{field.label}</span>
                      {field.full ? (
                        <textarea
                          aria-label={`${field.label} ${index + 1}`}
                          value={String(lead[field.key])}
                          onChange={(event) => update(index, field.key, event.target.value)}
                          maxLength={4000}
                        />
                      ) : (
                        <input
                          aria-label={`${field.label} ${index + 1}`}
                          type={field.type ?? 'text'}
                          value={String(lead[field.key])}
                          onChange={(event) => update(index, field.key, event.target.value)}
                          required={['first_name', 'make', 'model'].includes(field.key)}
                          maxLength={field.type === 'email' ? 254 : 200}
                        />
                      )}
                    </label>
                  ))}
                  <label>
                    <span>Preferred contact</span>
                    <select
                      aria-label={`Preferred contact ${index + 1}`}
                      value={lead.preferred_contact}
                      onChange={(event) => update(index, 'preferred_contact', event.target.value)}
                    >
                      {contactOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            ))}
          </div>
          {error && (
            <p className="error-message import-error" role="alert">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLeads([]);
                setWarnings([]);
                setError('');
              }}
              disabled={busy}
            >
              <ArrowLeft size={15} /> Back to paste
            </Button>
            <Button disabled={busy || !leads.length}>
              {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
              {busy
                ? 'Creating leads…'
                : `Import ${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`}
            </Button>
          </footer>
        </form>
      )}
    </Modal>
  );
}
