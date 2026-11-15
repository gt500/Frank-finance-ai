-- Mailbox password handling and account cleanup for the invoicing tables.
-- Every function here is for the edge functions (service_role) only: the browser can never call them,
-- so it can never read a mailbox password or purge a ledger.

-- Store (or replace) the SMTP password in Vault. One secret per tenant, found by name so a half-finished
-- earlier attempt can never leave an unreachable duplicate behind.
create or replace function public.store_mailbox_secret(p_tenant text, p_password text) returns uuid
language plpgsql security definer set search_path = public, vault as
$$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = 'mailbox:' || p_tenant;
  if sid is not null then
    perform vault.update_secret(sid, p_password);
    return sid;
  end if;
  return vault.create_secret(p_password, 'mailbox:' || p_tenant, 'SMTP password for ' || p_tenant);
end $$;

create or replace function public.read_mailbox_secret(p_tenant text) returns text
language sql security definer set search_path = public, vault as
$$ select decrypted_secret from vault.decrypted_secrets where name = 'mailbox:' || p_tenant $$;

-- Disconnect: the secret goes with the settings.
create or replace function public.delete_mailbox(p_tenant text) returns void
language plpgsql security definer set search_path = public, vault as
$$
begin
  delete from vault.secrets where name = 'mailbox:' || p_tenant;
  delete from tenant_mailboxes where tenant_id = p_tenant;
end $$;

-- Account deletion: the only way posted journal entries are ever removed (everything for one tenant, together).
create or replace function public.purge_tenant_ledger(p_tenant text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform set_config('app.purging', 'on', true);
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

revoke all on function public.store_mailbox_secret(text, text), public.read_mailbox_secret(text),
  public.delete_mailbox(text), public.purge_tenant_ledger(text) from public, anon, authenticated;
grant execute on function public.store_mailbox_secret(text, text), public.read_mailbox_secret(text),
  public.delete_mailbox(text), public.purge_tenant_ledger(text) to service_role;
