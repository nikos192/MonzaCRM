-- Replace pipeline follow-up stages with compact per-lead progress dials.
begin;

alter table public.leads
  add column if not exists follow_up_step smallint not null default 0
    check (follow_up_step between 0 and 3),
  add column if not exists call_step smallint not null default 0
    check (call_step between 0 and 3);

-- Leads previously parked in a follow-up column return to Quote Sent. Stage rows
-- remain as hidden legacy records because immutable stage history references them.
update public.leads as lead
set stage_id = quote_stage.id
from public.pipeline_stages as old_stage,
     public.pipeline_stages as quote_stage
where lead.stage_id = old_stage.id
  and old_stage.name ~* '^Follow[- ]?Up [123]$'
  and quote_stage.name = 'Quote Sent';

update public.pipeline_stages
set name = 'Legacy ' || name,
    position = position + 90,
    is_terminal = true
where name ~* '^Follow[- ]?Up [123]$';

update public.pipeline_stages
set position = case name
  when 'New Lead' then 0
  when 'Contacted' then 1
  when 'Replied' then 2
  when 'Quote Sent' then 3
  when 'Deposit Paid' then 4
  when 'In Production' then 5
  when 'Balance Due' then 6
  when 'Paid' then 7
  when 'Shipped' then 8
  when 'Completed' then 9
  when 'Lost' then 10
  else position
end;

commit;
