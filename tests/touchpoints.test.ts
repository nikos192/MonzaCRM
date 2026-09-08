import { makeDemo, applyDemoMutation, restoreDemoFollowUpSections, demoId } from '../src/lib/demo';
import { describe, expect, it } from 'vitest';
import { lastDialChange } from '../src/lib/touchpoints';
import type { Activity } from '../src/lib/types';

function change(created_at: string, before: object, after: object, entity_id = 'lead'): Activity {
  return {
    id: created_at,
    created_at,
    updated_at: created_at,
    entity: 'leads',
    entity_id,
    action: 'updated',
    actor_id: null,
    metadata: { before, after },
  };
}

describe('saved dial timestamps', () => {
  it('keeps each dial independent of unrelated edits and other leads, regardless of history order', () => {
    const history = [
      change(
        '2026-09-07T03:00:00Z',
        { follow_up_step: 1, call_step: 1 },
        { follow_up_step: 1, call_step: 2 },
      ),
      change('2026-09-07T02:00:00Z', { follow_up_step: 0 }, { follow_up_step: 1 }),
      change(
        '2026-09-07T04:00:00Z',
        { follow_up_step: 1, notes: '' },
        { follow_up_step: 1, notes: 'Edited' },
      ),
      change('2026-09-07T05:00:00Z', { follow_up_step: 0 }, { follow_up_step: 1 }, 'other'),
      change('2026-09-07T01:00:00Z', { call_step: 0 }, { call_step: 1 }),
    ];
    expect(lastDialChange(history, 'lead', 'follow_up_step')).toBe('2026-09-07T02:00:00Z');
    expect(lastDialChange(history, 'lead', 'call_step')).toBe('2026-09-07T03:00:00Z');
  });

  it('records a click that reduces or resets the dial', () => {
    expect(
      lastDialChange(
        [
          change('2026-09-07T02:00:00Z', { follow_up_step: 1 }, { follow_up_step: 0 }),
          change('2026-09-07T01:00:00Z', { follow_up_step: 0 }, { follow_up_step: 1 }),
        ],
        'lead',
        'follow_up_step',
      ),
    ).toBe('2026-09-07T02:00:00Z');
  });

  it('does not invent timestamps for initial values, missing history or invalid dates', () => {
    expect(
      lastDialChange(
        [
          change('2026-09-07T01:00:00Z', {}, { follow_up_step: 2 }),
          change('invalid', { follow_up_step: 1 }, { follow_up_step: 2 }),
        ],
        'lead',
        'follow_up_step',
      ),
    ).toBeUndefined();
    expect(lastDialChange([], 'lead', 'call_step')).toBeUndefined();
  });
});

describe('follow-up sections in saved workspaces', () => {
  it('restores saved progress once without changing calls or pulling orders backwards', () => {
    const data = makeDemo();
    data.pipeline_stages = data.pipeline_stages.filter(
      (stage) => !/^Follow-Up [123]$/.test(stage.name),
    );
    const lead = data.leads.find(
      (lead) => !data.orders.some((order) => order.lead_id === lead.id),
    )!;
    lead.stage_id = data.pipeline_stages.find((stage) => stage.name === 'Quote Sent')!.id;
    lead.follow_up_step = 2;
    lead.call_step = 3;
    const restored = restoreDemoFollowUpSections(data);
    const saved = restored.leads.find((item) => item.id === lead.id)!;
    expect(restored.pipeline_stages.find((stage) => stage.id === saved.stage_id)?.name).toBe(
      'Follow-Up 2',
    );
    expect(saved.call_step).toBe(3);
    expect(saved.last_contacted).toBe(lead.last_contacted);
    expect(
      restored.orders.map(
        (order) => restored.leads.find((lead) => lead.id === order.lead_id)?.stage_id,
      ),
    ).toEqual(
      data.orders.map((order) => data.leads.find((lead) => lead.id === order.lead_id)?.stage_id),
    );
    const advanced = applyDemoMutation(
      restored,
      {
        action: 'save',
        table: 'leads',
        id: lead.id,
        values: {
          stage_id: restored.pipeline_stages.find((stage) => stage.name === 'Follow-Up 3')!.id,
        },
      },
      demoId(1),
    );
    const back = applyDemoMutation(
      advanced,
      {
        action: 'save',
        table: 'leads',
        id: lead.id,
        values: {
          stage_id: restored.pipeline_stages.find((stage) => stage.name === 'Quote Sent')!.id,
        },
      },
      demoId(1),
    );
    expect(back.leads.find((item) => item.id === lead.id)?.follow_up_step).toBe(3);
    expect(back.leads.find((item) => item.id === lead.id)?.call_step).toBe(3);
    expect(restoreDemoFollowUpSections(back)).toEqual(back);
  });
});
