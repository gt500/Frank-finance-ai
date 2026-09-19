create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  tenant_id text not null,
  role text not null default 'owner', -- room for 'staff' etc later
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- A user can read and update only their own profile row.
create policy "profiles: read own" on profiles
  for select using (id = auth.uid());

create policy "profiles: update own" on profiles
  for update using (id = auth.uid());

-- New signups need to be able to create their own profile row once.
create policy "profiles: insert own" on profiles
  for insert with check (id = auth.uid());

-- Now that we have a real user -> tenant mapping, replace the earlier
-- "service role only" comment-placeholders with actual tenant-scoped RLS
-- on the billing tables.

create policy "subscriptions: read own tenant" on subscriptions
  for select using (
    tenant_id in (select p.tenant_id from profiles p where p.id = auth.uid())
  );

create policy "billing_notifications: read own tenant" on billing_notifications
  for select using (
    tenant_id in (select p.tenant_id from profiles p where p.id = auth.uid())
  );

-- Writes to both tables still go through edge functions using the service
-- role key, which bypasses RLS by design — these policies only govern what
-- the frontend can read directly with a user's own session.

create index if not exists profiles_tenant_idx on profiles (tenant_id);
