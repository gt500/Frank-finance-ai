-- Bank statement lines posted to the ledger, equipment and depreciation, stock counts, and the income tax rate.
--
-- Same rules as the rest of the ledger: the tenant always comes from the session, the database refuses an
-- unbalanced entry, posted entries are never edited, and a mistake is fixed with a reversing entry.
-- Run after 20261115a, b and c.

insert into public.chart_accounts (code, name, type) values
  ('1510', 'Accumulated depreciation', 'asset'),      -- credit balance, taken off equipment
  ('6950', 'Depreciation', 'expense')
on conflict (code) do nothing;

alter table public.journal_entries drop constraint if exists journal_entries_source_type_check;
alter table public.journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('invoice', 'payment', 'reversal', 'manual', 'bank', 'asset', 'depreciation', 'stock'));

-- ── Shared checks for entries that come from the browser ──────────────────────────────────
create or replace function public.check_entry_input(p_date date, p_memo text, p_lines jsonb) returns void
language plpgsql stable set search_path = public as
$$
declare l jsonb; n integer;
begin
  if p_date is null or p_date < date '2000-01-01' or p_date > current_date + 366 then raise exception 'That date is not valid'; end if;
  if p_memo is null or length(trim(p_memo)) = 0 or length(p_memo) > 200 then raise exception 'Add a short description (up to 200 characters)'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Invalid entry'; end if;
  n := jsonb_array_length(p_lines);
  if n < 2 or n > 20 then raise exception 'An entry needs between 2 and 20 lines'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if l->>'account' = '1100' then raise exception 'Debtors can only be changed by issuing invoices and recording payments'; end if;
    if coalesce((l->>'debit')::bigint, 0) < 0 or coalesce((l->>'credit')::bigint, 0) < 0 then raise exception 'Amounts cannot be negative'; end if;
  end loop;
end $$;
revoke all on function public.check_entry_input(date, text, jsonb) from public, anon, authenticated;

-- ── Bank statement lines ──────────────────────────────────────────────────────────────────
-- One row per bank line that has been posted (entry_id) or set aside as not business (entry_id null).
create table if not exists public.bank_postings (
  tenant_id text not null default public.current_tenant_id(),
  line_key text not null check (length(line_key) between 1 and 300),
  entry_id uuid references public.journal_entries (id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, line_key)
);

-- What the client taught Zeeder: "payments to this name go to this account".
create table if not exists public.bank_rules (
  tenant_id text not null default public.current_tenant_id(),
  match text not null check (length(match) between 2 and 80),
  account text not null references public.chart_accounts (code),
  vat boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, match)
);

-- Is this entry still standing (not reversed)?
create or replace function public.entry_is_live(p_entry uuid) returns boolean
language sql stable set search_path = public as
$$ select p_entry is not null and not exists (select 1 from journal_entries where reverses = p_entry) $$;
revoke all on function public.entry_is_live(uuid) from public, anon;
grant execute on function public.entry_is_live(uuid) to authenticated;

-- Every bank line that has been posted or set aside, and whether its entry still stands (runs as the caller).
create or replace function public.list_bank_postings() returns table (line_key text, entry_id uuid, live boolean)
language sql stable security invoker set search_path = public as
$$ select bp.line_key, bp.entry_id, public.entry_is_live(bp.entry_id) from bank_postings bp $$;
grant execute on function public.list_bank_postings() to authenticated;
revoke all on function public.list_bank_postings() from public, anon;

-- Post one bank line. Safe to call twice: a line that is already posted returns its existing entry, so an
-- automatic run can never post a line a second time. A line whose entry was reversed can be posted again.
create or replace function public.post_bank_line(p_key text, p_date date, p_memo text, p_lines jsonb) returns uuid
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); bp public.bank_postings; eid uuid;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  perform public.check_entry_input(p_date, p_memo, p_lines);
  if not exists (select 1 from jsonb_array_elements(p_lines) l where l->>'account' = '1000') then
    raise exception 'A bank line must move the bank account';
  end if;
  perform pg_advisory_xact_lock(hashtext(tid || '|' || p_key));
  select * into bp from bank_postings where tenant_id = tid and line_key = p_key;
  if found and public.entry_is_live(bp.entry_id) then return bp.entry_id; end if;
  eid := post_journal(tid, p_date, trim(p_memo), 'bank', null, null, p_lines);
  insert into bank_postings (tenant_id, line_key, entry_id) values (tid, p_key, eid)
    on conflict (tenant_id, line_key) do update set entry_id = excluded.entry_id, created_at = now();
  return eid;
end $$;

-- Set a line aside (a transfer between your own accounts, or not business at all).
create or replace function public.skip_bank_line(p_key text) returns void
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); bp public.bank_postings;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if p_key is null or length(p_key) not between 1 and 300 then raise exception 'Invalid bank line'; end if;
  perform pg_advisory_xact_lock(hashtext(tid || '|' || p_key));
  select * into bp from bank_postings where tenant_id = tid and line_key = p_key;
  if found and public.entry_is_live(bp.entry_id) then raise exception 'This line is already posted. Reverse it first.'; end if;
  insert into bank_postings (tenant_id, line_key, entry_id) values (tid, p_key, null)
    on conflict (tenant_id, line_key) do update set entry_id = null, created_at = now();
end $$;

create or replace function public.save_bank_rule(p_match text, p_account text, p_vat boolean) returns void
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); m text := lower(trim(coalesce(p_match, '')));
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if length(m) not between 2 and 80 then raise exception 'That name is too short or too long to remember'; end if;
  if p_account in ('1000', '1100') or not exists (select 1 from chart_accounts where code = p_account) then raise exception 'Choose an account'; end if;
  insert into bank_rules (tenant_id, match, account, vat) values (tid, m, p_account, coalesce(p_vat, false))
    on conflict (tenant_id, match) do update set account = excluded.account, vat = excluded.vat, updated_at = now();
end $$;

create or replace function public.delete_bank_rule(p_match text) returns void
language sql security definer set search_path = public as
$$ delete from bank_rules where tenant_id = public.current_tenant_id() and match = lower(trim(coalesce(p_match, ''))) $$;

-- A bank line posted by Zeeder can be reversed like one recorded by hand.
create or replace function public.reverse_journal_entry(p_entry uuid) returns uuid
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); orig public.journal_entries; rev_lines jsonb;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into orig from journal_entries where id = p_entry and tenant_id = tid;
  if not found then raise exception 'Entry not found'; end if;
  if orig.source_type not in ('manual', 'bank') then raise exception 'Only transactions you recorded by hand or posted from your bank statement can be reversed here. Void an invoice from its own page.'; end if;
  if exists (select 1 from journal_entries where reverses = p_entry) then raise exception 'This entry has already been reversed'; end if;
  select jsonb_agg(jsonb_build_object('account', account_code, 'debit', credit_cents, 'credit', debit_cents))
    into rev_lines from journal_lines where entry_id = p_entry;
  return post_journal(tid, current_date, 'Reversal of ' || orig.memo, 'reversal', p_entry, p_entry, rev_lines);
end $$;

-- ── Equipment and depreciation (straight line, whole months, from the month of purchase) ──
create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default public.current_tenant_id(),
  name text not null check (length(trim(name)) between 1 and 100),
  cost_cents bigint not null check (cost_cents > 0),
  residual_cents bigint not null default 0 check (residual_cents >= 0),
  purchase_date date not null check (purchase_date >= date '2000-01-01'),
  life_months integer not null check (life_months between 1 and 600),
  entry_id uuid references public.journal_entries (id),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  check (residual_cents < cost_cents)
);
create index if not exists fixed_assets_tenant_idx on public.fixed_assets (tenant_id);

-- Record the equipment and its purchase. p_total_cents includes VAT; the cost that is depreciated excludes it.
-- p_funding: 'bank' (paid), 'creditors' (owed to a supplier) or 'opening' (you already owned it; no VAT).
create or replace function public.add_fixed_asset(
  p_name text, p_total_cents bigint, p_vat_cents bigint, p_date date, p_residual_cents bigint, p_life_months integer, p_funding text)
returns uuid language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); cost bigint; aid uuid := gen_random_uuid(); eid uuid; src text; lines jsonb;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if p_total_cents is null or p_total_cents <= 0 then raise exception 'Enter the price of the equipment'; end if;
  if coalesce(p_vat_cents, 0) < 0 or coalesce(p_vat_cents, 0) >= p_total_cents then raise exception 'The VAT is not valid'; end if;
  src := case p_funding when 'bank' then '1000' when 'creditors' then '2000' when 'opening' then '3000' end;
  if src is null then raise exception 'Choose how it was paid for'; end if;
  if p_funding = 'opening' and coalesce(p_vat_cents, 0) > 0 then raise exception 'Equipment you already owned has no VAT to claim'; end if;
  cost := p_total_cents - coalesce(p_vat_cents, 0);
  if coalesce(p_residual_cents, 0) < 0 or coalesce(p_residual_cents, 0) >= cost then raise exception 'The value left at the end must be less than the cost'; end if;
  if p_life_months is null or p_life_months not between 1 and 600 then raise exception 'Enter how many months it will last'; end if;
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 100 then raise exception 'Give the equipment a short name'; end if;
  lines := jsonb_build_array(jsonb_build_object('account', '1500', 'debit', cost, 'credit', 0))
    || case when coalesce(p_vat_cents, 0) > 0 then jsonb_build_array(jsonb_build_object('account', '2210', 'debit', p_vat_cents, 'credit', 0)) else '[]'::jsonb end
    || jsonb_build_array(jsonb_build_object('account', src, 'debit', 0, 'credit', p_total_cents));
  perform public.check_entry_input(p_date, 'Equipment: ' || trim(p_name), lines);
  eid := post_journal(tid, p_date, 'Equipment: ' || trim(p_name), 'asset', aid, null, lines);
  insert into fixed_assets (id, tenant_id, name, cost_cents, residual_cents, purchase_date, life_months, entry_id)
    values (aid, tid, trim(p_name), cost, coalesce(p_residual_cents, 0), p_date, p_life_months, eid);
  return aid;
end $$;

-- What depreciation SHOULD stand at the end of each month, against what is already in the books; any
-- difference is posted dated that month-end. Only whole months that have ended are posted, and running it
-- again changes nothing, so it can be run whenever statements are prepared.
create or replace function public.run_depreciation(p_tenant text, p_through date) returns integer
language plpgsql security definer set search_path = public as
$$
declare m date; last_m date; month_end date; expected bigint; posted bigint; diff bigint; n integer := 0; first_m date;
begin
  last_m := date_trunc('month', least(p_through, current_date))::date;
  if (last_m + interval '1 month' - interval '1 day')::date > current_date then last_m := (last_m - interval '1 month')::date; end if;
  select least(
      (select date_trunc('month', min(purchase_date))::date from fixed_assets where tenant_id = p_tenant),
      (select date_trunc('month', min(entry_date))::date from journal_entries where tenant_id = p_tenant and source_type = 'depreciation'))
    into first_m;
  if first_m is null then return 0; end if;
  m := first_m;
  while m <= last_m loop
    month_end := (m + interval '1 month' - interval '1 day')::date;
    select coalesce(sum(round((cost_cents - residual_cents)::numeric
        * least(life_months, ((extract(year from m) - extract(year from purchase_date)) * 12 + extract(month from m) - extract(month from purchase_date) + 1)::int)
        / life_months)), 0)::bigint
      into expected from fixed_assets
      where tenant_id = p_tenant and voided_at is null and date_trunc('month', purchase_date)::date <= m;
    select coalesce(sum(jl.credit_cents - jl.debit_cents), 0)::bigint into posted
      from journal_lines jl join journal_entries je on je.id = jl.entry_id
      where jl.tenant_id = p_tenant and jl.account_code = '1510' and je.entry_date <= month_end;
    diff := expected - posted;
    if diff <> 0 then
      perform post_journal(p_tenant, month_end, 'Depreciation for ' || to_char(m, 'FMMonth YYYY'), 'depreciation', null, null,
        jsonb_build_array(
          jsonb_build_object('account', case when diff > 0 then '6950' else '1510' end, 'debit', abs(diff), 'credit', 0),
          jsonb_build_object('account', case when diff > 0 then '1510' else '6950' end, 'debit', 0, 'credit', abs(diff))));
      n := n + 1;
    end if;
    m := (m + interval '1 month')::date;
  end loop;
  return n;
end $$;
revoke all on function public.run_depreciation(text, date) from public, anon, authenticated;

create or replace function public.post_depreciation(p_through date default current_date) returns integer
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id();
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  return public.run_depreciation(tid, coalesce(p_through, current_date));
end $$;

-- A mistake in the register: reverse the purchase, take the equipment out, and correct depreciation.
create or replace function public.void_fixed_asset(p_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); a public.fixed_assets; rev_lines jsonb;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into a from fixed_assets where id = p_id and tenant_id = tid for update;
  if not found then raise exception 'Equipment not found'; end if;
  if a.voided_at is not null then raise exception 'This equipment has already been removed'; end if;
  select jsonb_agg(jsonb_build_object('account', account_code, 'debit', credit_cents, 'credit', debit_cents))
    into rev_lines from journal_lines where entry_id = a.entry_id;
  perform post_journal(tid, current_date, 'Reversal of equipment ' || a.name, 'reversal', a.entry_id, a.entry_id, rev_lines);
  update fixed_assets set voided_at = now() where id = p_id;
  perform public.run_depreciation(tid, current_date);
end $$;

-- ── Stock count ───────────────────────────────────────────────────────────────────────────
-- The client counts what is on the shelves and says what it is worth. Stock is moved to that value and the
-- difference goes to cost of sales (stock bought goes into Stock, so the count writes off what has been used up).
create or replace function public.post_stock_count(p_date date, p_value_cents bigint) returns uuid
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); cur bigint; diff bigint;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if p_date is null or p_date < date '2000-01-01' or p_date > current_date then raise exception 'That date is not valid'; end if;
  if p_value_cents is null or p_value_cents < 0 then raise exception 'Enter the value of the stock you counted'; end if;
  select coalesce(sum(jl.debit_cents - jl.credit_cents), 0)::bigint into cur
    from journal_lines jl join journal_entries je on je.id = jl.entry_id
    where jl.tenant_id = tid and jl.account_code = '1200' and je.entry_date <= p_date;
  diff := p_value_cents - cur;
  if diff = 0 then return null; end if;
  return post_journal(tid, p_date, 'Stock count adjustment', 'stock', null, null, jsonb_build_array(
    jsonb_build_object('account', case when diff > 0 then '1200' else '5000' end, 'debit', abs(diff), 'credit', 0),
    jsonb_build_object('account', case when diff > 0 then '5000' else '1200' end, 'debit', 0, 'credit', abs(diff))));
end $$;

-- ── Income tax rate (an estimate shown on the statements; nothing is posted for it) ───────
create table if not exists public.tax_settings (
  tenant_id text primary key default public.current_tenant_id(),
  rate_percent numeric(5, 2) not null default 27 check (rate_percent >= 0 and rate_percent <= 45),
  updated_at timestamptz not null default now()
);

-- ── Row-level security and grants ─────────────────────────────────────────────────────────
alter table public.bank_postings enable row level security;
alter table public.bank_rules enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.tax_settings enable row level security;

drop policy if exists "bank_postings: read own" on public.bank_postings;
create policy "bank_postings: read own" on public.bank_postings for select to authenticated using (tenant_id = public.current_tenant_id());
drop policy if exists "bank_rules: read own" on public.bank_rules;
create policy "bank_rules: read own" on public.bank_rules for select to authenticated using (tenant_id = public.current_tenant_id());
drop policy if exists "fixed_assets: read own" on public.fixed_assets;
create policy "fixed_assets: read own" on public.fixed_assets for select to authenticated using (tenant_id = public.current_tenant_id());
drop policy if exists "tax_settings: read own" on public.tax_settings;
drop policy if exists "tax_settings: insert own" on public.tax_settings;
drop policy if exists "tax_settings: update own" on public.tax_settings;
create policy "tax_settings: read own" on public.tax_settings for select to authenticated using (tenant_id = public.current_tenant_id());
create policy "tax_settings: insert own" on public.tax_settings for insert to authenticated with check (tenant_id = public.current_tenant_id());
create policy "tax_settings: update own" on public.tax_settings for update to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

revoke all on public.bank_postings, public.bank_rules, public.fixed_assets, public.tax_settings from anon, authenticated;
grant select on public.bank_postings, public.bank_rules, public.fixed_assets to authenticated;
grant select, insert, update on public.tax_settings to authenticated;

revoke all on function public.post_bank_line(text, date, text, jsonb), public.skip_bank_line(text), public.save_bank_rule(text, text, boolean),
  public.delete_bank_rule(text), public.reverse_journal_entry(uuid),
  public.add_fixed_asset(text, bigint, bigint, date, bigint, integer, text), public.post_depreciation(date),
  public.void_fixed_asset(uuid), public.post_stock_count(date, bigint) from public, anon;
grant execute on function public.post_bank_line(text, date, text, jsonb), public.skip_bank_line(text), public.save_bank_rule(text, text, boolean),
  public.delete_bank_rule(text), public.reverse_journal_entry(uuid),
  public.add_fixed_asset(text, bigint, bigint, date, bigint, integer, text), public.post_depreciation(date),
  public.void_fixed_asset(uuid), public.post_stock_count(date, bigint) to authenticated;

-- ── Account deletion must also remove what this file adds (the bank and equipment rows point at journal entries) ──
create or replace function public.purge_tenant_ledger(p_tenant text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform set_config('app.purging', 'on', true);
  delete from bank_postings where tenant_id = p_tenant;
  delete from bank_rules where tenant_id = p_tenant;
  delete from fixed_assets where tenant_id = p_tenant;
  delete from tax_settings where tenant_id = p_tenant;
  delete from journal_lines where tenant_id = p_tenant;
  delete from journal_entries where tenant_id = p_tenant;
  delete from document_payments where tenant_id = p_tenant;
  delete from mail_log where tenant_id = p_tenant;
  delete from document_lines where tenant_id = p_tenant;
  delete from documents where tenant_id = p_tenant;
  delete from document_counters where tenant_id = p_tenant;
  delete from invoice_settings where tenant_id = p_tenant;
  perform delete_mailbox(p_tenant);
end $$;
revoke all on function public.purge_tenant_ledger(text) from public, anon, authenticated;
grant execute on function public.purge_tenant_ledger(text) to service_role;
