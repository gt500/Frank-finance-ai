import { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react'
import { TENANTS } from '../data/tenants'
import { C } from '../lib/theme'
import { supabase } from '../lib/supabaseClient'
import { simplePayApi } from '../lib/simplePayApi'
import { buildMonthlyEntry, mergeMonthly, removeMonthly } from '../lib/monthlyHistory'
import { createSaveQueue } from '../lib/saveQueue'

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
  const [saveError, setSaveError] = useState(null)
  const tid = currentUser?.tenantId

  // Refs mirror the latest values so rapid edits never build on a stale render's copy.
  const importedRef = useRef({})
  const bankDataRef = useRef(null)
  const monthlyRef = useRef(null)
  const wsReadyRef = useRef(false)      // false until a workspace load fully succeeds — no saves before that
  const loadedUserRef = useRef(null)    // user whose workspace is loaded; skips token-refresh re-fires
  const loadSeqRef = useRef(0)          // only the newest auth event may apply its results

  const applyImported = (v) => { importedRef.current = v; setImported(v) }
  const applyBankData = (v) => { bankDataRef.current = v; setBankData(v) }
  const applyMonthly = (v) => { monthlyRef.current = v; setMonthly(v) }

  function resetWorkspace() {
    wsReadyRef.current = false
    loadedUserRef.current = null
    saveTidRef.current = null
    saveQueueRef.current?.reset()
    setCurrentUser(null); setTenant(null); setSubscription(null); setSimplePayConnected(false)
    setSaveError(null); setAdminUnlocked(false)
    applyBankData(null); applyImported({}); applyMonthly(null)
  }

  // Cloud persistence (P0-3) through an ordered, self-healing queue: saves never land out of order,
  // and a failed save is resent with the next one. Demo tenant = in-memory only (saveTidRef stays null).
  const saveTidRef = useRef(null)
  const saveQueueRef = useRef(null)
  if (!saveQueueRef.current) {
    saveQueueRef.current = createSaveQueue(async (batch) => {
      const { error } = await supabase.from('tenant_data')
        .upsert({ tenant_id: saveTidRef.current, ...batch, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
      if (error) throw error
    }, (err) => {
      if (err) console.error('Save failed:', err.message)
      setSaveError(err ? 'Your latest changes are not saved yet — they will be resent automatically.' : null)
    })
  }
  function persist(patch) {
    if (!saveTidRef.current || !wsReadyRef.current) return
    saveQueueRef.current.push(patch)
  }

  // Closing the tab mid-save would lose the change: let the browser warn first.
  useEffect(() => {
    const warn = (e) => { if (saveQueueRef.current.hasPending()) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  async function loadWorkspace(profile, isStale) {
    // Static demo definitions live in code; custom tenants live in the DB. No fallback to TENANTS[0].
    let t = TENANTS.find(x => x.id === profile.tenant_id) || null
    if (!t) {
      const { data, error } = await supabase.from('tenants').select('profile').eq('id', profile.tenant_id).maybeSingle()
      if (isStale()) return
      if (error) { setTenantError('Could not load your workspace — please refresh.'); return }
      t = data?.profile || null
    }
    if (!t) { setTenant(null); setTenantError('Workspace not found for this account. Contact support.'); return }
    const [{ data: td, error: tdErr }, { data: sub, error: subErr }] = await Promise.all([
      supabase.from('tenant_data').select('*').eq('tenant_id', profile.tenant_id).maybeSingle(),
      supabase.from('subscriptions').select('status, plan, amount_cents').eq('tenant_id', profile.tenant_id).eq('status', 'active').limit(1).maybeSingle(),
    ])
    if (isStale()) return
    // A failed read must never be treated as "empty" — the next save would overwrite real data.
    if (tdErr || subErr) { setTenantError('Could not load your workspace data — please refresh.'); return }
    const stored = t.demo ? null : td
    applyBankData(stored?.bank_data || null)
    applyImported(stored?.imported || {})
    applyMonthly(stored?.monthly || null)
    setSimplePayConnected(!!stored?.simplepay_connected)
    setSubscription(sub || null)
    setTenant(t)
    saveTidRef.current = t.demo ? null : profile.tenant_id
    wsReadyRef.current = true
  }

  async function loadProfileForSession(session) {
    // Token refresh / tab refocus for a fully loaded user: keep local state. Checked BEFORE taking a
    // sequence number, so it can never invalidate a load that is still in flight.
    if (session?.user && loadedUserRef.current === session.user.id) return
    const seq = ++loadSeqRef.current
    const isStale = () => seq !== loadSeqRef.current
    try {
      resetWorkspace(); setTenantError(null)
      if (!session?.user) return
      const { data: profile, error } = await supabase.from('profiles')
        .select('email, name, tenant_id, created_at').eq('id', session.user.id).maybeSingle()
      if (isStale()) return
      if (error || !profile) { setTenantError(error ? 'Could not load your account — please refresh.' : 'No profile for this account. Contact support.'); return }
      // One-time purge of legacy browser storage (old cross-tenant leak vector).
      LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
      Object.keys(localStorage).filter(k => k.startsWith('zeeder_bank_')).forEach(k => localStorage.removeItem(k))
      const trialDaysLeft = Math.max(0, 14 - Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000))
      setCurrentUser({ id: session.user.id, email: profile.email, name: profile.name, tenantId: profile.tenant_id, trialDaysLeft })
      await loadWorkspace(profile, isStale)
      // Only a fully successful load counts as "loaded": after an error, the next auth event retries.
      if (!isStale() && wsReadyRef.current) loadedUserRef.current = session.user.id
    } catch (e) {
      console.error('Workspace load failed:', e)
      if (!isStale()) setTenantError('Could not load your workspace — please refresh.')
    } finally {
      if (!isStale()) setAuthLoading(false)
    }
  }

  useEffect(() => {
    // INITIAL_SESSION fires on subscribe, so this one listener covers page load too.
    // Supabase calls are deferred out of the callback (awaiting them inside it can deadlock auth-js).
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => { loadProfileForSession(session) }, 0)
    })
    return () => listener.subscription.unsubscribe()
    // loadProfileForSession only touches state setters and refs, so the first render's copy is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mergedData = useMemo(() => {
    if (!tenant) return null
    return { ...tenant.data,
      MONTHLY: monthly ?? tenant.data.MONTHLY,
      DEBTORS: imported.DEBTORS ?? tenant.data.DEBTORS,
      CREDITORS: imported.CREDITORS ?? tenant.data.CREDITORS }
  }, [tenant, monthly, imported])

  function setImport(kind, rows) { const next = { ...importedRef.current, [kind]: rows }; applyImported(next); persist({ imported: next }) }
  function clearImport(kind) { const next = Object.fromEntries(Object.entries(importedRef.current).filter(([k]) => k !== kind)); applyImported(next); persist({ imported: next }) }

  // SimplePay via server-side proxy — the key never lives in the browser.
  async function connectSimplePay(apiKey, clientId) {
    const r = await simplePayApi.connect(apiKey, clientId)
    if (r.ok) setSimplePayConnected(true)
    return r
  }
  async function disconnectSimplePay() {
    try {
      await simplePayApi.disconnect()
      setSimplePayConnected(false)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: `Disconnect failed — your key is still stored: ${e.message}` }
    }
  }

  async function login(email, password) {
    const now = Date.now()
    if (loginAttempts.lockedUntil > now) return { ok: false, error: `Too many failed attempts — wait ${Math.ceil((loginAttempts.lockedUntil - now) / 1000)}s` }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { const n = loginAttempts.count + 1; setLoginAttempts(n >= 5 ? { count: 0, lockedUntil: now + 30000 } : { count: n, lockedUntil: 0 }); return { ok: false, error: 'Invalid email or password' } }
    setLoginAttempts({ count: 0, lockedUntil: 0 }); return { ok: true }
  }
  async function logout() {
    // Give unsaved changes one last chance before the queue is dropped.
    if (saveQueueRef.current.hasPending()) await saveQueueRef.current.retry()
    await supabase.auth.signOut(); resetWorkspace(); setTenantError(null)
  }
  async function registerAccount(form) {
    // Profile + tenant are created server-side by the handle_new_user trigger.
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(), password: form.password,
      options: { data: { name: form.name, tenant_id: `tenant-${Date.now()}`, business_name: form.businessName, sector: form.sector, location: form.location, staff: form.staff, plan: form.plan } },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, needsConfirmation: !data.session }
  }

  // Calls an authed edge function; never throws — returns { ok, error } so the UI can always report it.
  async function callFunction(name) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { ok: false, error: 'Not signed in — please log in again.' }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const out = await res.json().catch(() => ({}))
      return { ok: res.ok, error: res.ok ? null : (out.error || `Request failed (${res.status})`) }
    } catch (e) {
      return { ok: false, error: `Network error: ${e.message}` }
    }
  }
  async function cancelSubscription() {
    const r = await callFunction('paygate-cancel')
    if (r.ok) setSubscription(null)
    return r
  }
  async function deleteAccount() {
    const r = await callFunction('delete-account')
    if (!r.ok) return r // account still exists — stay signed in and show the error
    await supabase.auth.signOut(); resetWorkspace()
    return r
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
    applyBankData(next); persist({ bank_data: next })
  }
  function updateEntityName(type, id, newName) {
    const prev = bankDataRef.current
    if (!prev) return
    const key = type === 'credit' ? 'credits' : 'debits'
    const next = { ...prev, [key]: prev[key].map(t => t.id === id ? { ...t, entityName: newName, confirmed: true } : t) }
    applyBankData(next); persist({ bank_data: next })
  }
  function confirmBankReconciliation() {
    const bankData = bankDataRef.current
    if (!bankData) return
    const group = txs => { const g = {}; txs.forEach(t => { const k = t.entityName || 'Unknown'; (g[k] ||= { name: k, amount: 0 }).amount += t.amount }); return Object.values(g) }
    const confirmedDebtors = group(bankData.credits).map((x, i) => ({ name: x.name, reference: `BANK-${String(i + 1).padStart(3, '0')}`, amount: Math.round(x.amount), days_overdue: 0, due_date: bankData.periodEnd, source: 'bank' }))
    const confirmedCreditors = group(bankData.debits).map((x, i) => ({ name: x.name, supplier: x.name, ref: `BANK-${String(i + 1).padStart(3, '0')}`, amount: Math.round(x.amount), due: bankData.periodEnd, daysLeft: 0, overdue: false, source: 'bank' }))
    const next = { ...bankData, isConfirmed: true, confirmedDebtors, confirmedCreditors }
    const newMonthly = mergeMonthly(monthlyRef.current ?? tenant.data.MONTHLY, buildMonthlyEntry(next))
    applyBankData(next); applyMonthly(newMonthly); persist({ bank_data: next, monthly: newMonthly })
  }
  function clearBankData() {
    const cleared = bankDataRef.current
    // A confirmed statement also wrote its month into the history — take that back out too.
    const newMonthly = cleared?.isConfirmed ? removeMonthly(monthlyRef.current, cleared) : monthlyRef.current
    applyBankData(null); applyMonthly(newMonthly); persist({ bank_data: null, monthly: newMonthly })
  }

  function switchTenant() { /* single workspace per account — cross-tenant switching removed */ }
  function unlockAdmin(pin) { if (pin === ADMIN_PIN) { setAdminUnlocked(true); return true } return false }
  function lockAdmin() { setAdminUnlocked(false) }

  return (
    <TenantContext.Provider value={{
      tenant, data: mergedData, tenantError, saveError, retrySave: () => saveQueueRef.current.retry(), systemPrompt: tenant?.systemPrompt || '',
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