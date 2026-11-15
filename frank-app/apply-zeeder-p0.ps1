$ErrorActionPreference = "Stop"
if (-not (Test-Path "frank-app")) { Write-Error "Run from the repo root (frank-app/ not found)."; exit 1 }
git rev-parse --is-inside-work-tree | Out-Null
git fetch origin | Out-Null
git checkout master 2>$null; git pull origin master 2>$null
git checkout -b fix/p0-security-persistence 2>$null
if ($LASTEXITCODE -ne 0) { git checkout fix/p0-security-persistence }

function Write-File($path, $content) {
  $dir = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, (New-Object System.Text.UTF8Encoding $false))
}
function Commit($msg) { git add -A | Out-Null; git commit -m $msg | Out-Null; Write-Host "committed: $msg" }

# ── COMMIT 1 · UI logo fix (Sidebar.jsx, final incl. subscription-aware footer) ──
Write-File "frank-app/src/components/Sidebar.jsx" @'
import { useState } from 'react'
import { C, FONT_BODY, FONT_SUB } from '../lib/theme'
import { useTenant, AdminSwitcher } from '../context/TenantContext'
import { supabase } from '../lib/supabaseClient'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',       icon: '▦' },
  { id: 'cashflow',   label: 'Cash Flow',        icon: '◱', badgeKey: 'highFlags',   badgeColor: C.danger },
  { id: 'reports',    label: 'Reports',          icon: '▤' },
  { id: 'health',     label: 'Business Health',  icon: '◈', badgeKey: 'hScore',      badgeColor: null },
  { id: 'documents',  label: 'Documents',        icon: '↑' },
  { id: 'ar',         label: 'Debtors',          icon: '⊟' },
  { id: 'ap',         label: 'Creditors',        icon: '⊞' },
  { id: 'reconcile',  label: 'Reconciliation',   icon: '⇌', badgeKey: 'unmatched',   badgeColor: C.warn },
  { id: 'connect',    label: 'Connections',      icon: '⊕' },
  { id: 'chat',       label: 'Ask Zeeder',       icon: '◉' },
]

export function Sidebar({ view, onNav, onAsk }) {
  const { tenant, data, tenants, bankData, currentUser, logout, deleteAccount, canDeleteAccount, subscription, cancelSubscription } = useTenant()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const hScore    = Math.round(data.HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / data.HEALTH_CHECKS.length)
  const highFlags = data.CASHFLOW_FLAGS.filter(f => f.severity === 'HIGH').length
  const hColor    = hScore > 75 ? C.frank : hScore > 55 ? C.warn : C.danger
  const unmatched = bankData && !bankData.isConfirmed
    ? (bankData.credits.filter(t => !t.matchedName && !t.confirmed).length + bankData.debits.filter(t => !t.matchedName && !t.confirmed).length)
    : null
  const badges = { highFlags, hScore, unmatched }
  const badgeColors = { highFlags: C.danger, hScore: hColor, unmatched: C.warn }

  return (
    <>
      <aside style={{ width: 250, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh' }}>
        {/* Logo — gap closed, Finance OS sits directly under the wordmark */}
        <div style={{ padding: '12px 16px 4px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
          <img src="/zeeder-logo.png" alt="Zeeder AI" style={{ width: '80%', display: 'block', margin: '0 auto', marginBottom: -48 }} />
          <div style={{ fontFamily: FONT_SUB, fontSize: 10, color: C.gold, letterSpacing: 4, textTransform: 'uppercase', lineHeight: 1, paddingBottom: 0 }}>Finance OS</div>
        </div>

        {/* Business card */}
        <div style={{ padding: '10px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: 0.3 }}>{tenant.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2, letterSpacing: 0.5 }}>{tenant.sector}</div>
          {tenant.children != null
            ? <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{tenant.children} learners · {tenant.staff} staff</div>
            : <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{tenant.staff} staff · {tenant.location}</div>}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="blink" style={{ width: 6, height: 6, borderRadius: '50%', background: bankData ? C.frank : C.dim, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: bankData ? C.frank : C.dim, letterSpacing: 0.5 }}>{bankData ? 'Bank statement loaded' : 'No bank data yet'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.warn, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.warn, letterSpacing: 0.5 }}>No accounting software</span>
            </div>
          </div>
        </div>

        {/* Nav — tucked up */}
        <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(n => {
            const active = view === n.id
            const badgeVal = n.badgeKey ? badges[n.badgeKey] : null
            const badgeCol = n.badgeKey ? badgeColors[n.badgeKey] : null
            return (
              <button key={n.id} onClick={() => onNav(n.id)} className="nav-item"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 4, border: 'none',
                  borderLeft: active ? `2px solid ${C.frank}` : '2px solid transparent', cursor: 'pointer', background: active ? C.frankMid : 'transparent',
                  color: active ? C.frank : C.sub, fontSize: 16, fontWeight: active ? 600 : 400, marginBottom: 2, textAlign: 'left', letterSpacing: active ? 0.3 : 0 }}>
                <span style={{ fontSize: 16, opacity: active ? 1 : 0.6, flexShrink: 0 }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {badgeVal != null && (
                  <span style={{ fontSize: 12, background: `${badgeCol}18`, color: badgeCol, borderRadius: 3, padding: '1px 6px', fontWeight: 700, border: `1px solid ${badgeCol}30`, letterSpacing: 0.5 }}>{badgeVal}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Plan footer — reflects real subscription */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div>
                <div style={{ fontSize: 11, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button onClick={logout} title="Sign out" style={{ padding: '4px 9px', borderRadius: 3, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, fontSize: 11, cursor: 'pointer', letterSpacing: 0.5 }}>Sign out</button>
                {canDeleteAccount && (
                  <button onClick={() => { if (window.confirm('Delete your account and all data? This cannot be undone.')) deleteAccount() }} title="Delete account"
                    style={{ padding: '4px 7px', borderRadius: 3, border: `1px solid ${C.danger}30`, background: 'transparent', color: C.danger, fontSize: 11, cursor: 'pointer' }}>×</button>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: C.dim, letterSpacing: 1, textTransform: 'uppercase' }}>
              {subscription ? `${subscription.plan} Plan · R ${(subscription.amount_cents / 100).toLocaleString('en-ZA')}/mo` : `Trial — ${currentUser?.trialDaysLeft ?? 0} days left`}
            </div>
            {tenants.length > 1 && (
              <button onClick={() => setShowSwitcher(true)} title="Admin: switch tenant" style={{ padding: '3px 7px', borderRadius: 3, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>⚙</button>
            )}
          </div>
          {subscription ? (
            <button onClick={async () => { if (window.confirm('Cancel your subscription? You keep access until the end of the paid period.')) { const r = await cancelSubscription(); if (!r.ok) onAsk(`Cancellation failed: ${r.error}`) } }}
              style={{ width: '100%', padding: '8px', borderRadius: 4, border: `1px solid ${C.danger}30`, background: 'transparent', color: C.danger, fontSize: 12, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Cancel subscription</button>
          ) : (
            <button onClick={async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session) throw new Error('Not signed in — please log in again.')
                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paygate-initiate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ plan: tenant.plan === 'Starter' ? 'starter' : 'growth', first_name: currentUser?.name?.split(' ')[0], last_name: currentUser?.name?.split(' ').slice(1).join(' ') }),
                  })
                  const data = await res.json()
                  if (data.redirect_url) window.location.href = data.redirect_url
                  else onAsk(`Upgrade failed: ${data.error ?? 'unknown error'}. What should I check?`)
                } catch (e) { onAsk(`Upgrade failed to start: ${e.message}. What should I check?`) }
              }}
              style={{ width: '100%', padding: '8px', borderRadius: 4, border: `1px solid ${C.frank}30`, background: C.frankDim, color: C.frank, fontSize: 12, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Upgrade →</button>
          )}
        </div>
      </aside>
      {showSwitcher && <AdminSwitcher onClose={() => setShowSwitcher(false)} />}
    </>
  )
}
'@
Commit "fix(ui): close Zeeder logo gap, tuck nav up, subscription-aware plan footer"

# ── COMMIT 2 · P0-1 Wonderland proxy tenant authorization ──
Write-File "frank-app/supabase/functions/wonderland-proxy/index.ts" @'
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const WONDERLAND_API_KEY = (Deno.env.get("WONDERLAND_API_KEY") ?? "").trim()
const BASE = "https://wonderland-management.replit.app"
const ENDPOINTS: Record<string, string> = {
  summary: "/api/external/v1/summary",
  outstanding: "/api/external/v1/outstanding",
  children: "/api/external/v1/children",
  payments: "/api/external/v1/payments",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  // P0-1: Wonderland data is ONLY for Wonderland.
  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", userData.user.id).single()
  if (profile?.tenant_id !== "wonderland-educare") return json({ error: "Forbidden" }, 403)

  try {
    const { endpoint, params } = await req.json()
    const path = ENDPOINTS[endpoint]
    if (!path) return json({ error: `Unknown endpoint: ${endpoint}` }, 400)
    const target = new URL(BASE + path)
    for (const [k, v] of Object.entries(params ?? {})) { if (v != null) target.searchParams.set(k, String(v)) }
    const res = await fetch(target, { headers: { Authorization: `Bearer ${WONDERLAND_API_KEY}` } })
    const data = await res.json()
    if (!res.ok) return json({ error: `Wonderland API ${res.status}` }, res.status)
    return json(data)
  } catch (err) { console.error(err); return json({ error: String(err) }, 500) }
})
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } }) }
'@
Commit "fix(security): P0-1 authorize Wonderland proxy per tenant (cross-tenant data exposure)"

# ── COMMIT 3 · DB migration (P0-2/3/4/5 + SimplePay schema) ──
Write-File "frank-app/supabase/migrations/20261114a_p0_security_persistence.sql" @'
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
'@
Commit "fix(db): P0-2/3/4/5 profiles guard, persistence tables, signup trigger, billing RLS + SimplePay secrets"

# ── COMMIT 4 · P0-4 billing edge functions ──
Write-File "frank-app/supabase/functions/_shared/entitlement.ts" @'
import { createClient } from "npm:@supabase/supabase-js@2"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const TRIAL_DAYS = 14, TRIAL_DAILY_CAP = 50
export async function checkEntitlement(userId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: p } = await admin.from("profiles").select("tenant_id, created_at").eq("id", userId).single()
  if (!p) return { ok: false, reason: "No profile found." }
  if (p.tenant_id === "wonderland-educare" || p.tenant_id === "cape-fresh-grocery") return { ok: true, plan: "partner" }
  const { data: sub } = await admin.from("subscriptions").select("plan").eq("tenant_id", p.tenant_id).eq("status", "active").limit(1).maybeSingle()
  if (sub) return { ok: true, plan: sub.plan }
  const trialEnds = new Date(p.created_at).getTime() + TRIAL_DAYS * 86400000
  if (Date.now() >= trialEnds) return { ok: false, reason: "Your 14-day trial has ended. Upgrade to keep using Zeeder AI." }
  await admin.rpc("increment_ai_usage", { tid: p.tenant_id })
  const { data: row } = await admin.from("ai_usage").select("count").eq("tenant_id", p.tenant_id).eq("day", new Date().toISOString().slice(0, 10)).single()
  if ((row?.count ?? 0) > TRIAL_DAILY_CAP) return { ok: false, reason: "Daily trial AI limit reached. Upgrade for unlimited access." }
  return { ok: true, plan: "trial" }
}
'@
Write-File "frank-app/supabase/functions/paygate-cancel/index.ts" @'
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: u, error } = await admin.auth.getUser(token)
  if (error || !u?.user) return json({ error: "Invalid session" }, 401)
  const { data: p } = await admin.from("profiles").select("tenant_id").eq("id", u.user.id).single()
  if (!p) return json({ error: "No profile" }, 404)
  const { error: upErr } = await admin.from("subscriptions").update({ status: "cancelled", next_charge_at: null }).eq("tenant_id", p.tenant_id).eq("status", "active")
  if (upErr) return json({ error: upErr.message }, 500)
  return json({ cancelled: true })
})
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...corsHeaders } }) }
'@
# In-place patches to existing billing functions (anchored, idempotent):
function Patch-File($path, $old, $new) {
  $c = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $path))
  if ($c.Contains($new)) { return }
  if (-not $c.Contains($old)) { Write-Error "Anchor not found in $path"; exit 1 }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $c.Replace($old, $new), (New-Object System.Text.UTF8Encoding $false))
}
$gate = @'
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)
'@
$gateNew = @'
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  const { checkEntitlement } = await import("../_shared/entitlement.ts")
  const ent = await checkEntitlement(userData.user.id)
  if (!ent.ok) return json({ error: ent.reason }, 402)
'@
Patch-File "frank-app/supabase/functions/chat-message/index.ts" $gate $gateNew
Patch-File "frank-app/supabase/functions/chat-message/index.ts" 'const { system, messages } = await req.json()' "const { system, messages } = await req.json()`n    const msgs = Array.isArray(messages) ? messages.slice(-20) : messages"
Patch-File "frank-app/supabase/functions/chat-message/index.ts" '          system,
          messages,' "          system,
          messages: msgs,"
Patch-File "frank-app/supabase/functions/extract-document/index.ts" $gate $gateNew
Patch-File "frank-app/supabase/functions/paygate-initiate/index.ts" 'const PLANS: Record<string, number> = {
  growth: 99900, // R999.00 in cents
}' 'const PLANS: Record<string, number> = {
  starter: 49900, // R499.00 in cents
  growth: 99900, // R999.00 in cents
}'
Patch-File "frank-app/supabase/functions/paygate-initiate/index.ts" '    const tenant_id = profile.tenant_id' '    const { data: existing } = await supabase.from("subscriptions").select("id").eq("tenant_id", profile.tenant_id).eq("status", "active").maybeSingle()
    if (existing) return json({ error: "You already have an active subscription." }, 409)
    await supabase.from("subscriptions").update({ status: "cancelled" }).eq("tenant_id", profile.tenant_id).eq("status", "pending")

    const tenant_id = profile.tenant_id'
Patch-File "frank-app/supabase/functions/paygate-charge/index.ts" '  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })' '  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const cronToken = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  let cronRole = ""
  try { cronRole = JSON.parse(atob(cronToken.split(".")[1] ?? "")).role ?? "" } catch { /* ignore */ }
  if (cronRole !== "service_role") return json({ error: "Forbidden" }, 403)'
Patch-File "frank-app/supabase/functions/delete-account/index.ts" '  const userId = userData.user.id' '  const userId = userData.user.id

  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", userId).single()
  if (profile?.tenant_id) {
    const tid = profile.tenant_id
    await admin.from("subscriptions").update({ status: "cancelled", next_charge_at: null }).eq("tenant_id", tid).in("status", ["active", "pending"])
    await admin.from("tenant_data").delete().eq("tenant_id", tid)
    await admin.from("tenant_secrets").delete().eq("tenant_id", tid)
    await admin.from("tenants").delete().eq("id", tid)
  }'
Commit "fix(billing): P0-4 entitlement gate, double-charge guard, service-role cron, cancel-on-delete"

# ── COMMIT 5 · SimplePay server-side proxy (SA region, correct API) ──
Write-File "frank-app/supabase/functions/simplepay-proxy/index.ts" @'
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const BASE = "https://api.payroll.simplepay.cloud/v1"

// Official SA API: raw key in the Authorization header (NOT Basic/Bearer).
async function sp(path: string, key: string) {
  const res = await fetch(BASE + path, { headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json" } })
  if (!res.ok) throw new Error(`SimplePay ${res.status} — check API key`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: u, error } = await admin.auth.getUser(token)
  if (error || !u?.user) return json({ error: "Invalid session" }, 401)
  const { data: p } = await admin.from("profiles").select("tenant_id").eq("id", u.user.id).single()
  if (!p) return json({ error: "No profile" }, 404)
  const tid = p.tenant_id
  try {
    const { action, apiKey, clientId } = await req.json()
    if (action === "connect") {
      const key = String(apiKey ?? "").trim()
      if (!key) return json({ error: "Enter an API key" }, 400)
      const clients = await sp("/clients/", key)
      const list = Array.isArray(clients) ? clients : []
      const cid = clientId ?? list[0]?.client?.id ?? list[0]?.id
      if (!cid) return json({ error: "No company found for this API key" }, 400)
      await admin.from("tenant_secrets").upsert({ tenant_id: tid, simplepay_key: key, simplepay_client_id: String(cid), updated_at: new Date().toISOString() })
      await admin.from("tenant_data").upsert({ tenant_id: tid, simplepay_connected: true }, { onConflict: "tenant_id" })
      return json({ ok: true, clientId: cid, clients: list })
    }
    if (action === "disconnect") {
      await admin.from("tenant_secrets").delete().eq("tenant_id", tid)
      await admin.from("tenant_data").upsert({ tenant_id: tid, simplepay_connected: false }, { onConflict: "tenant_id" })
      return json({ ok: true })
    }
    const { data: sec } = await admin.from("tenant_secrets").select("simplepay_key, simplepay_client_id").eq("tenant_id", tid).maybeSingle()
    if (!sec?.simplepay_key) return json({ error: "SimplePay not connected" }, 404)
    const cid = sec.simplepay_client_id
    if (action === "clients") return json(await sp("/clients/", sec.simplepay_key))
    if (action === "employees") return json(await sp(`/clients/${cid}/employees`, sec.simplepay_key))
    if (action === "payment_runs") return json(await sp(`/clients/${cid}/payment_runs`, sec.simplepay_key))
    return json({ error: "Unknown action" }, 400)
  } catch (err) { return json({ error: String(err) }, 502) }
})
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...corsHeaders } }) }
'@
Commit "feat(simplepay): server-side payroll proxy — SA API, raw-key auth, per-tenant key in vault"

# ── COMMIT 6 · Frontend wiring (P0-1/3/5 + SimplePay) ──
Write-File "frank-app/src/lib/monthlyHistory.js" @'
export function buildMonthlyEntry(bankData) {
  const end = bankData.periodEnd ? new Date(bankData.periodEnd) : new Date()
  const rev = bankData.credits.reduce((s, t) => s + t.amount, 0)
  const exp = bankData.debits.reduce((s, t) => s + t.amount, 0)
  const net = Math.round(rev - exp)
  return { m: end.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }), y: end.getFullYear(),
    fees: Math.round(rev), subsidy: 0, rev: Math.round(rev), exp: Math.round(exp), net, cash: Math.round(bankData.closingBalance || 0),
    take: `From ${bankData.bankName || 'bank'} statement ${bankData.periodStart}–${bankData.periodEnd}: ${net >= 0 ? `R ${net.toLocaleString('en-ZA')} left over` : `R ${Math.abs(net).toLocaleString('en-ZA')} short`}.` }
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const monthNum = m => MONTHS.indexOf(String(m).slice(0, 3))
export function mergeMonthly(history, entry) {
  const rest = (history || []).filter(h => !(h.m === entry.m && (h.y ?? null) === (entry.y ?? null)))
  return [...rest, entry].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || monthNum(a.m) - monthNum(b.m))
}
'@
Write-File "frank-app/src/lib/simplePayApi.js" @'
import { supabase } from './supabaseClient'
const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simplepay-proxy`
async function call(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in — please log in again.')
  const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `SimplePay error ${res.status}`)
  return data
}
const safe = async (body) => { try { return await call(body) } catch { return null } }
export const simplePayApi = {
  connect: async (apiKey, clientId) => { try { const r = await call({ action: 'connect', apiKey, clientId }); return { ok: true, ...r } } catch (e) { return { ok: false, error: e.message } } },
  disconnect: () => call({ action: 'disconnect' }),
  clients: () => safe({ action: 'clients' }),
  employees: () => safe({ action: 'employees' }),
  payRuns: () => safe({ action: 'payment_runs' }),
}
'@
Write-File "frank-app/src/hooks/useSimplePayData.js" @'
import { useState, useEffect } from 'react'
import { simplePayApi } from '../lib/simplePayApi'
export function useSimplePayData(connected) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!connected) { setData(null); setError(null); setLoading(false); return }
    setLoading(true)
    Promise.all([simplePayApi.employees(), simplePayApi.payRuns()])
      .then(([employees, payRuns]) => { if (employees || payRuns) setData({ employees, payRuns }); else setError('SimplePay not connected — check API key') })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [connected])
  return { data, loading, error }
}
'@
# tenants.js: safe fallback
Patch-File "frank-app/src/data/tenants.js" 'return TENANTS.find(t => t.id === id) || TENANTS[0]' 'return TENANTS.find(t => t.id === id) || null'
Commit "fix(app): P0-1/3/5 monthly history, SimplePay proxy client + hook, safe tenant lookup"

# ── COMMIT 7 · TenantContext + App + Chat + Connections (final wiring) ──
# NOTE: TenantContext.jsx, App.jsx, Chat.jsx, Connections.jsx are large full-file
# replacements. They are emitted in Part 2 of this script (next message) to keep
# each block reviewable. Run Part 2 before pushing.
Write-Host "Part 1 staged (commits 1-6). Run Part 2 to write TenantContext/App/Chat/Connections, then push."