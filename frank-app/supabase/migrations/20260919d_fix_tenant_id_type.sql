-- The original migration typed tenant_id as uuid, but this app's tenant IDs
-- are plain strings (e.g. 'wonderland-educare', 'tenant-1758...') — there is
-- no tenants table with UUID primary keys yet. Fix before this ever runs
-- against real data.
alter table subscriptions alter column tenant_id type text;
alter table billing_notifications alter column tenant_id type text;
