begin;

create or replace function public.create_lead(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare cid uuid; vid uuid; lid uuid;
begin
 if not public.is_approved() and current_user <> 'service_role' then raise exception 'Access denied'; end if;
 perform pg_advisory_xact_lock(62817490);
 select id into cid from public.customers where archived_at is null and
 ((btrim(coalesce(payload->>'email','')) <> '' and lower(btrim(email))=lower(btrim(payload->>'email'))) or
  (length(regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g')) >= 7 and
   regexp_replace(phone,'[^0-9]','','g')=regexp_replace(payload->>'phone','[^0-9]','','g'))) order by created_at limit 1;
 if cid is null then
  insert into public.customers(first_name,last_name,email,phone,instagram,location,preferred_contact,notes)
  values(payload->>'first_name',coalesce(payload->>'last_name',''),coalesce(payload->>'email',''),coalesce(payload->>'phone',''),coalesce(payload->>'instagram',''),coalesce(payload->>'location',''),coalesce(payload->>'preferred_contact','Email'),coalesce(payload->>'notes','')) returning id into cid;
 end if;
 insert into public.vehicles(customer_id,make,model,year,chassis) values(cid,payload->>'make',payload->>'model',coalesce(payload->>'year',''),coalesce(payload->>'chassis','')) returning id into vid;
 insert into public.leads(customer_id,vehicle_id,stage_id,source,handled_by,priority,notes)
 values(cid,vid,(payload->>'stage_id')::uuid,coalesce(payload->>'source','Website'),nullif(payload->>'handled_by','')::uuid,coalesce(payload->>'priority','Normal'),coalesce(payload->>'notes','')) returning id into lid;
 return lid;
end; $$;
revoke all on function public.create_lead(jsonb) from public;
grant execute on function public.create_lead(jsonb) to authenticated, service_role;

create or replace function public.delete_lead(p_lead_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare
 cid uuid; vid uuid; deleted_id uuid; related_ids uuid[];
begin
 if not public.is_approved() then raise exception 'Access denied'; end if;
 select customer_id,vehicle_id into cid,vid from public.leads where id=p_lead_id for update;
 if not found then raise exception 'Lead not found'; end if;

 select array[p_lead_id] || coalesce(array_agg(id),'{}'::uuid[]) into related_ids from (
  select id from public.wheel_specs where lead_id=p_lead_id
  union all select id from public.quotes where lead_id=p_lead_id
  union all select id from public.quote_revisions where quote_id in (select id from public.quotes where lead_id=p_lead_id)
  union all select id from public.messages where lead_id=p_lead_id
  union all select id from public.follow_ups where lead_id=p_lead_id
  union all select id from public.orders where lead_id=p_lead_id
  union all select id from public.payments where order_id in (select id from public.orders where lead_id=p_lead_id)
  union all select id from public.attachments where lead_id=p_lead_id
 ) related;

 delete from public.quote_revisions where quote_id in (select id from public.quotes where lead_id=p_lead_id);
 delete from public.payments where order_id in (select id from public.orders where lead_id=p_lead_id);
 delete from public.order_stage_history where order_id in (select id from public.orders where lead_id=p_lead_id);
 delete from public.attachments where lead_id=p_lead_id;
 delete from public.messages where lead_id=p_lead_id;
 delete from public.follow_ups where lead_id=p_lead_id;
 delete from public.wheel_specs where lead_id=p_lead_id;
 delete from public.intake_requests where lead_id=p_lead_id;
 delete from public.lead_stage_history where lead_id=p_lead_id;
 delete from public.orders where lead_id=p_lead_id;
 delete from public.quotes where lead_id=p_lead_id;
 delete from public.leads where id=p_lead_id;

 delete from public.vehicles
  where id=vid and not exists(select 1 from public.leads where vehicle_id=vid)
  returning id into deleted_id;
 if deleted_id is not null then related_ids:=array_append(related_ids,deleted_id); end if;
 deleted_id:=null;
 delete from public.customers
  where id=cid
    and not exists(select 1 from public.leads where customer_id=cid)
    and not exists(select 1 from public.vehicles where customer_id=cid)
  returning id into deleted_id;
 if deleted_id is not null then related_ids:=array_append(related_ids,deleted_id); end if;

 delete from public.activity_logs where entity_id=any(related_ids);
end; $$;
revoke all on function public.delete_lead(uuid) from public;
grant execute on function public.delete_lead(uuid) to authenticated;

commit;
