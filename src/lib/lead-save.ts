import type { Activity, Data, Lead, Mutation } from './types';

export type LeadSavePatch = { lead: Lead; activity_logs: Activity[] };

export function mergeLeadSave(data: Data, patch: LeadSavePatch): Data {
  return {
    ...data,
    leads: data.leads.map((lead) => (lead.id === patch.lead.id ? patch.lead : lead)),
    activity_logs: [
      ...patch.activity_logs,
      ...data.activity_logs.filter(
        (row) => row.entity !== 'leads' || row.entity_id !== patch.lead.id,
      ),
    ],
  };
}

export function optimisticLeadSave(
  data: Data,
  mutation: Mutation,
  userId: string,
  now: string,
): Data {
  if (mutation.action !== 'save' || mutation.table !== 'leads') return data;
  const before = data.leads.find((lead) => lead.id === mutation.id);
  if (!before) return data;
  const after = { ...before, ...mutation.values, updated_at: now } as Lead;
  const stage = data.pipeline_stages.find((stage) => stage.id === after.stage_id);
  after.follow_up_step = Math.max(
    before.follow_up_step,
    after.follow_up_step,
    Number(/^Follow-Up ([123])$/.exec(stage?.name ?? '')?.[1] ?? 0),
  );
  return {
    ...data,
    leads: data.leads.map((lead) => (lead.id === after.id ? after : lead)),
    activity_logs: [
      {
        id: `optimistic:${after.id}`,
        created_at: now,
        entity: 'leads',
        entity_id: after.id,
        action: 'updated',
        actor_id: userId,
        metadata: { before, after },
      },
      ...data.activity_logs,
    ],
  };
}
