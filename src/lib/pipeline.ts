import { fullName, vehicleName, type Activity, type Lead } from './types';

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

export function buildPipelineIndex(data: import('./types').Data) {
  const customers = new Map(data.customers.map((row) => [row.id, row]));
  const vehicles = new Map(data.vehicles.map((row) => [row.id, row]));
  const profiles = new Map(data.profiles.map((row) => [row.id, row]));
  const quotes = new Map<string, import('./types').Quote>();
  for (const row of data.quotes) if (!quotes.has(row.lead_id)) quotes.set(row.lead_id, row);
  const follows = new Map<string, import('./types').FollowUp>();
  for (const row of data.follow_ups) {
    if (row.status !== 'Open') continue;
    const earliest = follows.get(row.lead_id);
    if (!earliest || row.due_at < earliest.due_at) follows.set(row.lead_id, row);
  }
  const calls = new Map<string, string>();
  for (const row of data.activity_logs) {
    if (row.entity !== 'leads') continue;
    const before = row.metadata.before as Record<string, unknown> | undefined;
    const after = row.metadata.after as Record<string, unknown> | undefined;
    if (
      typeof before?.call_step !== 'number' ||
      typeof after?.call_step !== 'number' ||
      before.call_step === after.call_step
    )
      continue;
    const timestamp = Date.parse(row.created_at);
    if (
      Number.isFinite(timestamp) &&
      (!calls.has(row.entity_id) || timestamp > Date.parse(calls.get(row.entity_id)!))
    )
      calls.set(row.entity_id, row.created_at);
  }
  const times = columnEntryTimes(data.leads, data.activity_logs);
  const cards = new Map(
    data.leads.map((lead) => {
      const customer = customers.get(lead.customer_id);
      const vehicle = vehicles.get(lead.vehicle_id ?? '');
      return [
        lead.id,
        {
          lead,
          customer,
          vehicle,
          quote: quotes.get(lead.id),
          profile: profiles.get(lead.handled_by ?? ''),
          follow: follows.get(lead.id),
          lastCall: calls.get(lead.id),
          enteredAt: times.get(lead.id)!,
          search: `${fullName(customer)} ${vehicleName(vehicle)}`.toLowerCase(),
        },
      ];
    }),
  );
  const sorted = [...data.leads]
    .filter((lead) => !lead.archived_at)
    .sort((a, b) => compareColumnEntries(a, b, times))
    .map((lead) => cards.get(lead.id)!);
  return {
    cards,
    sorted,
    contactedStage: data.pipeline_stages.find((stage) => stage.name === 'Contacted')?.id,
  };
}
export type PipelineCardData = ReturnType<typeof buildPipelineIndex>['sorted'][number];
