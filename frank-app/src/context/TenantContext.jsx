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