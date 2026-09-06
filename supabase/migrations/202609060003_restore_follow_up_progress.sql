-- Restore the former Follow-Up 1/2/3 stage as dial progress. The stage change
-- migration preserved every prior stage ID in immutable lead history.
begin;

with recovered as (
  select
    history.lead_id,
    max(substring(stage.name from '([123])$')::smallint) as follow_up_step
  from public.lead_stage_history as history
  cross join lateral unnest(array[history.from_stage_id, history.to_stage_id])
    as stage_reference(stage_id)
  join public.pipeline_stages as stage on stage.id = stage_reference.stage_id
  where stage.name ~* '^(?:Legacy )?Follow[- ]?Up [123]$'
  group by history.lead_id
)
update public.leads as lead
set follow_up_step = greatest(lead.follow_up_step, recovered.follow_up_step)
from recovered
where lead.id = recovered.lead_id
  and lead.follow_up_step < recovered.follow_up_step;

commit;
