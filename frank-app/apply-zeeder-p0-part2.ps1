$ErrorActionPreference = "Stop"
if (-not (Test-Path "frank-app")) { Write-Error "Run from the repo root."; exit 1 }
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "fix/p0-security-persistence") { Write-Error "Wrong branch ($branch). Run Part 1 first."; exit 1 }

function Write-File($path, $content) {
  $dir = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, (New-Object System.Text.UTF8Encoding $false))
}
function Patch-File($path, $old, $new) {
  $c = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $path))
  if ($c.Contains($new)) { return }
  if (-not $c.Contains($old)) { Write-Error "Anchor not found in $path"; exit 1 }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $c.Replace($old, $new), (New-Object System.Text.UTF8Encoding $false))
}
function Commit($msg) { git add -A | Out-Null; git commit -m $msg | Out-Null; Write-Host "committed: $msg" }

# ── COMMIT 7 · Final wiring: TenantContext + App + Chat + Connections + demo flag ──

# Cape Fresh = demo: mutations are session-only, always pristine for the next client.
Patch-File "frank-app/src/data/tenants.js" "id:         'cape-fresh-grocery'," "id:         'cape-fresh-grocery',
    demo:       true,"

Write-File "frank-app/src/context/TenantContext.jsx" @'
import { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { TENANTS } from '../data/tenants'
import { C } from '../lib/theme'
import { supabase } from '../lib/supabaseClient'
import { simplePayApi } from '../lib/simplePayApi'
import { buildMonthlyEntry, mergeMonthly } from '../lib/monthlyHistory'

const TenantContext = createContext(null)
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN
const LEGACY_KEYS = ['zeeder_accounts','zeeder_user','zeeder_custom_tenants','zeeder_imported_data','zeeder_simplepay_keys','zeeder_tenant']

function extractEntityName(description) {
  if (!description) return 'Unknown'
  const cleaned = description
    .replace(/^(PAYMENT FROM|PAYMENT TO|TRF FROM|TRF TO|INTERNET TRF|CDT TRF|DBT ORDER|DEBIT ORDER|POS PURCHASE|ATM WITHDRAWAL|DIRECT DEP|ACH CREDIT|SALARY|WAGES)\s*/i, '')
    .replace(/\s+\d{6,}.*$/, '').replace(/\s+/g, ' ').trim()
  return cleaned.split(' ').slice(0, 3).join(' ') || description.substring(0, 25)
}
function findMatch(description, knownNames) {
  const desc = (description || '').toLowerCase()
  return knownNames.find(n => { const w = (n || '').toLowerCase().split(' ')[0]; return w.length > 2 && desc.includes(w) }) || null
}

export function TenantProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tenant, setTenant] = useState(null)          // null = loading/unknown — NEVER another tenant
  const [tenantError, setTenantError] = useState(null)
  const [bankData, setBankData] = useState(null)
  const [imported, setImported] = useState({})
  const [monthly, setMonthly] = useState(null)
  const [simplePayConnected, setSimplePayConnected] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState({ count: 0, lockedUntil: 0 })
  const tid = currentUser?.tenantId

  // Cloud persistence (P0-3). Demo tenant = in-memory only.
  const persist = useCallback((patch) => {
    if (!tid || tenant?.demo) return
    supabase.from('tenant_data')
      .upsert({ tenant_id: tid, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
      .then(({ error }) => { if (error) console.error('Save failed:', error.message) })
  }, [tid, tenant])

  async function loadWorkspace(profile) {
    setTenantError(null)
    // Static demo definitions live in code; custom tenants live in the DB. No fallback to TENANTS[0].
    let t = TENANTS.find(x => x.id === profile.tenant_id) || null
    if (!t) {
      const { data } = await supabase.from('tenants').select('profile').eq('id', profile.tenant_id).maybeSingle()
      t = data?.profile || null
    }
    if (!t) { setTenant(null); setTenantError('Workspace not found for this account. Contact support.'); return }
    setTenant(t)
    const { data: td } = await supabase.from('tenant_data').select('*').eq('tenant_id', profile.tenant_id).maybeSingle()
    const stored = t.demo ? null : td
    setBankData(stored?.bank_data || null)
    setImported(stored?.imported || {})
    setMonthly(stored?.monthly || null)
    setSimplePayConnected(!!stored?.simplepay_connected)
    const { data: sub } = await supabase.from('subscriptions').select('status, plan, amount_cents')
      .eq('tenant_id', profile.tenant_id).eq('status', 'active').limit(1).maybeSingle()
    setSubscription(sub || null)
  }

  async function loadProfileForSession(session) {
    if (!session?.user) { setCurrentUser(null); setTenant(null); return }
    const { data: profile, error } = await supabase.from('profiles')
      .select('email, name, tenant_id, created_at').eq('id', session.user.id).single()
    if (error || !profile) { setCurrentUser(null); setTenantError('No profile for this account.'); return }
    // One-time purge of legacy browser storage (old cross-tenant leak vector).
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
    Object.keys(localStorage).filter(k => k.startsWith('zeeder_bank_')).forEach(k => localStorage.removeItem(k))
    const trialDaysLeft = Math.max(0, 14 - Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000))
    setCurrentUser({ email: profile.email, name: profile.name, tenantId: profile.tenant_id, trialDaysLeft })
    await loadWorkspace(profile)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { loadProfileForSession(session).finally(() => setAuthLoading(false)) })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => { loadProfileForSession(session) })
    return () => listener.subscription.unsubscribe()
  }, [])

  const mergedData = useMemo(() => {
    if (!tenant) return null
    return { ...tenant.data,
      MONTHLY: monthly ?? tenant.data.MONTHLY,
      DEBTORS: imported.DEBTORS ?? tenant.data.DEBTORS,
      CREDITORS: imported.CREDITORS ?? tenant.data.CREDITORS }
  }, [tenant, monthly, imported])

  function setImport(kind, rows) { const next = { ...imported, [kind]: rows }; setImported(next); persist({ imported: next }) }
  function clearImport(kind) { const next = { ...imported }; delete next[kind]; setImported(next); persist({ imported: next }) }

  // SimplePay via server-side proxy — the key never lives in the browser.
  async function connectSimplePay(apiKey, clientId) {
    const r = await simplePayApi.connect(apiKey, clientId)
    if (r.ok) setSimplePayConnected(true)
    return r
  }
  async function disconnectSimplePay() {
    try { await simplePayApi.disconnect() } catch (e) { console.error(e.message) }
    setSimplePayConnected(false)
  }

  async function login(email, password) {
    const now = Date.now()
    if (loginAttempts.lockedUntil > now) return { ok: false, error: `Too many failed attempts — wait ${Math.ceil((loginAttempts.lockedUntil - now) / 1000)}s` }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { const n = loginAttempts.count + 1; setLoginAttempts(n >= 5 ? { count: 0, lockedUntil: now + 30000 } : { count: n, lockedUntil: 0 }); return { ok: false, error: 'Invalid email or password' } }
    setLoginAttempts({ count: 0, lockedUntil: 0 }); return { ok: true }
  }
  async function logout() { await supabase.auth.signOut(); setCurrentUser(null); setTenant(null); setBankData(null); setSubscription(null); setAdminUnlocked(false) }
  async function registerAccount(form) {
    // Profile + tenant are created server-side by the handle_new_user trigger.
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(), password: form.password,
      options: { data: { name: form.name, tenant_id: `tenant-${Date.now()}`, business_name: form.businessName, sector: form.sector, location: form.location, staff: form.staff, plan: form.plan } },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, needsConfirmation: !data.session }
  }

  async function cancelSubscription() {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paygate-cancel`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
    const out = await res.json(); if (res.ok) setSubscription(null); return { ok: res.ok, error: out.error }
  }
  async function deleteAccount() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
    await supabase.auth.signOut(); setCurrentUser(null); setTenant(null); setBankData(null); setSubscription(null)
  }

  function loadBankStatement(extractedData) {
    const { transactions = [], bank_name = 'Bank', period_start = '', period_end = '', opening_balance = 0, closing_balance = 0 } = extractedData
    const debtorNames = (mergedData?.DEBTORS || []).map(d => d.name)
    const creditorNames = (mergedData?.CREDITORS || []).map(c => c.name || c.supplier)
    const map = (t, i, amt, prefix) => {
      const matched = findMatch(t.description, prefix === 'cr' ? debtorNames : creditorNames)
      return { id: `${prefix}-${i}`, date: t.date, description: t.description, amount: amt, entityName: matched || extractEntityName(t.description), matchedName: matched, category: t.category || 'Unknown', confirmed: false }
    }
    const next = { bankName: bank_name, periodStart: period_start, periodEnd: period_end, openingBalance: opening_balance, closingBalance: closing_balance,
      credits: transactions.filter(t => (t.credit || 0) > 0).map((t, i) => map(t, i, t.credit, 'cr')),
      debits: transactions.filter(t => (t.debit || 0) > 0).map((t, i) => map(t, i, t.debit, 'db')),
      isConfirmed: false, confirmedDebtors: null, confirmedCreditors: null }
    setBankData(next); persist({ bank_data: next })
  }
  function updateEntityName(type, id, newName) {
    setBankData(prev => {
      if (!prev) return prev
      const key = type === 'credit' ? 'credits' : 'debits'
      const next = { ...prev, [key]: prev[key].map(t => t.id === id ? { ...t, entityName: newName, confirmed: true } : t) }
      persist({ bank_data: next }); return next
    })
  }
  function confirmBankReconciliation() {
    if (!bankData) return
    const group = txs => { const g = {}; txs.forEach(t => { const k = t.entityName || 'Unknown'; (g[k] ||= { name: k, amount: 0 }).amount += t.amount }); return Object.values(g) }
    const confirmedDebtors = group(bankData.credits).map((x, i) => ({ name: x.name, reference: `BANK-${String(i + 1).padStart(3, '0')}`, amount: Math.round(x.amount), days_overdue: 0, due_date: bankData.periodEnd, source: 'bank' }))
    const confirmedCreditors = group(bankData.debits).map((x, i) => ({ name: x.name, supplier: x.name, ref: `BANK-${String(i + 1).padStart(3, '0')}`, amount: Math.round(x.amount), due: bankData.periodEnd, daysLeft: 0, overdue: false, source: 'bank' }))
    const next = { ...bankData, isConfirmed: true, confirmedDebtors, confirmedCreditors }
    const newMonthly = mergeMonthly(monthly ?? tenant.data.MONTHLY, buildMonthlyEntry(next))
    setBankData(next); setMonthly(newMonthly); persist({ bank_data: next, monthly: newMonthly })
  }
  function clearBankData() { setBankData(null); persist({ bank_data: null }) }

  function switchTenant() { /* single workspace per account — cross-tenant switching removed */ }
  function unlockAdmin(pin) { if (pin === ADMIN_PIN) { setAdminUnlocked(true); return true } return false }
  function lockAdmin() { setAdminUnlocked(false) }

  return (
    <TenantContext.Provider value={{
      tenant, data: mergedData, tenantError, systemPrompt: tenant?.systemPrompt || '',
      tenants: tenant ? [tenant] : [], activeTenantId: tid, currentUser, authLoading, subscription,
      login, logout, registerAccount, cancelSubscription, deleteAccount,
      canDeleteAccount: !!tenant && !TENANTS.some(t => t.id === tenant.id),
      switchTenant, adminUnlocked, unlockAdmin, lockAdmin,
      bankData, loadBankStatement, updateEntityName, confirmBankReconciliation, clearBankData,
      importDebtors: r => setImport('DEBTORS', r), importCreditors: r => setImport('CREDITORS', r),
      clearImportedDebtors: () => clearImport('DEBTORS'), clearImportedCreditors: () => clearImport('CREDITORS'),
      importedData: tid ? { [tid]: imported } : {},
      simplePayConnected, connectSimplePay, disconnectSimplePay,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider')
  return ctx
}

export function AdminSwitcher({ onClose }) {
  const { tenant } = useTenant()
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 280, margin: '0 0 70px 10px', background: '#0f1e35', border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ fontSize: 13, color: C.text }}>{tenant?.name}</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>One workspace per account. Cross-tenant switching has been removed.</div>
        <button onClick={onClose} style={{ marginTop: 12, padding: '8px 12px', background: 'transparent', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 5, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}
'@

Write-File "frank-app/src/App.jsx" @'
import { useState, useCallback, lazy, Suspense } from 'react'
import { Sidebar } from './components/Sidebar'
import { useFrank } from './hooks/useFrank'
import { useWonderlandData } from './hooks/useWonderlandData'
import { useSimplePayData } from './hooks/useSimplePayData'
import { C } from './lib/theme'
import { TenantProvider, useTenant } from './context/TenantContext'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { BillingReturn } from './pages/BillingReturn'

const Dashboard      = lazy(() => import('./components/views/Dashboard').then(m => ({ default: m.Dashboard })))
const CashFlow       = lazy(() => import('./components/views/CashFlow').then(m => ({ default: m.CashFlow })))
const Reports        = lazy(() => import('./components/views/Reports').then(m => ({ default: m.Reports })))
const Health         = lazy(() => import('./components/views/Health').then(m => ({ default: m.Health })))
const Documents      = lazy(() => import('./components/views/Documents').then(m => ({ default: m.Documents })))
const Debtors        = lazy(() => import('./components/views/Debtors').then(m => ({ default: m.Debtors })))
const Creditors      = lazy(() => import('./components/views/Creditors').then(m => ({ default: m.Creditors })))
const Connections    = lazy(() => import('./components/views/Connections').then(m => ({ default: m.Connections })))
const Reconciliation = lazy(() => import('./components/views/Reconciliation').then(m => ({ default: m.Reconciliation })))
const Chat           = lazy(() => import('./components/views/Chat').then(m => ({ default: m.Chat })))

const VIEW_LABELS = {
  dashboard: 'Dashboard', cashflow: 'Cash Flow', reports: 'Reports', health: 'Business Health',
  documents: 'Upload Documents', ar: 'Debtors', ap: 'Creditors', reconcile: 'Reconciliation',
  connect: 'Connections', chat: 'Ask Zeeder',
}

export default function App() {
  if (window.location.pathname.startsWith('/billing/return')) return <BillingReturn />
  return (
    <TenantProvider>
      <AppContent />
    </TenantProvider>
  )
}

function AppContent() {
  const {
    tenant, data, tenantError, systemPrompt, currentUser, authLoading,
    login, logout, registerAccount, bankData,
    simplePayConnected, connectSimplePay, disconnectSimplePay,
  } = useTenant()
  const [authMode, setAuthMode] = useState('login')
  const [view, setView] = useState('dashboard')

  const isWonderland = tenant?.id === 'wonderland-educare'
  const { data: liveData, loading, error } = useWonderlandData(isWonderland)
  const { data: payrollData, loading: payrollLoading, error: payrollError } = useSimplePayData(simplePayConnected)

  const frank = useFrank([{
    role: 'assistant',
    content: "Good morning. I'm Zeeder — ask me anything about your cash flow, debtors, creditors or bills. I answer using your live workspace numbers.",
  }])

  // P1-1: the AI now receives the real workspace numbers, not just metadata.
  const latest = data?.MONTHLY?.[data.MONTHLY.length - 1] || {}
  const debtors = data?.DEBTORS || []
  const creditors = data?.CREDITORS || []
  const arTotal = debtors.reduce((s, d) => s + (d.amount || 0), 0)
  const apTotal = creditors.reduce((s, c) => s + (c.amount || 0), 0)
  const aiContext = `${systemPrompt}

CURRENT WORKSPACE NUMBERS (answer from these; if data is missing, say what to upload):
- Cash: R ${latest.cash ?? 0} · Revenue this month: R ${latest.rev ?? 0} · Expenses: R ${latest.exp ?? 0} · Net: R ${latest.net ?? 0} (${latest.m ?? 'no month yet'})
- Debtors: ${debtors.length} totalling R ${arTotal}
- Creditors: ${creditors.length} totalling R ${apTotal}
${bankData ? `- Latest bank statement: ${bankData.bankName} ${bankData.periodStart} to ${bankData.periodEnd}, closing balance R ${bankData.closingBalance}${bankData.isConfirmed ? ' (reconciled)' : ' (not yet confirmed)'}` : '- No bank statement loaded yet.'}
Be concise. Numbers first. One specific next action per answer.`

  const goChat = useCallback((question) => {
    setView('chat')
    if (question) setTimeout(() => frank.send(question, aiContext), 100)
  }, [frank, aiContext])

  const viewProps = {
    onAsk: goChat, frank, isWonderland,
    liveData: isWonderland ? liveData : null,
    loading: isWonderland ? loading : false,
    error: isWonderland ? error : null,
    payrollData, payrollLoading, payrollError,
    simplePayConnected, connectSimplePay, disconnectSimplePay,
  }

  const spinner = (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="blink" style={{ width: 10, height: 10, borderRadius: '50%', background: C.frank }} />
    </div>
  )

  if (authLoading) return spinner
  if (!currentUser) {
    if (authMode === 'onboarding') return <Onboarding onComplete={(form) => registerAccount(form)} onBack={() => setAuthMode('login')} />
    return <Login onLogin={login} onStartOnboarding={() => setAuthMode('onboarding')} />
  }
  // P0-1: never fall back into another tenant's workspace.
  if (tenantError) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: C.danger, fontSize: 15 }}>{tenantError}</div>
        <button onClick={logout} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 6, cursor: 'pointer' }}>Sign out</button>
      </div>
    )
  }
  if (!tenant || !data) return spinner

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      <Sidebar view={view} onNav={setView} onAsk={goChat} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: C.bg }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: 0.5 }}>{VIEW_LABELS[view]}</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2, letterSpacing: 0.5 }}>
              {tenant.name} · {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button onClick={() => goChat(`Give me a complete financial briefing for ${tenant.name} with cashflow risks and the 3 most urgent actions`)}
            style={{ padding: '7px 16px', borderRadius: 4, border: `1px solid ${C.frank}30`, background: C.frankDim, color: C.frank, cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            ⚡ Full Briefing
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
          <Suspense fallback={spinner}>
            {view === 'dashboard'  && <Dashboard      {...viewProps} />}
            {view === 'cashflow'   && <CashFlow       {...viewProps} />}
            {view === 'reports'    && <Reports        {...viewProps} />}
            {view === 'health'     && <Health         {...viewProps} />}
            {view === 'documents'  && <Documents      {...viewProps} onNav={setView} />}
            {view === 'ar'         && <Debtors        {...viewProps} onNav={setView} />}
            {view === 'ap'         && <Creditors      {...viewProps} onNav={setView} />}
            {view === 'reconcile'  && <Reconciliation {...viewProps} onNav={setView} />}
            {view === 'connect'    && <Connections    {...viewProps} />}
            {view === 'chat'       && <Chat frank={frank} systemPrompt={aiContext} />}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
'@

Write-File "frank-app/src/components/views/Chat.jsx" @'
import { useState, useRef, useEffect } from 'react'
import { C } from '../../lib/theme'
import { ChatMessage, TypingIndicator } from '../shared'

const QUICK_QUESTIONS = [
  'What is my cash position right now?',
  'Who owes me money and how much?',
  'What bills are due soon?',
  'Am I making a profit this month?',
  'What are my 3 biggest risks?',
  'What should I do this week to improve cash flow?',
]

export function Chat({ frank, systemPrompt }) {
  const { messages, loading, send } = frank
  const [input, setInput] = useState('')
  const chatEnd = useRef(null)

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const handleSend = () => {
    if (!input.trim() || loading) return
    send(input.trim(), systemPrompt)
    setInput('')
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {messages.map((m, i) => <ChatMessage key={i} message={m} />)}
        {loading && <TypingIndicator />}
        <div ref={chatEnd} />
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => setInput(q)} style={{ padding: '5px 13px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontSize: 13, cursor: 'pointer' }}>{q}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask Zeeder about your finances..."
            style={{ flex: 1, padding: '13px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 15 }} />
          <button onClick={handleSend} disabled={loading || !input.trim()}
            style={{ padding: '13px 24px', background: input.trim() && !loading ? C.frank : C.muted, border: 'none', borderRadius: 6, color: C.bg, cursor: input.trim() && !loading ? 'pointer' : 'default', fontWeight: 700, fontSize: 15, transition: 'background .15s' }}>
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
'@

Write-File "frank-app/src/components/views/Connections.jsx" @'
import { useState } from 'react'
import { C } from '../../lib/theme'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function StatusDot({ status }) {
  const colors = { live: C.frank, error: C.warn, off: C.dim, soon: C.dim }
  const labels = { live: 'Live', error: 'Error', off: 'Not connected', soon: 'Coming soon' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: colors[status], fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{labels[status]}</span>
    </div>
  )
}

function CardShell({ icon, name, status, children }) {
  return (
    <div style={{ background: C.card, borderRadius: 8, padding: '18px 20px',
      border: `1px solid ${status === 'live' ? C.frank + '33' : C.border}`,
      borderLeft: `3px solid ${status === 'live' ? C.frank : status === 'error' ? C.warn : C.dim}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{name}</div>
            <StatusDot status={status} />
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

function Detail({ status, children }) {
  if (!children) return null
  return (
    <div style={{ fontSize: 11, color: status === 'error' ? C.warn : C.frank,
      background: status === 'error' ? `${C.warn}10` : `${C.frank}08`,
      border: `1px solid ${status === 'error' ? C.warn + '33' : C.frank + '22'}`,
      borderRadius: 4, padding: '5px 10px', marginBottom: 8 }}>{children}</div>
  )
}

function AskButton({ onAsk, askQ }) {
  if (!askQ) return null
  return (
    <button onClick={() => onAsk(askQ)} style={{ marginTop: 4, padding: '5px 12px', borderRadius: 4, border: `1px solid ${C.frank}33`, background: C.frankDim, color: C.frank, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Ask Zeeder →</button>
  )
}

function ConnCard({ icon, name, desc, status, detail, onAsk, askQ }) {
  return (
    <CardShell icon={icon} name={name} status={status}>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: detail ? 8 : 0 }}>{desc}</div>
      <Detail status={status}>{detail}</Detail>
      <AskButton onAsk={onAsk} askQ={askQ} />
    </CardShell>
  )
}

function SimplePayCard({ payrollData, payrollLoading, payrollError, simplePayConnected, connectSimplePay, disconnectSimplePay, onAsk }) {
  const [keyInput, setKeyInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [formError, setFormError] = useState(null)

  const connected = simplePayConnected
  const payrollOk = connected && (payrollData?.employees != null || payrollData?.payRuns != null)
  const status = !connected ? 'off' : payrollLoading ? 'soon' : payrollOk ? 'live' : 'error'

  async function handleConnect() {
    setFormError(null); setConnecting(true)
    const result = await connectSimplePay(keyInput)
    setConnecting(false)
    if (!result.ok) setFormError(result.error)
    else setKeyInput('')
  }

  return (
    <CardShell icon="👥" name="SimplePay Payroll" status={status}>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 8 }}>
        Pulls live employee records and pay run history from SimplePay (SA). Used to monitor salary costs and payroll dates.
      </div>
      {connected ? (
        <>
          <Detail status={status}>
            {payrollLoading ? 'Connecting...' :
             payrollOk ? `${payrollData?.employees?.length ?? '—'} employees · ${payrollData?.payRuns?.length ?? '—'} pay runs` :
             `Connection failed: ${payrollError ?? 'unknown error'}`}
          </Detail>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AskButton onAsk={onAsk} askQ={payrollOk ? 'Summarise the payroll data — headcount, total salary cost, and next pay date' : null} />
            <button onClick={disconnectSimplePay} style={{ marginTop: 4, padding: '5px 12px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Disconnect</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !connecting && handleConnect()}
              placeholder="Paste your SimplePay API key"
              style={{ flex: 1, padding: '7px 10px', borderRadius: 4, border: `1px solid ${formError ? C.warn : C.border}`, background: '#0a1828', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'var(--mono)' }} />
            <button onClick={handleConnect} disabled={connecting || !keyInput.trim()}
              style={{ padding: '7px 14px', borderRadius: 4, border: `1px solid ${C.frank}33`, background: C.frankDim, color: C.frank, cursor: connecting ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, opacity: connecting || !keyInput.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {connecting ? 'Checking…' : 'Connect'}
            </button>
          </div>
          {formError && <div style={{ fontSize: 11, color: C.warn, marginTop: 6 }}>{formError}</div>}
          <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
            SimplePay → Profile → Manage Users → Add API User. We verify the key against the SimplePay API, then store it server-side against your workspace — your browser never sees it again.
          </div>
        </>
      )}
    </CardShell>
  )
}

export function Connections({
  onAsk, liveData, loading, error, isWonderland,
  payrollData, payrollLoading, payrollError, simplePayConnected, connectSimplePay, disconnectSimplePay,
}) {
  const claudeOk  = Boolean(SUPABASE_URL)
  const financeOk = !loading && !error && liveData != null
  const financeErr = !loading && !!error

  return (
    <div className="fade-up">
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.6 }}>
        These are the data sources Zeeder uses to give you real-time insights.
        Green means live data is flowing. If something is not connected, Zeeder falls back to your uploaded documents.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        <ConnCard icon="🤖" name="Zeeder AI (Claude)"
          desc="Powers all of Zeeder's analysis, document reading, and financial insights. Uses Anthropic's Claude model."
          status={claudeOk ? 'live' : 'error'}
          detail={claudeOk ? 'Routed through Supabase — Zeeder is thinking' : 'Supabase not configured — add VITE_SUPABASE_URL to .env'}
          onAsk={onAsk} askQ={claudeOk ? 'Give me a quick financial summary of the business right now' : null} />
        {isWonderland ? (
          <ConnCard icon="🏫" name="Wonderland Finance API"
            desc="Live feed of income, expenses, outstanding fees, and learner data direct from Wonderland's management system."
            status={loading ? 'soon' : financeOk ? 'live' : financeErr ? 'error' : 'off'}
            detail={loading ? 'Connecting...' :
              financeOk ? `${liveData?.children?.length ?? '—'} learners · ${liveData?.payments?.length ?? '—'} payment records loaded` :
              financeErr ? `Connection failed: ${error}` : null}
            onAsk={onAsk} askQ={financeOk ? 'What does the live Wonderland data tell us about cash flow this month?' : null} />
        ) : (
          <ConnCard icon="📤" name="Business Management System"
            desc="Most small businesses don't run a system Zeeder can connect to directly, and that's fine — upload your statements, invoices, and reports instead and Zeeder reads them just as accurately."
            status="off" detail="No live connection needed for your business — see Document Upload below"
            onAsk={onAsk} askQ="What documents should I upload to give Zeeder the best picture of my finances?" />
        )}
        <SimplePayCard payrollData={payrollData} payrollLoading={payrollLoading} payrollError={payrollError}
          simplePayConnected={simplePayConnected} connectSimplePay={connectSimplePay} disconnectSimplePay={disconnectSimplePay} onAsk={onAsk} />
        <ConnCard icon="🏦" name="Absa Bank Feed"
          desc="Direct bank feed for real-time transaction monitoring. Eliminates the need to upload bank statements manually."
          status="soon" detail="Coming in next release — upload your bank statement PDF in the meantime"
          onAsk={onAsk} askQ="What would a live Absa bank feed add to my financial visibility?" />
        <ConnCard icon="📒" name="Accounting Software"
          desc="Connect Sage, Xero, or QuickBooks to pull trial balances, aged debtors, and creditor reports automatically."
          status="soon" detail="Coming soon — upload your age analysis reports manually until then"
          onAsk={onAsk} askQ="Which accounting software would work best for a business like mine?" />
        <ConnCard icon="📄" name="Document Upload"
          desc="Upload bank statements, invoices, debtor lists, and payroll reports as PDFs or CSVs. Zeeder reads and analyses them instantly."
          status="live" detail="Always available — the fallback when direct connections aren't set up yet"
          onAsk={onAsk} askQ="What documents should I upload to give Zeeder the best picture of my finances?" />
      </div>
    </div>
  )
}
'@

Commit "fix(app): P0-1/3/4/5 safe tenant fallback, cloud persistence, billing state, AI context + SimplePay wiring"

# ── Verify + push ──
git log --oneline -8
git push -u origin fix/p0-security-persistence
Write-Host ""
Write-Host "Pushed. Vercel will build a preview URL for this branch automatically."