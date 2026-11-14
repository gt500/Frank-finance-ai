-- One open checkout per tenant. Two concurrent Upgrade clicks used to create two payable
-- PayGate pages; the second insert now fails and paygate-initiate never hands out its page.
-- Older attempts are marked 'superseded' (still settleable by paygate-notify), not 'pending'.
update public.subscriptions s set status = 'superseded'
where status = 'pending'
  and exists (select 1 from public.subscriptions n
              where n.tenant_id = s.tenant_id and n.status = 'pending' and (n.created_at, n.id) > (s.created_at, s.id));

create unique index if not exists one_pending_sub_per_tenant
  on public.subscriptions (tenant_id) where status = 'pending';
