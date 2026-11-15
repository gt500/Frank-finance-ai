-- Invoices, quotes and a double-entry ledger for Zeeder Finance OS.
--
-- The database is the authority: it numbers documents, recomputes totals from the lines, posts the
-- journal entries, and refuses unbalanced or edited entries. The browser can only write DRAFTS;
-- everything after that goes through the functions at the bottom (tenant derived from auth.uid(),
-- never from a parameter). Money is whole cents. VAT is 15%, once, on the document subtotal.

-- ── Chart of accounts: shared, read-only reference data ─────────────────────────────────────
create table if not exists public.chart_accounts (
  code text primary key,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense'))
);
insert into public.chart_accounts (code, name, type) values
  ('1000', 'Bank', 'asset'),
  ('1100', 'Debtors (trade receivables)', 'asset'),
  ('1200', 'Stock', 'asset'),
  ('1500', 'Equipment', 'asset'),
  ('2000', 'Creditors (trade payables)', 'liability'),
  ('2200', 'VAT output', 'liability'),
  ('2210', 'VAT input', 'asset'),
  ('2300', 'Loans', 'liability'),
  ('3000', 'Owner''s equity', 'equity'),
  ('3100', 'Retained earnings', 'equity'),
  ('4000', 'Sales', 'income'),
  ('4100', 'Other income', 'income'),
  ('5000', 'Cost of sales', 'expense'),
  ('6100', 'Salaries and wages', 'expense'),
  ('6200', 'Rent', 'expense'),
  ('6300', 'Utilities', 'expense'),
  ('6400', 'Bank charges', 'expense'),
  ('6900', 'Other expenses', 'expense')
on conflict (code) do nothing;

-- ── Business details printed on documents (the client edits these) ─────────────────────────
create table if not exists public.invoice_settings (
  tenant_id text primary key default public.current_tenant_id(),
  business_name text not null default '',
  address text not null default '',
  vat_number text not null default '',
  payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 365),
  bank_details text not null default '',
  footer_note text not null default '',
  updated_at timestamptz not null default now()
);

-- ── Mailbox the documents are sent from. Written by the mailbox edge function only; the password
-- lives in Supabase Vault (secret_id) and is never selectable by the browser.
create table if not exists public.tenant_mailboxes (
  tenant_id text primary key,
  host text not null,
  port integer not null check (port between 1 and 65535),
  security text not null check (security in ('ssl', 'starttls')),
  username text not null,
  from_name text not null default '',
  from_email text not null,
  secret_id uuid not null,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Numbering: one counter per tenant per document type. Touched only by issue_document().
create table if not exists public.document_counters (
  tenant_id text not null,
  doc_type text not null check (doc_type in ('invoice', 'quote')),
  last_number integer not null default 0,
  primary key (tenant_id, doc_type)
);

-- ── Documents ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default public.current_tenant_id(),
  doc_type text not null check (doc_type in ('invoice', 'quote')),
  number integer,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void', 'converted')),
  customer_name text not null check (length(trim(customer_name)) > 0),
  customer_email text not null default '',
  customer_address text not null default '',
  customer_vat text not null default '',
  issue_date date not null default current_date,
  due_date date not null default current_date,          -- invoices: payment due; quotes: valid until
  vat_enabled boolean not null default true,
  notes text not null default '',
  supplier_name text,                                    -- snapshot of the business details at issue
  supplier_address text,
  supplier_vat text,
  sub_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  sent_at timestamptz,
  last_sent_to text,
  converted_to uuid references public.documents (id),
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (tenant_id, doc_type, number),
  check ((status = 'draft') = (number is null)),
  check (paid_cents >= 0 and paid_cents <= total_cents),
  check (due_date >= issue_date)
);
create index if not exists documents_tenant_idx on public.documents (tenant_id, doc_type, created_at desc);

create table if not exists public.document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  tenant_id text not null default public.current_tenant_id(),
  position integer not null default 0,
  description text not null check (length(trim(description)) > 0),
  qty numeric(12, 3) not null check (qty > 0),
  unit_cents bigint not null check (unit_cents >= 0)
);
create index if not exists document_lines_doc_idx on public.document_lines (document_id, position);

create table if not exists public.document_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  document_id uuid not null references public.documents (id),
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null,
  reference text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists document_payments_doc_idx on public.document_payments (document_id);

-- Everything the app emails, so the daily cap and "did it send?" have one source of truth.
create table if not exists public.mail_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  document_id uuid references public.documents (id),
  kind text not null check (kind in ('invoice', 'quote', 'statement')),
  to_email text not null,
  status text not null check (status in ('sent', 'failed', 'simulated')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists mail_log_tenant_day_idx on public.mail_log (tenant_id, created_at desc);

-- ── Ledger ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  entry_date date not null,
  memo text not null,
  source_type text not null check (source_type in ('invoice', 'payment', 'reversal')),
  source_id uuid,
  reverses uuid references public.journal_entries (id),
  created_at timestamptz not null default now()
);
create index if not exists journal_entries_tenant_idx on public.journal_entries (tenant_id, entry_date);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id),
  tenant_id text not null,
  account_code text not null references public.chart_accounts (code),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  check ((debit_cents > 0) <> (credit_cents > 0))        -- exactly one side per line
);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);

-- Debits must equal credits, checked when the transaction commits (so lines can go in one by one).
create or replace function public.assert_entry_balanced() returns trigger
language plpgsql set search_path = public as
$$
declare eid uuid := coalesce(new.entry_id, old.entry_id); d bigint; c bigint; n integer;
begin
  select coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0), count(*) into d, c, n
    from journal_lines where entry_id = eid;
  if n > 0 and (d <> c or n < 2) then
    raise exception 'Journal entry % is not balanced (debits %, credits %, % lines)', eid, d, c, n using errcode = '23514';
  end if;
  return null;
end $$;
drop trigger if exists journal_lines_balanced on public.journal_lines;
create constraint trigger journal_lines_balanced after insert or update or delete on public.journal_lines
  deferrable initially deferred for each row execute function public.assert_entry_balanced();

-- An entry with no lines is not an entry.
create or replace function public.assert_entry_has_lines() returns trigger
language plpgsql set search_path = public as
$$
begin
  if not exists (select 1 from journal_lines where entry_id = new.id) then
    raise exception 'Journal entry % has no lines', new.id using errcode = '23514';
  end if;
  return null;
end $$;
drop trigger if exists journal_entries_have_lines on public.journal_entries;
create constraint trigger journal_entries_have_lines after insert on public.journal_entries
  deferrable initially deferred for each row execute function public.assert_entry_has_lines();

-- Posted entries are never edited or deleted; mistakes get a reversing entry. The only exception is
-- purge_tenant_ledger() when an account is deleted, which sets app.purging for its own transaction.
create or replace function public.block_journal_change() returns trigger
language plpgsql set search_path = public as
$$
begin
  if tg_op = 'DELETE' and current_setting('app.purging', true) = 'on' then return old; end if;
  raise exception 'Posted journal entries cannot be changed — post a reversing entry instead' using errcode = '42501';
end $$;
drop trigger if exists journal_entries_immutable on public.journal_entries;
create trigger journal_entries_immutable before update or delete on public.journal_entries
  for each row execute function public.block_journal_change();
drop trigger if exists journal_lines_immutable on public.journal_lines;
create trigger journal_lines_immutable before update or delete on public.journal_lines
  for each row execute function public.block_journal_change();

-- ── Row-level security ────────────────────────────────────────────────────────────────────
alter table public.chart_accounts enable row level security;
alter table public.invoice_settings enable row level security;
alter table public.tenant_mailboxes enable row level security;
alter table public.document_counters enable row level security;
alter table public.documents enable row level security;
alter table public.document_lines enable row level security;
alter table public.document_payments enable row level security;
alter table public.mail_log enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists "chart_accounts: read" on public.chart_accounts;
create policy "chart_accounts: read" on public.chart_accounts for select to authenticated using (true);

drop policy if exists "invoice_settings: read own" on public.invoice_settings;
drop policy if exists "invoice_settings: insert own" on public.invoice_settings;
drop policy if exists "invoice_settings: update own" on public.invoice_settings;
create policy "invoice_settings: read own" on public.invoice_settings for select to authenticated using (tenant_id = public.current_tenant_id());
create policy "invoice_settings: insert own" on public.invoice_settings for insert to authenticated with check (tenant_id = public.current_tenant_id());
create policy "invoice_settings: update own" on public.invoice_settings for update to authenticated
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant_mailboxes: read own" on public.tenant_mailboxes;
create policy "tenant_mailboxes: read own" on public.tenant_mailboxes for select to authenticated using (tenant_id = public.current_tenant_id());

-- Documents: read own; the browser may only create, edit and delete DRAFTS.
drop policy if exists "documents: read own" on public.documents;
drop policy if exists "documents: insert draft" on public.documents;
drop policy if exists "documents: update draft" on public.documents;
drop policy if exists "documents: delete draft" on public.documents;
create policy "documents: read own" on public.documents for select to authenticated using (tenant_id = public.current_tenant_id());
create policy "documents: insert draft" on public.documents for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and status = 'draft' and number is null and paid_cents = 0 and sent_at is null);
create policy "documents: update draft" on public.documents for update to authenticated
  using (tenant_id = public.current_tenant_id() and status = 'draft')
  with check (tenant_id = public.current_tenant_id() and status = 'draft' and number is null and paid_cents = 0 and sent_at is null);
create policy "documents: delete draft" on public.documents for delete to authenticated
  using (tenant_id = public.current_tenant_id() and status = 'draft');

-- Lines follow their document: editable only while it is a draft of the caller's own.
drop policy if exists "document_lines: read own" on public.document_lines;
drop policy if exists "document_lines: write draft" on public.document_lines;
create policy "document_lines: read own" on public.document_lines for select to authenticated using (tenant_id = public.current_tenant_id());
create policy "document_lines: write draft" on public.document_lines for all to authenticated
  using (tenant_id = public.current_tenant_id() and exists (
    select 1 from public.documents d where d.id = document_id and d.tenant_id = public.current_tenant_id() and d.status = 'draft'))
  with check (tenant_id = public.current_tenant_id() and exists (
    select 1 from public.documents d where d.id = document_id and d.tenant_id = public.current_tenant_id() and d.status = 'draft'));

-- Read-only to the browser; written by the functions below or the edge functions (service role).
drop policy if exists "document_payments: read own" on public.document_payments;
create policy "document_payments: read own" on public.document_payments for select to authenticated using (tenant_id = public.current_tenant_id());
drop policy if exists "mail_log: read own" on public.mail_log;
create policy "mail_log: read own" on public.mail_log for select to authenticated using (tenant_id = public.current_tenant_id());
drop policy if exists "journal_entries: read own" on public.journal_entries;
create policy "journal_entries: read own" on public.journal_entries for select to authenticated using (tenant_id = public.current_tenant_id());
drop policy if exists "journal_lines: read own" on public.journal_lines;
create policy "journal_lines: read own" on public.journal_lines for select to authenticated using (tenant_id = public.current_tenant_id());
-- document_counters: RLS on and no policies, so only the functions below touch it.

-- Table privileges: signed-out visitors get nothing; signed-in users get exactly what the policies allow.
revoke all on public.chart_accounts, public.invoice_settings, public.tenant_mailboxes, public.document_counters,
  public.documents, public.document_lines, public.document_payments, public.mail_log,
  public.journal_entries, public.journal_lines from anon;
revoke all on public.document_counters, public.document_payments, public.mail_log, public.tenant_mailboxes,
  public.journal_entries, public.journal_lines, public.chart_accounts from authenticated;
grant select on public.chart_accounts, public.tenant_mailboxes, public.document_payments, public.mail_log,
  public.journal_entries, public.journal_lines to authenticated;
grant select, insert, update on public.invoice_settings to authenticated;
grant select, insert, update, delete on public.documents, public.document_lines to authenticated;

-- ── Posting (internal: callable only by the functions below) ──────────────────────────────
create or replace function public.post_journal(
  p_tenant text, p_date date, p_memo text, p_source_type text, p_source_id uuid, p_reverses uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as
$$
declare eid uuid; l jsonb;
begin
  insert into journal_entries (tenant_id, entry_date, memo, source_type, source_id, reverses)
    values (p_tenant, p_date, p_memo, p_source_type, p_source_id, p_reverses) returning id into eid;
  for l in select * from jsonb_array_elements(p_lines) loop
    insert into journal_lines (entry_id, tenant_id, account_code, debit_cents, credit_cents)
      values (eid, p_tenant, l->>'account', (l->>'debit')::bigint, (l->>'credit')::bigint);
  end loop;
  return eid;
end $$;
revoke all on function public.post_journal(text, date, text, text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.document_label(p_type text, p_number integer) returns text
language sql immutable set search_path = public as
$$ select case p_type when 'quote' then 'QUO-' else 'INV-' end || lpad(p_number::text, 4, '0') $$;

-- ── The functions the app calls ───────────────────────────────────────────────────────────
-- Issue a draft: number it, recompute totals from its lines (the browser's totals are not trusted),
-- freeze the supplier details, and for an invoice post  Dr Debtors / Cr Sales + VAT output.
create or replace function public.issue_document(p_id uuid) returns public.documents
language plpgsql security definer set search_path = public as
$$
declare
  tid text := public.current_tenant_id();
  d public.documents; s public.invoice_settings;
  n integer; sub bigint; vat bigint; je_lines jsonb;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into d from documents where id = p_id and tenant_id = tid for update;
  if not found then raise exception 'Document not found'; end if;
  if d.status <> 'draft' then raise exception 'Only a draft can be issued'; end if;

  select coalesce(sum(round(qty * unit_cents)), 0)::bigint into sub from document_lines where document_id = p_id;
  if not exists (select 1 from document_lines where document_id = p_id) then raise exception 'Add at least one line item'; end if;
  vat := case when d.vat_enabled then round(sub::numeric * 15 / 100)::bigint else 0 end;

  select * into s from invoice_settings where tenant_id = tid;
  if not found or length(trim(s.business_name)) = 0 then raise exception 'Add your business name under Connections before issuing documents'; end if;
  if d.vat_enabled and length(trim(s.vat_number)) = 0 then raise exception 'Add your VAT number under Connections, or switch VAT off for this document'; end if;

  insert into document_counters (tenant_id, doc_type, last_number) values (tid, d.doc_type, 1)
    on conflict (tenant_id, doc_type) do update set last_number = document_counters.last_number + 1
    returning last_number into n;

  update documents set number = n, status = 'issued', issued_at = now(),
    sub_cents = sub, vat_cents = vat, total_cents = sub + vat, paid_cents = 0,
    supplier_name = s.business_name, supplier_address = s.address,
    supplier_vat = case when d.vat_enabled then s.vat_number else '' end
    where id = p_id returning * into d;

  if d.doc_type = 'invoice' then
    je_lines := jsonb_build_array(jsonb_build_object('account', '1100', 'debit', d.total_cents, 'credit', 0));
    if d.sub_cents > 0 then je_lines := je_lines || jsonb_build_object('account', '4000', 'debit', 0, 'credit', d.sub_cents); end if;
    if d.vat_cents > 0 then je_lines := je_lines || jsonb_build_object('account', '2200', 'debit', 0, 'credit', d.vat_cents); end if;
    perform post_journal(tid, d.issue_date, 'Invoice ' || document_label(d.doc_type, n) || ' — ' || d.customer_name, 'invoice', d.id, null, je_lines);
  end if;
  return d;
end $$;

-- Turn an issued quote into a draft invoice (copying its lines); the quote is marked converted.
create or replace function public.convert_quote(p_id uuid) returns public.documents
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); q public.documents; inv public.documents; terms integer;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into q from documents where id = p_id and tenant_id = tid and doc_type = 'quote' for update;
  if not found then raise exception 'Quote not found'; end if;
  if q.status <> 'issued' then raise exception 'Only an issued quote can be converted'; end if;
  select coalesce((select payment_terms_days from invoice_settings where tenant_id = tid), 14) into terms;
  insert into documents (tenant_id, doc_type, customer_name, customer_email, customer_address, customer_vat,
                         issue_date, due_date, vat_enabled, notes, sub_cents, vat_cents, total_cents)
    values (tid, 'invoice', q.customer_name, q.customer_email, q.customer_address, q.customer_vat,
            current_date, current_date + terms, q.vat_enabled, q.notes, q.sub_cents, q.vat_cents, q.total_cents)
    returning * into inv;
  insert into document_lines (document_id, tenant_id, position, description, qty, unit_cents)
    select inv.id, tid, position, description, qty, unit_cents from document_lines where document_id = q.id;
  update documents set status = 'converted', converted_to = inv.id where id = q.id;
  return inv;
end $$;

-- Void an issued, unpaid document. An invoice gets a reversing journal entry; nothing is deleted.
create or replace function public.void_document(p_id uuid) returns public.documents
language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); d public.documents; orig public.journal_entries; rev_lines jsonb;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into d from documents where id = p_id and tenant_id = tid for update;
  if not found then raise exception 'Document not found'; end if;
  if d.status <> 'issued' then raise exception 'Only an issued document can be voided'; end if;
  if d.paid_cents > 0 then raise exception 'This invoice has payments recorded and cannot be voided'; end if;
  update documents set status = 'void' where id = p_id returning * into d;
  if d.doc_type = 'invoice' then
    select * into orig from journal_entries where tenant_id = tid and source_type = 'invoice' and source_id = p_id;
    select jsonb_agg(jsonb_build_object('account', account_code, 'debit', credit_cents, 'credit', debit_cents))
      into rev_lines from journal_lines where entry_id = orig.id;
    perform post_journal(tid, current_date, 'Reversal of ' || orig.memo, 'reversal', p_id, orig.id, rev_lines);
  end if;
  return d;
end $$;

-- Record money received against an issued invoice:  Dr Bank / Cr Debtors.  Part payments are fine.
create or replace function public.record_payment(p_id uuid, p_amount_cents bigint, p_paid_on date, p_reference text default '')
returns public.documents language plpgsql security definer set search_path = public as
$$
declare tid text := public.current_tenant_id(); d public.documents; pid uuid;
begin
  if tid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into d from documents where id = p_id and tenant_id = tid and doc_type = 'invoice' for update;
  if not found then raise exception 'Invoice not found'; end if;
  if d.status <> 'issued' then raise exception 'Payments can only be recorded against an issued, unpaid invoice'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'The payment must be more than zero'; end if;
  if p_amount_cents > d.total_cents - d.paid_cents then raise exception 'The payment is more than the amount outstanding'; end if;
  insert into document_payments (tenant_id, document_id, amount_cents, paid_on, reference)
    values (tid, p_id, p_amount_cents, p_paid_on, coalesce(p_reference, '')) returning id into pid;
  perform post_journal(tid, p_paid_on, 'Payment for ' || document_label(d.doc_type, d.number) || ' — ' || d.customer_name, 'payment', pid, null,
    jsonb_build_array(jsonb_build_object('account', '1000', 'debit', p_amount_cents, 'credit', 0),
                      jsonb_build_object('account', '1100', 'debit', 0, 'credit', p_amount_cents)));
  update documents set paid_cents = paid_cents + p_amount_cents,
    status = case when paid_cents + p_amount_cents = total_cents then 'paid' else 'issued' end
    where id = p_id returning * into d;
  return d;
end $$;

revoke all on function public.issue_document(uuid), public.convert_quote(uuid), public.void_document(uuid),
  public.record_payment(uuid, bigint, date, text) from public, anon;
grant execute on function public.issue_document(uuid), public.convert_quote(uuid), public.void_document(uuid),
  public.record_payment(uuid, bigint, date, text) to authenticated;
