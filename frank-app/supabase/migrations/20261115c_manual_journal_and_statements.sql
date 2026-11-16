-- Manual transactions (expenses, supplier payments, cash sales, owner money, opening balance) and the
-- totals the financial statements are built from.
--
-- Same rules as invoices: the tenant comes from the session, the database refuses an unbalanced entry,
-- posted entries are never edited, and a mistake is fixed with a reversing entry (one per entry).

-- More expense accounts for a small business.
insert into public.chart_accounts (code, name, type) values
  ('6500', 'Marketing and advertising', 'expense'),
  ('6600', 'Professional fees', 'expense'),
  ('6700', 'Insurance', 'expense'),
  ('6800', 'Vehicle and travel', 'expense'),
  ('6850', 'Repairs and maintenance', 'expense')
on conflict (code) do nothing;

-- Manual entries are a new kind of source.
alter table public.journal_entries drop constraint if exists journal_entries_source_type_check;
alter table public.journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('invoice', 'payment', 'reversal', 'manual'));

-- An entry can be reversed once, whoever reverses it.
create unique index if not exists journal_entries_one_reversal on public.journal_entries (reverses) where reverses is not null;

-- Post a manual transaction. Customer balances (1100 Debtors) are only ever moved by invoices and payments,
-- so a manual entry may not touch them. Lines: [{ "account": "6200", "debit": 1000, "credit": 0 }, ...] in cents.
create or replace function public.post_manual_journal(p_date date, p_memo text, p_lines jsonb) returns uuid
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); l jsonb; n integer;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if p_date is null or p_date < date '2000-01-01' or p_date > current_date + 366 then raise exception 'That date is not valid'; end if;
  if p_memo is null or length(trim(p_memo)) = 0 or length(p_memo) > 200 then raise exception 'Add a short description (up to 200 characters)'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Invalid entry'; end if;
  n := jsonb_array_length(p_lines);
  if n < 2 or n > 20 then raise exception 'An entry needs between 2 and 20 lines'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if l->>'account' = '1100' then raise exception 'Debtors can only be changed by issuing invoices and recording payments'; end if;
    if coalesce((l->>'debit')::bigint, 0) < 0 or coalesce((l->>'credit')::bigint, 0) < 0 then raise exception 'Amounts cannot be negative'; end if;
  end loop;
  return post_journal(tid, p_date, trim(p_memo), 'manual', null, null, p_lines);
end $$;

-- Reverse a manual entry: every debit and credit swapped, dated today. The original stays on record.
create or replace function public.reverse_journal_entry(p_entry uuid) returns uuid
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); orig public.journal_entries; rev_lines jsonb;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into orig from journal_entries where id = p_entry and tenant_id = tid;
  if not found then raise exception 'Entry not found'; end if;
  if orig.source_type <> 'manual' then raise exception 'Only transactions you recorded by hand can be reversed here. Void an invoice from its own page.'; end if;
  if exists (select 1 from journal_entries where reverses = p_entry) then raise exception 'This entry has already been reversed'; end if;
  select jsonb_agg(jsonb_build_object('account', account_code, 'debit', credit_cents, 'credit', debit_cents))
    into rev_lines from journal_lines where entry_id = p_entry;
  return post_journal(tid, current_date, 'Reversal of ' || orig.memo, 'reversal', p_entry, p_entry, rev_lines);
end $$;

-- What the statements are built from: per account, everything BEFORE p_from (opening) and everything from
-- p_from to p_to (the period). Runs as the caller, so row-level security keeps it to their own books.
create or replace function public.ledger_totals(p_from date, p_to date)
returns table (account_code text, opening_debit bigint, opening_credit bigint, period_debit bigint, period_credit bigint)
language sql stable security invoker set search_path = public as
$$
  select jl.account_code,
    coalesce(sum(jl.debit_cents)  filter (where je.entry_date <  p_from), 0)::bigint,
    coalesce(sum(jl.credit_cents) filter (where je.entry_date <  p_from), 0)::bigint,
    coalesce(sum(jl.debit_cents)  filter (where je.entry_date >= p_from), 0)::bigint,
    coalesce(sum(jl.credit_cents) filter (where je.entry_date >= p_from), 0)::bigint
  from journal_lines jl join journal_entries je on je.id = jl.entry_id
  where je.entry_date <= p_to
  group by jl.account_code
$$;

revoke all on function public.post_manual_journal(date, text, jsonb), public.reverse_journal_entry(uuid),
  public.ledger_totals(date, date) from public, anon;
grant execute on function public.post_manual_journal(date, text, jsonb), public.reverse_journal_entry(uuid),
  public.ledger_totals(date, date) to authenticated;
