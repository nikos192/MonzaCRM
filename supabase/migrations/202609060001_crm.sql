-- Monza CRM: all real customer data is private. Run as database owner.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null
);
create table public.approved_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null unique,
  position integer not null check(position >= 0),
  colour text not null default '#777777' check(colour ~ '^#[a-fA-F0-9]{6}$'),
  is_terminal boolean not null default false
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  location text not null default '',
  preferred_contact text not null default 'Email',
  notes text not null default '',
  archived_at timestamptz
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_id uuid not null references customers(id),
  make text not null,
  model text not null,
  year text not null default '',
  variant text not null default '',
  chassis text not null default '',
  colour text not null default '',
  registration text not null default '',
  suspension text not null default '',
  brakes text not null default '',
  current_wheels text not null default '',
  current_tyres text not null default '',
  notes text not null default '',
  unique(id,customer_id)
);
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_id uuid not null references customers(id),
  vehicle_id uuid,
  stage_id uuid not null references pipeline_stages(id),
  source text not null default 'Website',
  handled_by uuid references profiles(id),
  priority text not null default 'Normal' check(priority in ('Low','Normal','High')),
  notes text not null default '',
  last_contacted timestamptz,
  archived_at timestamptz,
  foreign key(vehicle_id,customer_id) references vehicles(id,customer_id)
);
create table public.wheel_specs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null unique references leads(id),
  design text not null default '',
  design_reference text not null default '',
  diameter text not null default '',
  front_width text not null default '',
  rear_width text not null default '',
  front_offset text not null default '',
  rear_offset text not null default '',
  pcd text not null default '',
  centre_bore text not null default '',
  front_tyre text not null default '',
  rear_tyre text not null default '',
  finish text not null default '',
  face_finish text not null default '',
  lip_finish text not null default '',
  barrel_finish text not null default '',
  cap_finish text not null default '',
  logo_colour text not null default '',
  brake_clearance text not null default '',
  load_rating text not null default '',
  fitment_notes text not null default '',
  customer_requests text not null default '',
  supplier_notes text not null default '',
  construction text not null default 'One-piece' check(construction in ('One-piece','Two-piece','Three-piece'))
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null unique references leads(id),
  base_price numeric(12,2) not null check(base_price >= 0),
  discount numeric(12,2) not null default 0 check(discount >= 0 and discount <= base_price),
  shipping_included boolean not null default true,
  deposit_required numeric(12,2) not null default 0 check(deposit_required >= 0 and deposit_required <= base_price-discount),
  status text not null default 'Draft' check(status in ('Draft','Sent','Negotiating','Accepted','Declined','Expired')),
  quote_date date not null default current_date,
  expires_at date,
  notes text not null default ''
);
create table public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  quote_id uuid not null references quotes(id),
  previous_value jsonb not null,
  new_value jsonb not null,
  actor_id uuid references profiles(id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id),
  direction text not null check(direction in ('Incoming','Outgoing')),
  channel text not null,
  content text not null check(length(content) between 1 and 4000),
  staff_user uuid references profiles(id),
  external_id text unique,
  status text not null default 'Logged' check(status in ('Logged','Received'))
);
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id),
  type text not null,
  due_at timestamptz not null,
  notes text not null default '',
  status text not null default 'Open' check(status in ('Open','Completed')),
  created_by uuid references profiles(id),
  completed_by uuid references profiles(id),
  completed_at timestamptz
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  contact text not null default '',
  email text not null default '',
  phone text not null default '',
  social text not null default '',
  notes text not null default '',
  production_days integer not null default 35 check(production_days >= 0),
  shipping_notes text not null default ''
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null unique references leads(id),
  stage text not null default 'Deposit Paid' check(stage in ('Deposit Paid','Awaiting Render','Render Sent','Render Approved','Sent to Supplier','In Production','QC','Balance Due','Balance Paid','Ready to Ship','Shipped','Delivered')),
  final_price numeric(12,2) not null check(final_price >= 0),
  supplier_id uuid references suppliers(id),
  supplier_reference text not null default '',
  render_requested_at timestamptz,
  render_received_at timestamptz,
  render_sent_at timestamptz,
  render_approved_at timestamptz,
  production_start timestamptz,
  estimated_completion timestamptz,
  completed_at timestamptz,
  qc_at timestamptz,
  shipping_provider text not null default '',
  tracking_number text not null default '',
  shipped_at timestamptz,
  expected_delivery timestamptz,
  delivered_at timestamptz,
  notes text not null default '',
  supplier_notes text not null default '',
  qc_notes text not null default '',
  archived_at timestamptz,
  check(stage not in ('Shipped','Delivered') or (tracking_number <> '' and shipping_provider <> '' and shipped_at is not null))
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_id uuid not null references orders(id),
  type text not null check(type in ('Deposit','Balance','Partial payment','Refund','Other')),
  amount numeric(12,2) not null check(amount > 0 and amount <= 1000000),
  paid_at timestamptz not null default now(),
  provider text not null,
  reference text not null default '',
  status text not null check(status in ('Pending','Paid','Failed','Refunded')),
  notes text not null default '',
  recorded_by uuid references profiles(id)
);
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id),
  order_id uuid references orders(id),
  customer_id uuid references customers(id),
  filename text not null,
  category text not null,
  storage_path text not null unique,
  uploaded_by uuid references profiles(id),
  mime_type text not null,
  size bigint not null check(size > 0 and size <= 4194304)
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entity text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references profiles(id),
  metadata jsonb not null default '{}'
);
create table public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id),
  from_stage_id uuid references pipeline_stages(id),
  to_stage_id uuid not null references pipeline_stages(id),
  actor_id uuid references profiles(id)
);
create table public.order_stage_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_id uuid not null references orders(id),
  from_stage text,
  to_stage text not null,
  actor_id uuid references profiles(id)
);
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null unique,
  value jsonb not null
);
create table public.intake_requests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  lead_id uuid references leads(id)
);
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 1
);

revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
create or replace function public.is_approved() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.approved_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_approved() from public;
grant execute on function public.is_approved() to authenticated, service_role;
alter table public.profiles enable row level security;
create policy "approved_read" on public.profiles for select to authenticated using ((select public.is_approved()));
grant select on public.profiles to authenticated;
alter table public.approved_users enable row level security;
create policy "approved_read" on public.approved_users for select to authenticated using (user_id = (select auth.uid()));
grant select on public.approved_users to authenticated;
alter table public.pipeline_stages enable row level security;
create policy "approved_read" on public.pipeline_stages for select to authenticated using ((select public.is_approved()));
grant select on public.pipeline_stages to authenticated;
create policy "approved_insert" on public.pipeline_stages for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.pipeline_stages for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.pipeline_stages to authenticated;
alter table public.customers enable row level security;
create policy "approved_read" on public.customers for select to authenticated using ((select public.is_approved()));
grant select on public.customers to authenticated;
create policy "approved_insert" on public.customers for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.customers for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.customers to authenticated;
alter table public.vehicles enable row level security;
create policy "approved_read" on public.vehicles for select to authenticated using ((select public.is_approved()));
grant select on public.vehicles to authenticated;
create policy "approved_insert" on public.vehicles for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.vehicles for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.vehicles to authenticated;
alter table public.leads enable row level security;
create policy "approved_read" on public.leads for select to authenticated using ((select public.is_approved()));
grant select on public.leads to authenticated;
create policy "approved_insert" on public.leads for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.leads for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.leads to authenticated;
alter table public.wheel_specs enable row level security;
create policy "approved_read" on public.wheel_specs for select to authenticated using ((select public.is_approved()));
grant select on public.wheel_specs to authenticated;
create policy "approved_insert" on public.wheel_specs for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.wheel_specs for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.wheel_specs to authenticated;
alter table public.quotes enable row level security;
create policy "approved_read" on public.quotes for select to authenticated using ((select public.is_approved()));
grant select on public.quotes to authenticated;
create policy "approved_insert" on public.quotes for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.quotes for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.quotes to authenticated;
alter table public.quote_revisions enable row level security;
create policy "approved_read" on public.quote_revisions for select to authenticated using ((select public.is_approved()));
grant select on public.quote_revisions to authenticated;
alter table public.messages enable row level security;
create policy "approved_read" on public.messages for select to authenticated using ((select public.is_approved()));
grant select on public.messages to authenticated;
create policy "approved_insert" on public.messages for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.messages for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.messages to authenticated;
alter table public.follow_ups enable row level security;
create policy "approved_read" on public.follow_ups for select to authenticated using ((select public.is_approved()));
grant select on public.follow_ups to authenticated;
create policy "approved_insert" on public.follow_ups for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.follow_ups for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.follow_ups to authenticated;
alter table public.suppliers enable row level security;
create policy "approved_read" on public.suppliers for select to authenticated using ((select public.is_approved()));
grant select on public.suppliers to authenticated;
create policy "approved_insert" on public.suppliers for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.suppliers for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.suppliers to authenticated;
alter table public.orders enable row level security;
create policy "approved_read" on public.orders for select to authenticated using ((select public.is_approved()));
grant select on public.orders to authenticated;
create policy "approved_insert" on public.orders for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.orders for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.orders to authenticated;
alter table public.payments enable row level security;
create policy "approved_read" on public.payments for select to authenticated using ((select public.is_approved()));
grant select on public.payments to authenticated;
create policy "approved_insert" on public.payments for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.payments for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.payments to authenticated;
alter table public.attachments enable row level security;
create policy "approved_read" on public.attachments for select to authenticated using ((select public.is_approved()));
grant select on public.attachments to authenticated;
create policy "approved_insert" on public.attachments for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.attachments for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.attachments to authenticated;
alter table public.activity_logs enable row level security;
create policy "approved_read" on public.activity_logs for select to authenticated using ((select public.is_approved()));
grant select on public.activity_logs to authenticated;
alter table public.lead_stage_history enable row level security;
create policy "approved_read" on public.lead_stage_history for select to authenticated using ((select public.is_approved()));
grant select on public.lead_stage_history to authenticated;
alter table public.order_stage_history enable row level security;
create policy "approved_read" on public.order_stage_history for select to authenticated using ((select public.is_approved()));
grant select on public.order_stage_history to authenticated;
alter table public.settings enable row level security;
create policy "approved_read" on public.settings for select to authenticated using ((select public.is_approved()));
grant select on public.settings to authenticated;
create policy "approved_insert" on public.settings for insert to authenticated with check ((select public.is_approved()));
create policy "approved_update" on public.settings for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
grant insert, update on public.settings to authenticated;
alter table public.intake_requests enable row level security;
alter table public.rate_limits enable row level security;
create policy "approved_delete" on public.attachments for delete to authenticated using ((select public.is_approved()));
grant delete on public.attachments to authenticated;

create function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1)));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_json jsonb; new_json jsonb; actor uuid := auth.uid(); label text;
begin
 old_json := case when TG_OP = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
 new_json := case when TG_OP = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
 label := case when TG_OP='INSERT' then 'created' when TG_OP='DELETE' then 'removed' else 'updated' end;
 if TG_OP='UPDATE' and new_json->>'archived_at' is distinct from old_json->>'archived_at' then label:='archived'; end if;
 insert into public.activity_logs(entity,entity_id,action,actor_id,metadata)
 values(TG_TABLE_NAME,coalesce((new_json->>'id')::uuid,(old_json->>'id')::uuid),label,actor,jsonb_build_object('before',old_json,'after',new_json));
 if TG_TABLE_NAME='leads' and TG_OP='UPDATE' and new_json->>'stage_id' is distinct from old_json->>'stage_id' then
  insert into public.lead_stage_history(lead_id,from_stage_id,to_stage_id,actor_id) values(new.id,(old_json->>'stage_id')::uuid,(new_json->>'stage_id')::uuid,actor);
 end if;
 if TG_TABLE_NAME='orders' and TG_OP='UPDATE' and new_json->>'stage' is distinct from old_json->>'stage' then
  insert into public.order_stage_history(order_id,from_stage,to_stage,actor_id) values(new.id,old_json->>'stage',new_json->>'stage',actor);
 end if;
 if TG_TABLE_NAME='messages' and TG_OP='INSERT' and new_json->>'direction'='Outgoing' and new_json->>'channel'<>'Manual note' then
  update public.leads set last_contacted=(new_json->>'created_at')::timestamptz where id=(new_json->>'lead_id')::uuid;
 end if;
 if TG_TABLE_NAME='quotes' and TG_OP='UPDATE' then
  insert into public.quote_revisions(quote_id,previous_value,new_value,actor_id) values(new.id,old_json,new_json,actor);
 end if;
 return coalesce(new,old);
end; $$;
create function public.stamp_record() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at:=now();
 if TG_OP='INSERT' then new.created_at:=now(); end if;
 if TG_TABLE_NAME='messages' then new.staff_user:=auth.uid(); end if;
 if TG_TABLE_NAME='payments' then new.recorded_by:=auth.uid(); end if;
 if TG_TABLE_NAME='attachments' then new.uploaded_by:=auth.uid(); end if;
 if TG_TABLE_NAME='follow_ups' then
  if TG_OP='INSERT' then new.created_by:=auth.uid(); else new.created_by:=old.created_by; end if;
  if new.status='Completed' then
   if TG_OP='INSERT' or old.status is distinct from new.status then new.completed_by:=auth.uid();new.completed_at:=now();
   else new.completed_by:=old.completed_by;new.completed_at:=old.completed_at; end if;
  else new.completed_by:=null;new.completed_at:=null; end if;
 end if;
 return new;
end; $$;
create trigger stamp before insert or update on public.pipeline_stages for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.pipeline_stages for each row execute function public.audit_change();
create trigger stamp before insert or update on public.customers for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.customers for each row execute function public.audit_change();
create trigger stamp before insert or update on public.vehicles for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.vehicles for each row execute function public.audit_change();
create trigger stamp before insert or update on public.leads for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.leads for each row execute function public.audit_change();
create trigger stamp before insert or update on public.wheel_specs for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.wheel_specs for each row execute function public.audit_change();
create trigger stamp before insert or update on public.quotes for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.quotes for each row execute function public.audit_change();
create trigger stamp before insert or update on public.messages for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.messages for each row execute function public.audit_change();
create trigger stamp before insert or update on public.follow_ups for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.follow_ups for each row execute function public.audit_change();
create trigger stamp before insert or update on public.suppliers for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.suppliers for each row execute function public.audit_change();
create trigger stamp before insert or update on public.orders for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.orders for each row execute function public.audit_change();
create trigger stamp before insert or update on public.payments for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.payments for each row execute function public.audit_change();
create trigger stamp before insert or update on public.attachments for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.attachments for each row execute function public.audit_change();
create trigger stamp before insert or update on public.settings for each row execute function public.stamp_record();
create trigger audit after insert or update or delete on public.settings for each row execute function public.audit_change();
create index on public.vehicles(customer_id);
create index on public.leads(customer_id);
create index on public.leads(stage_id);
create index on public.leads(vehicle_id);
create index on public.leads(handled_by);
create index on public.messages(lead_id);
create index on public.follow_ups(lead_id);
create index on public.follow_ups(due_at);
create index on public.payments(order_id);
create index on public.attachments(lead_id);
create index on public.activity_logs(entity_id);
create index on public.lead_stage_history(lead_id);
create index on public.order_stage_history(order_id);
create index on public.quote_revisions(quote_id);
create index on public.orders(supplier_id);
create index customers_email_idx on public.customers(lower(email)) where email <> '';
create index customers_phone_idx on public.customers(phone) where phone <> '';
insert into public.pipeline_stages(name,position,colour,is_terminal) values('New Lead',0,'#8a8f98',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Contacted',1,'#5b84b4',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Replied',2,'#a888ca',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Quote Sent',3,'#c88a42',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Follow-Up 1',4,'#c88a42',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Follow-Up 2',5,'#c88a42',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Deposit Paid',6,'#388675',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('In Production',7,'#5b84b4',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Balance Due',8,'#c88a42',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Paid',9,'#388675',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Shipped',10,'#5b84b4',false);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Completed',11,'#388675',true);
insert into public.pipeline_stages(name,position,colour,is_terminal) values('Lost',12,'#8a8f98',true);

insert into public.settings(key,value) values
 ('lead_sources','["Website","Instagram","Facebook","SMS","Phone","Email","Referral","Marketplace","Walk-in","Other"]'),
 ('follow_up_types','["First outreach","Quote follow-up","Second follow-up","Deposit follow-up","Render approval","Balance reminder","Delivery follow-up","General"]');

-- A single transaction creates customer, vehicle and lead. Match contact details first.
create function public.create_lead(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare cid uuid; vid uuid; lid uuid;
begin
 if not public.is_approved() and current_user <> 'service_role' then raise exception 'Access denied'; end if;
 -- Low-volume two-person CRM: serialise customer matching to prevent parallel duplicates.
 perform pg_advisory_xact_lock(62817490);
 select id into cid from public.customers where archived_at is null and
 ((payload->>'email' <> '' and lower(email)=lower(payload->>'email')) or (payload->>'phone' <> '' and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(payload->>'phone','[^0-9]','','g'))) order by created_at limit 1;
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

create function public.convert_lead(p_lead_id uuid,p_amount numeric,p_reference text) returns uuid language plpgsql security invoker set search_path='' as $$
declare q public.quotes; oid uuid; deposit_stage uuid;
begin
 if not public.is_approved() then raise exception 'Access denied'; end if;
 perform 1 from public.leads where id=p_lead_id and archived_at is null for update;
 if not found then raise exception 'Lead not found'; end if;
 select * into q from public.quotes where lead_id=p_lead_id for update;
 if not found or q.status in ('Declined','Expired') then raise exception 'Create an active quote before converting'; end if;
 if p_amount <= 0 or p_amount > q.base_price-q.discount then raise exception 'Invalid deposit'; end if;
 insert into public.orders(lead_id,final_price) values(p_lead_id,q.base_price-q.discount) returning id into oid;
 insert into public.payments(order_id,type,amount,provider,reference,status) values(oid,'Deposit',p_amount,'Manual record',p_reference,'Paid');
 update public.quotes set status='Accepted' where id=q.id;
 select id into deposit_stage from public.pipeline_stages where name='Deposit Paid';
 if deposit_stage is not null then update public.leads set stage_id=deposit_stage where id=p_lead_id; end if;
 return oid;
end; $$;
revoke all on function public.convert_lead(uuid,numeric,text) from public;
grant execute on function public.convert_lead(uuid,numeric,text) to authenticated;

-- Cross-instance rate limit, not an in-memory serverless counter.
create function public.take_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.rate_limits(key,window_start,count) values(p_key,now(),1)
 on conflict(key) do update set
 count=case when public.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then 1 else public.rate_limits.count+1 end,
 window_start=case when public.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then now() else public.rate_limits.window_start end
 returning count into n;
 return n<=p_limit;
end; $$;
revoke all on function public.take_rate_limit(text,integer,integer) from public;
grant execute on function public.take_rate_limit(text,integer,integer) to service_role;

create function public.intake_lead(payload jsonb,p_request_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare lid uuid; sid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select lead_id into lid from public.intake_requests where id=p_request_id;
 if lid is not null then return lid; end if;
 select id into sid from public.pipeline_stages order by position limit 1;
 lid:=public.create_lead(payload || jsonb_build_object('stage_id',sid,'source','Website'));
 insert into public.intake_requests(id,lead_id) values(p_request_id,lid);
 return lid;
end; $$;
revoke all on function public.intake_lead(jsonb,uuid) from public;
grant execute on function public.intake_lead(jsonb,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('crm-files','crm-files',false,4194304,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=4194304,allowed_mime_types=excluded.allowed_mime_types;
create policy "approved_file_read" on storage.objects for select to authenticated using(bucket_id='crm-files' and (select public.is_approved()));
create policy "approved_file_upload" on storage.objects for insert to authenticated with check(bucket_id='crm-files' and (select public.is_approved()));
create policy "approved_file_delete" on storage.objects for delete to authenticated using(bucket_id='crm-files' and (select public.is_approved()));
-- Explicit grants; no table is exposed through the anonymous API.
revoke all on all tables in schema public from anon;
revoke all on function public.audit_change() from public;
revoke all on function public.create_profile() from public;
revoke all on function public.stamp_record() from public;

-- Business invariants apply to direct REST writes as well as the application.
create function public.enforce_business_rules() returns trigger language plpgsql set search_path='' as $$
declare total numeric; already_paid numeric; lead_customer uuid; order_lead uuid;
begin
 if TG_TABLE_NAME='payments' then
  if TG_OP='UPDATE' and new.order_id is distinct from old.order_id then raise exception 'Payment order cannot change'; end if;
  select final_price into total from public.orders where id=new.order_id for update;
  select coalesce(sum(case when type='Refund' then -amount else amount end),0) into already_paid
    from public.payments where order_id=new.order_id and status='Paid' and id<>new.id;
  if new.status='Paid' then already_paid:=already_paid+case when new.type='Refund' then -new.amount else new.amount end; end if;
  if already_paid<0 or already_paid>total then raise exception 'Payment exceeds outstanding balance or refundable amount'; end if;
 end if;
 if TG_TABLE_NAME='orders' then
  if TG_OP='UPDATE' and (new.final_price is distinct from old.final_price or new.lead_id is distinct from old.lead_id) then raise exception 'Agreed order price and lead cannot change'; end if;
  if new.stage in ('Balance Paid','Ready to Ship','Shipped','Delivered') then
   select coalesce(sum(case when type='Refund' then -amount else amount end),0) into already_paid from public.payments where order_id=new.id and status='Paid';
   if already_paid<new.final_price then raise exception 'Record the full balance before shipping'; end if;
  end if;
  if new.stage='Delivered' and new.delivered_at is null then raise exception 'Delivery date is required'; end if;
 end if;
 if TG_TABLE_NAME='attachments' then
  select customer_id into lead_customer from public.leads where id=new.lead_id;
  if new.customer_id is not null and new.customer_id<>lead_customer then raise exception 'File customer does not match lead'; end if;
  if new.order_id is not null then
   select lead_id into order_lead from public.orders where id=new.order_id;
   if order_lead<>new.lead_id then raise exception 'File order does not match lead'; end if;
  end if;
 end if;
 return new;
end; $$;
create trigger business_rules before insert or update on public.payments for each row execute function public.enforce_business_rules();
create trigger business_rules before insert or update on public.orders for each row execute function public.enforce_business_rules();
create trigger business_rules before insert or update on public.attachments for each row execute function public.enforce_business_rules();
revoke all on function public.enforce_business_rules() from public;
-- Profiles may predate this migration in an existing Auth project.
insert into public.profiles(id,display_name)
 select id,coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(email,'@',1)) from auth.users on conflict(id) do nothing;
commit;
