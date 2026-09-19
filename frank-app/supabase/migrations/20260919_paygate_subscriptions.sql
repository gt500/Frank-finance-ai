create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  plan text not null,
  amount_cents integer not null,
  currency text not null default 'ZAR',
  status text not null default 'pending', -- pending | active | failed | cancelled
  pay_request_id text unique,
  merchant_order_id text,
  vault_id text,
  result_code text,
  first_name text,
  last_name text,
  email text,
  activated_at timestamptz,
  last_charged_at timestamptz,
  next_charge_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_tenant_idx on subscriptions (tenant_id);
create index if not exists subscriptions_pay_request_idx on subscriptions (pay_request_id);

create table if not exists subscription_charges (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id),
  merchant_order_id text,
  amount_cents integer not null,
  status text not null, -- success | failed
  result_code text,
  result_desc text,
  created_at timestamptz not null default now()
);

alter table subscriptions enable row level security;
alter table subscription_charges enable row level security;
-- Edge functions use the service role key and bypass RLS.
-- Add tenant-scoped SELECT policies here matching your existing tenant model.
