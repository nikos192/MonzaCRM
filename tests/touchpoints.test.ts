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
