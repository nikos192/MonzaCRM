-- Restore follow-up columns without discarding dial counts or historical stage IDs.
begin;

update public.pipeline_stages as legacy
set name = 'Follow-Up ' || substring(legacy.name from '([123])$'),
    is_terminal = false
where legacy.name ~* '^Legacy Follow[- ]?Up [123]$'
  and not exists (
    select 1 from public.pipeline_stages active
    where active.name = 'Follow-Up ' || substring(legacy.name from '([123])$')
  );

insert into public.pipeline_stages(name, position, colour, is_terminal)
values ('Follow-Up 1', 4, '#c88a42', false),
       ('Follow-Up 2', 5, '#bd8549', false),
       ('Follow-Up 3', 6, '#ac7541', false)
on conflict (name) do update set is_terminal = false;

update public.pipeline_stages
set position = array_position(array[
  'New Lead', 'Contacted', 'Replied', 'Quote Sent',
  'Follow-Up 1', 'Follow-Up 2', 'Follow-Up 3', 'Deposit Paid',
  'In Production', 'Balance Due', 'Paid', 'Shipped', 'Completed', 'Lost'
], name) - 1
where name = any(array[
  'New Lead', 'Contacted', 'Replied', 'Quote Sent',
  'Follow-Up 1', 'Follow-Up 2', 'Follow-Up 3', 'Deposit Paid',
  'In Production', 'Balance Due', 'Paid', 'Shipped', 'Completed', 'Lost'
]);

-- Only restore active pre-sale enquiries. Never pull orders or closed leads backwards.
update public.leads as lead
set stage_id = target.id
from public.pipeline_stages current_stage, public.pipeline_stages target
where lead.stage_id = current_stage.id
  and current_stage.name in ('New Lead', 'Contacted', 'Replied', 'Quote Sent')
  and target.name = 'Follow-Up ' || lead.follow_up_step::text
  and lead.follow_up_step > 0
  and lead.archived_at is null
  and not exists (select 1 from public.orders where lead_id = lead.id);

-- Moving a card backwards must not erase the number of follow-ups already recorded.
create function public.preserve_follow_up_progress() returns trigger
language plpgsql set search_path = '' as $$
declare step smallint;
begin
  select substring(name from '([123])$')::smallint into step
  from public.pipeline_stages where id = new.stage_id and name ~ '^Follow-Up [123]$';
  new.follow_up_step := greatest(new.follow_up_step, coalesce(step, 0),
    case when TG_OP = 'UPDATE' then old.follow_up_step else 0 end);
  return new;
end;
$$;
create trigger preserve_follow_up_progress before insert or update on public.leads
for each row execute function public.preserve_follow_up_progress();

commit;
