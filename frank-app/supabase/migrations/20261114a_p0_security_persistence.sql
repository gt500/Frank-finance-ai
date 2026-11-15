create or replace function public.current_tenant_id()
returns text language sql stable security definer set search_path = public as
$$ select tenant_id from public.profiles where id = auth.uid() $$;

create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.tenant_id is distinct from old.tenant_id or new.role is distinct from old.role or new.email is distinct from old.email then
      raise exception 'Only your name can be changed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_columns on public.profiles;
create trigger profiles_guard_columns before update on public.profiles for each row execute function public.guard_profile_columns();

create table if not exists public.tenants (
  id text primary key, owner_id uuid references auth.users(id) on delete set null,
  profile jsonb not null, created_at timestamptz not null default now());
create table if not exists public.tenant_data (
  tenant_id text primary key, bank_data jsonb, imported jsonb not null default '{}'::jsonb,
  monthly jsonb, simplepay_connected boolean not null default false, updated_at timestamptz not null default now());
create table if not exists public.tenant_secrets (
  tenant_id text primary key, simplepay_key text, simplepay_client_id text, updated_at timestamptz not null default now());
create table if not exists public.ai_usage (
  tenant_id text not null, day date not null default current_date, count integer not null default 0, primary key (tenant_id, day));
alter table public.tenants enable row level security;
alter table public.tenant_data enable row level security;
alter table public.tenant_secrets enable row level security;
alter table public.ai_usage enable row level security;
drop policy if exists "tenants: read own" on public.tenants;
create policy "tenants: read own" on public.tenants for select using (id = public.current_tenant_id());
drop policy if exists "tenant_data: read own" on public.tenant_data;
drop policy if exists "tenant_data: insert own" on public.tenant_data;
drop policy if exists "tenant_data: update own" on public.tenant_data;
create policy "tenant_data: read own" on public.tenant_data for select using (tenant_id = public.current_tenant_id());
create policy "tenant_data: insert own" on public.tenant_data for insert with check (tenant_id = public.current_tenant_id());
create policy "tenant_data: update own" on public.tenant_data for update using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
-- tenant_secrets + ai_usage: RLS on, no client policies = service-role only.

drop policy if exists "charges: read own tenant" on public.subscription_charges;
create policy "charges: read own tenant" on public.subscription_charges for select using (
  subscription_id in (select id from public.subscriptions where tenant_id = public.current_tenant_id()));
create unique index if not exists one_active_sub_per_tenant on public.subscriptions (tenant_id) where status = 'active';

create or replace function public.increment_ai_usage(tid text)
returns void language sql security definer set search_path = public as
$$ insert into ai_usage (tenant_id, day, count) values (tid, current_date, 1)
   on conflict (tenant_id, day) do update set count = ai_usage.count + 1 $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  tid text; biz text := coalesce(nullif(meta->>'business_name',''),'My Business');
  sec text := coalesce(nullif(meta->>'sector',''),'Other');
  loc text := coalesce(nullif(meta->>'location',''),'South Africa');
  stf int := greatest(coalesce(nullif(meta->>'staff','')::int,1),1);
  growth boolean := meta->>'plan' = 'growth';
begin
  tid := meta->>'tenant_id';
  if tid is null or tid !~ '^tenant-[0-9]{10,}$'
     or exists (select 1 from public.profiles where tenant_id = tid)
     or exists (select 1 from public.tenants where id = tid) then
    tid := 'tenant-' || (extract(epoch from now())*1000)::bigint::text || '-' || substr(gen_random_uuid()::text,1,4);
  end if;
  insert into public.profiles (id, email, name, tenant_id) values (new.id, new.email, nullif(meta->>'name',''), tid) on conflict (id) do nothing;
  insert into public.tenants (id, owner_id, profile) values (tid, new.id, jsonb_build_object(
    'id',tid,'name',biz,'owner',coalesce(nullif(meta->>'name',''),''),'sector',sec,'location',loc,'staff',stf,'children',null,
    'bank','','accounting','Manual (no software)','currency','ZAR','plan',case when growth then 'Growth' else 'Starter' end,
    'planPrice',case when growth then 999 else 499 end,'trialStart',now()::text,
    'systemPrompt','You are Zeeder, a financial AI assistant for '||biz||', a '||sec||' business based in '||loc||' with '||stf||' staff. Help with financial analysis, cash flow insights, and business advice. Be concise and practical.',
    'data',jsonb_build_object(
      'MONTHLY',jsonb_build_array(jsonb_build_object('m',to_char(now(),'Mon YY'),'y',extract(year from now())::int,'fees',0,'subsidy',0,'rev',0,'exp',0,'net',0,'cash',0,'take','No data yet — upload a bank statement to get started.')),
      'WEEKLY_FORECAST','[]'::jsonb,
      'EXPENSES',jsonb_build_array(
        jsonb_build_object('name','Staff salaries','value',0,'pct',0,'color','#8B72FF'),
        jsonb_build_object('name','Rent & utilities','value',0,'pct',0,'color','#FF3D57'),
        jsonb_build_object('name','Stock & supplies','value',0,'pct',0,'color','#FF6B35'),
        jsonb_build_object('name','Admin & compliance','value',0,'pct',0,'color','#F5C518'),
        jsonb_build_object('name','Other','value',0,'pct',0,'color','#7A8599')),
      'DEBTORS','[]'::jsonb,'CREDITORS','[]'::jsonb,'CASHFLOW_FLAGS','[]'::jsonb,
      'HEALTH_CHECKS',jsonb_build_array(
        jsonb_build_object('id','cf','label','Cash Runway','score',0,'status','warn','priority','MED','message','Upload a bank statement to calculate your cash runway.','action','Upload your most recent bank statement'),
        jsonb_build_object('id','fee','label','Debtor Collection','score',0,'status','warn','priority','MED','message','No debtor data yet. Add who owes you money.','action','Add your outstanding customer invoices'),
        jsonb_build_object('id','stf','label','Staff Cost Ratio','score',0,'status','warn','priority','MED','message','No payroll data yet.','action','Upload a statement showing salary payments'),
        jsonb_build_object('id','sub','label','Revenue Trend','score',0,'status','warn','priority','MED','message','No revenue history yet.','action','Upload monthly bank statements'),
        jsonb_build_object('id','run','label','Runway','score',0,'status','warn','priority','MED','message','Cannot calculate runway without a cash balance.','action','Upload a bank statement'),
        jsonb_build_object('id','cmp','label','Compliance','score',0,'status','warn','priority','MED','message','Review your CIPC and tax registrations.','action','Confirm CIPC and SARS registrations are current')),
      'BRIEFING',jsonb_build_array(
        jsonb_build_object('severity','med','text','Welcome to Zeeder! Your '||biz||' workspace is ready.'),
        jsonb_build_object('severity','med','text','Upload a bank statement to populate your cash flow dashboard.'),
        jsonb_build_object('severity','med','text','Add your debtors and creditors for a complete financial picture.'))
    ))) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function trigger_due_charges() returns void language plpgsql security definer as
$$
declare rec record; service_key text; func_url text;
begin
  select decrypted_secret into service_key from vault.decrypted_secrets where name='service_role_key';
  select decrypted_secret into func_url from vault.decrypted_secrets where name='paygate_charge_url';
  if service_key is null then raise exception 'vault secret service_role_key missing'; end if;
  if func_url is null then raise exception 'vault secret paygate_charge_url missing'; end if;
  for rec in select id from subscriptions where status='active' and next_charge_at is not null and next_charge_at<=now() loop
    perform net.http_post(url:=func_url, headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key), body:=jsonb_build_object('subscription_id',rec.id));
  end loop;
end $$;