import { describe, it, expect } from 'vitest';
import { makeDemo, demoId } from '../src/lib/demo';
import { mergeLeadSave, optimisticLeadSave } from '../src/lib/lead-save';
import { columnEntryTimes } from '../src/lib/pipeline';

describe('incremental lead saves', () => {
  it('immediately places a moved card first with preserved counters, without mutating the rollback snapshot', () => {
    const original = makeDemo();
    const before = structuredClone(original);
    const lead = original.leads[0];
    const now = new Date(Date.now() + 1000).toISOString();
    const next = optimisticLeadSave(
      original,
      { action: 'save', table: 'leads', id: lead.id, values: { stage_id: demoId(113) } },
      demoId(1),
      now,
    );
    expect(next.leads[0].follow_up_step).toBe(3);
    expect(next.leads[0].call_step).toBe(lead.call_step);
    expect(columnEntryTimes(next.leads, next.activity_logs).get(lead.id)).toBe(now);
    expect(original).toEqual(before);
    expect(next.customers).toBe(original.customers);
    expect(next.leads[1]).toBe(original.leads[1]);
  });
  it('replaces provisional history with authoritative rows, retaining unrelated records', () => {
    const original = makeDemo();
    const lead = original.leads[0];
    const optimistic = optimisticLeadSave(
      original,
      { action: 'save', table: 'leads', id: lead.id, values: { call_step: 3 } },
      demoId(1),
      new Date().toISOString(),
    );
    const serverLead = { ...optimistic.leads[0], updated_at: new Date().toISOString() };
    const log = { ...optimistic.activity_logs[0], id: 'server-audit' };
    const merged = mergeLeadSave(optimistic, { lead: serverLead, activity_logs: [log] });
    expect(merged.leads[0]).toBe(serverLead);
    expect(merged.activity_logs.some((row) => row.id.startsWith('optimistic:'))).toBe(false);
    expect(
      merged.activity_logs.filter((row) => row.entity === 'leads' && row.entity_id === lead.id),
    ).toEqual([log]);
    expect(merged.activity_logs.filter((row) => row.entity_id !== lead.id)).toEqual(
      original.activity_logs.filter((row) => row.entity_id !== lead.id),
    );
    expect(merged.quotes).toBe(original.quotes);
  });
});
