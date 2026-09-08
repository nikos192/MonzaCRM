import type { Activity, Lead } from './types';

// Creation is the first column entry. Only a real stage change starts a new one.
export function columnEntryTimes(leads: Lead[], activities: Activity[]): Map<string, string> {
  const currentStages = new Map(leads.map((lead) => [lead.id, lead.stage_id]));
  const enteredAt = new Map(leads.map((lead) => [lead.id, lead.created_at]));
  for (const activity of activities) {
    if (activity.entity !== 'leads' || !currentStages.has(activity.entity_id)) continue;
    const before = activity.metadata.before as Record<string, unknown> | null | undefined;
    const after = activity.metadata.after as Record<string, unknown> | null | undefined;
    if (
      typeof before?.stage_id !== 'string' ||
      after?.stage_id !== currentStages.get(activity.entity_id) ||
      before.stage_id === after?.stage_id
    )
      continue;
    if (Date.parse(activity.created_at) > Date.parse(enteredAt.get(activity.entity_id)!)) {
      enteredAt.set(activity.entity_id, activity.created_at);
    }
  }
  return enteredAt;
}

export function compareColumnEntries(a: Lead, b: Lead, enteredAt: Map<string, string>): number {
  return (
    Date.parse(enteredAt.get(b.id) ?? b.created_at) -
      Date.parse(enteredAt.get(a.id) ?? a.created_at) ||
    Date.parse(b.created_at) - Date.parse(a.created_at) ||
    a.id.localeCompare(b.id)
  );
}
