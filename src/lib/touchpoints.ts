import type { Activity } from './types';

// Use the saved change history so unrelated lead edits never reset a dial's time.
export function lastDialChange(
  activities: Activity[],
  leadId: string,
  field: 'follow_up_step' | 'call_step',
): string | undefined {
  let latest: string | undefined;
  for (const activity of activities) {
    if (activity.entity !== 'leads' || activity.entity_id !== leadId) continue;
    const before = activity.metadata.before as Record<string, unknown> | null | undefined;
    const after = activity.metadata.after as Record<string, unknown> | null | undefined;
    if (
      typeof before?.[field] !== 'number' ||
      typeof after?.[field] !== 'number' ||
      before[field] === after[field] ||
      !Number.isFinite(Date.parse(activity.created_at))
    )
      continue;
    if (!latest || Date.parse(activity.created_at) > Date.parse(latest)) {
      latest = activity.created_at;
    }
  }
  return latest;
}
