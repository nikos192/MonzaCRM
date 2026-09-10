import { lastDialChange } from '../src/lib/touchpoints';
import { describe, expect, it } from 'vitest';
import { columnEntryTimes, compareColumnEntries, buildPipelineIndex } from '../src/lib/pipeline';
import { makeDemo, applyDemoMutation, demoId } from '../src/lib/demo';
import type { Activity } from '../src/lib/types';

describe('pipeline column entry times', () => {
  it('orders by the latest move into the current column, ignoring edits and earlier visits', () => {
    const leads = makeDemo()
      .leads.slice(0, 2)
      .map((lead, i) => ({
        ...lead,
        stage_id: 'current',
        created_at: `2026-09-0${i + 1}T00:00:00Z`,
      }));
    const event = (leadIndex: number, time: string, from: string, to: string): Activity => ({
      id: time,
      created_at: time,
      entity: 'leads',
      entity_id: leads[leadIndex].id,
      action: 'updated',
      actor_id: null,
      metadata: { before: { stage_id: from }, after: { stage_id: to } },
    });
    const logs = [
      event(0, '2026-09-08T10:00:00Z', 'other', 'current'),
      event(1, '2026-09-08T09:00:00Z', 'other', 'current'),
      event(1, '2026-09-08T11:00:00Z', 'current', 'current'),
      event(0, '2026-09-08T08:00:00Z', 'current', 'other'),
      event(0, '2026-09-08T07:00:00Z', 'other', 'current'),
      event(1, 'invalid', 'other', 'current'),
    ];
    const times = columnEntryTimes(leads, logs);
    expect(times.get(leads[0].id)).toBe('2026-09-08T10:00:00Z');
    expect(times.get(leads[1].id)).toBe('2026-09-08T09:00:00Z');
    expect([...leads].reverse().sort((a, b) => compareColumnEntries(a, b, times))).toEqual(leads);
  });

  it('uses creation time for leads with no saved moves and breaks simultaneous moves consistently', () => {
    const leads = makeDemo()
      .leads.slice(0, 2)
      .map((lead, i) => ({ ...lead, created_at: `2026-09-0${i + 1}T00:00:00Z` }));
    const times = columnEntryTimes(leads, []);
    expect(times.get(leads[0].id)).toBe(leads[0].created_at);
    expect([...leads].sort((a, b) => compareColumnEntries(a, b, times))[0].id).toBe(leads[1].id);
    times.set(leads[0].id, '2026-09-08T00:00:00Z');
    times.set(leads[1].id, '2026-09-08T00:00:00Z');
    expect([...leads].sort((a, b) => compareColumnEntries(a, b, times))[0].id).toBe(leads[1].id);
  });

  it('persists a stage-entry time through reloads and subsequent calls', () => {
    const data = makeDemo();
    const lead = data.leads[0];
    const moved = applyDemoMutation(
      data,
      { action: 'save', table: 'leads', id: lead.id, values: { stage_id: demoId(112) } },
      demoId(1),
    );
    const moveTime = moved.activity_logs[0].created_at;
    const called = applyDemoMutation(
      moved,
      { action: 'save', table: 'leads', id: lead.id, values: { call_step: 3 } },
      demoId(1),
    );
    const reloaded = JSON.parse(JSON.stringify(called));
    expect(columnEntryTimes(reloaded.leads, reloaded.activity_logs).get(lead.id)).toBe(moveTime);
    expect(reloaded.leads[0].follow_up_step).toBe(2);
    expect(reloaded.leads[0].call_step).toBe(3);
  });
});

it('indexes the same quotes, earliest open follow-ups, call times and customers without mutating data', () => {
  const data = makeDemo();
  const before = structuredClone(data);
  const index = buildPipelineIndex(data);
  for (const lead of data.leads) {
    const card = index.cards.get(lead.id)!;
    expect(card.customer).toEqual(data.customers.find((row) => row.id === lead.customer_id));
    expect(card.quote).toEqual(data.quotes.find((row) => row.lead_id === lead.id));
    expect(card.follow).toEqual(
      data.follow_ups
        .filter((row) => row.lead_id === lead.id && row.status === 'Open')
        .sort((a, b) => a.due_at.localeCompare(b.due_at))[0],
    );
    expect(card.lastCall).toBe(lastDialChange(data.activity_logs, lead.id, 'call_step'));
  }
  expect(index.sorted.map((card) => card.lead)).toEqual(
    data.leads
      .filter((lead) => !lead.archived_at)
      .sort((a, b) => compareColumnEntries(a, b, columnEntryTimes(data.leads, data.activity_logs))),
  );
  expect(data).toEqual(before);
});
