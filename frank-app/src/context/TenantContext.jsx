import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { TENANTS, getTenantById } from '../data/tenants'
import { C } from '../lib/theme'
import { supabase } from '../lib/supabaseClient'

const TenantContext = createContext(null)

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN

// Strip common SA bank prefixes and return a readable entity name
function extractEntityName(description) {
  if (!description) return 'Unknown'
  const cleaned = description
    .replace(/^(PAYMENT FROM|PAYMENT TO|TRF FROM|TRF TO|INTERNET TRF|CDT TRF|DBT ORDER|DEBIT ORDER|POS PURCHASE|ATM WITHDRAWAL|DIRECT DEP|ACH CREDIT|SALARY|WAGES)\s*/i, '')
    .replace(/\s+\d{6,}.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(' ').slice(0, 3).join(' ') || description.substring(0, 25)
}

// Match a transaction description against a list of known names
function findMatch(description, knownNames) {
  const desc = (description || '').toLowerCase()
  return knownNames.find(n => {
    const name = (n || '').toLowerCase()
    const firstWord = name.split(' ')[0]
    return firstWord.length > 2 && desc.includes(firstWord)
  }) || null
}

// Accounts now live in Supabase Auth — see supabase/migrations/20260920a_profiles_and_rls.sql.
// The two accounts that used to be hardcoded here (admin@capefresh.co.za,
// bev@wonderlandeducare.com) need to be created once via supabase.auth.signUp
// or the Supabase dashboard, with a matching row in `profiles` setting their
// tenant_id to 'cape-fresh-grocery' / 'wonderland-educare'.

function buildNewTenant(form) {
  const id = `tenant-${Date.now()}`
  const planPrice = form.plan === 'growth' ? 999 : 499
  const planName  = form.plan === 'growth' ? 'Growth' : 'Starter'
  const now = new Date()
  const monthLabel = now.toLocaleString('en-ZA', { month: 'short', year: '2-digit' })
  return {
    id,
    name: form.businessName,
    owner: form.name,
    sector: form.sector,
    staff: parseInt(form.staff) || 1,
    location: form.location,
    children: null,
    plan: planName,
    planPrice,
    trialStart: new Date().toISOString(),
    data: {
      MONTHLY: [{ month: monthLabel, rev: 0, cost: 0, profit: 0, cash: 0 }],
      WEEKLY_FORECAST: [],
      EXPENSES: [
        { label: 'Staff', value: 40 }, { label: 'Rent', value: 20 },
        { label: 'Admin', value: 15 }, { label: 'Other', value: 25 },
      ],
      DEBTORS: [], CREDITORS: [], CASHFLOW_FLAGS: [],
      HEALTH_CHECKS: [
        { name: 'Cash Runway',         score: 0, note: 'Upload a bank statement to calculate' },
        { name: 'Revenue Trend',        score: 0, note: 'No data yet' },
        { name: 'Expense Control',      score: 0, note: 'No data yet' },
        { name: 'Debtor Collection',    score: 0, note: 'No data yet' },
        { name: 'Creditor Management',  score: 0, note: 'No data yet' },
        { name: 'Working Capital',      score: 0, note: 'No data yet' },
      ],
      BRIEFING: [
        { severity: 'med', text: `Welcome to Zeeder! Your ${form.businessName} workspace is ready.` },
        { severity: 'med', text: 'Upload a bank statement to populate your cash flow dashboard.' },
        { severity: 'med', text: 'Add your debtors and creditors for a complete financial picture.' },
      ],
    },
    systemPrompt: `You are Zeeder, a financial AI assistant for ${form.businessName}, a ${form.sector} business based in ${form.location} with ${parseInt(form.staff) || 1} staff. The owner's name is ${form.name}. Help with financial analysis, cash flow insights, and business advice. Be concise and practical.`,
  }
}

export function TenantProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [customTenants, setCustomTenants] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zeeder_custom_tenants') || '[]') } catch { return [] }
  })
  const [activeTenantId, setActiveTenantId] = useState(
    () => localStorage.getItem('zeeder_tenant') || TENANTS[0].id
  )
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState({ count: 0, lockedUntil: 0 })
  const [bankData, setBankData] = useState(() => {
    try {
      const id = localStorage.getItem('zeeder_tenant') || TENANTS[0].id
      const stored = localStorage.getItem(`zeeder_bank_${id}`)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  // Persist bank data per tenant whenever it changes
  useEffect(() => {
    if (bankData) {
      localStorage.setItem(`zeeder_bank_${activeTenantId}`, JSON.stringify(bankData))
    } else {
      localStorage.removeItem(`zeeder_bank_${activeTenantId}`)
    }
  }, [bankData, activeTenantId])

  // Load the correct bank data when tenant switches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`zeeder_bank_${activeTenantId}`)
      setBankData(stored ? JSON.parse(stored) : null)
    } catch { setBankData(null) }
  }, [activeTenantId])
  const [importedData, setImportedData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zeeder_imported_data') || '{}') } catch { return {} }
  })

  // Load the profile row (email, name, tenant_id) for a Supabase Auth session
  async function loadProfileForSession(session) {
    if (!session?.user) { setCurrentUser(null); return }
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, name, tenant_id')
      .eq('id', session.user.id)
      .single()
    if (error || !profile) {
      console.error('No profile row for this user — sign-up may not have completed', error)
      setCurrentUser(null)
      return
    }
    setCurrentUser({ email: profile.email, name: profile.name, tenantId: profile.tenant_id })
    setActiveTenantId(profile.tenant_id)
    localStorage.setItem('zeeder_tenant', profile.tenant_id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfileForSession(session).finally(() => setAuthLoading(false))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfileForSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])


  const allTenants = useMemo(() => [...TENANTS, ...customTenants], [customTenants])
  const tenant = useMemo(() => allTenants.find(t => t.id === activeTenantId) || allTenants[0], [allTenants, activeTenantId])

  const mergedData = useMemo(() => {
    const imp = importedData[activeTenantId] || {}
    return {
      ...tenant.data,
      DEBTORS:   imp.DEBTORS   ?? tenant.data.DEBTORS,
      CREDITORS: imp.CREDITORS ?? tenant.data.CREDITORS,
    }
  }, [tenant, activeTenantId, importedData])

  function importDebtors(rows) {
    const updated = { ...importedData, [activeTenantId]: { ...(importedData[activeTenantId] || {}), DEBTORS: rows } }
    setImportedData(updated)
    localStorage.setItem('zeeder_imported_data', JSON.stringify(updated))
  }

  function importCreditors(rows) {
    const updated = { ...importedData, [activeTenantId]: { ...(importedData[activeTenantId] || {}), CREDITORS: rows } }
    setImportedData(updated)
    localStorage.setItem('zeeder_imported_data', JSON.stringify(updated))
  }

  function clearImportedDebtors() {
    const tenantImport = { ...(importedData[activeTenantId] || {}) }
    delete tenantImport.DEBTORS
    const updated = { ...importedData, [activeTenantId]: tenantImport }
    setImportedData(updated)
    localStorage.setItem('zeeder_imported_data', JSON.stringify(updated))
  }

  function clearImportedCreditors() {
    const tenantImport = { ...(importedData[activeTenantId] || {}) }
    delete tenantImport.CREDITORS
    const updated = { ...importedData, [activeTenantId]: tenantImport }
    setImportedData(updated)
    localStorage.setItem('zeeder_imported_data', JSON.stringify(updated))
  }

  async function login(email, password) {
    const now = Date.now()
    if (loginAttempts.lockedUntil > now) {
      const secs = Math.ceil((loginAttempts.lockedUntil - now) / 1000)
      return { ok: false, error: `Too many failed attempts — wait ${secs}s before trying again` }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const newCount = loginAttempts.count + 1
      setLoginAttempts(newCount >= 5
        ? { count: 0, lockedUntil: now + 30000 }
        : { count: newCount, lockedUntil: 0 })
      return { ok: false, error: 'Invalid email or password' }
    }
    setLoginAttempts({ count: 0, lockedUntil: 0 })
    // currentUser/activeTenantId are set by the onAuthStateChange listener above
    return { ok: true }
  }

  async function logout() {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setBankData(null)
    setAdminUnlocked(false)
  }

  async function registerAccount(form) {
    const email = form.email.trim().toLowerCase()
    const newTenant = buildNewTenant(form)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
    })
    if (signUpError) {
      return { ok: false, error: signUpError.message }
    }
    if (!signUpData.user) {
      return { ok: false, error: 'Check your email to confirm your account, then log in.' }
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: signUpData.user.id,
      email,
      name: form.name,
      tenant_id: newTenant.id,
    })
    if (profileError) {
      return { ok: false, error: `Account created but profile setup failed: ${profileError.message}` }
    }

    const updatedCustom = [...customTenants, newTenant]
    setCustomTenants(updatedCustom)
    localStorage.setItem('zeeder_custom_tenants', JSON.stringify(updatedCustom))

    // onAuthStateChange fires from signUp and loads the profile into currentUser/activeTenantId
    return { ok: true }
  }

  function switchTenant(id) {
    localStorage.setItem('zeeder_tenant', id)
    setActiveTenantId(id)
    setAdminUnlocked(false)
    setBankData(null)
  }

  function unlockAdmin(pin) {
    if (pin === ADMIN_PIN) { setAdminUnlocked(true); return true }
    return false
  }

  function lockAdmin() { setAdminUnlocked(false) }

  function loadBankStatement(extractedData) {
    const {
      transactions = [],
      bank_name = 'Bank',
      period_start = '',
      period_end = '',
      opening_balance = 0,
      closing_balance = 0,
    } = extractedData

    const debtorNames   = (tenant.data.DEBTORS  || []).map(d => d.name)
    const creditorNames = (tenant.data.CREDITORS || []).map(c => c.name || c.supplier)

    const credits = transactions
      .filter(t => (t.credit || 0) > 0)
      .map((t, i) => {
        const matched = findMatch(t.description, debtorNames)
        return {
          id: `cr-${i}`,
          date: t.date,
          description: t.description,
          amount: t.credit,
          entityName: matched || extractEntityName(t.description),
          matchedName: matched,
          category: t.category || 'Unknown',
          confirmed: false,
        }
      })

    const debits = transactions
      .filter(t => (t.debit || 0) > 0)
      .map((t, i) => {
        const matched = findMatch(t.description, creditorNames)
        return {
          id: `db-${i}`,
          date: t.date,
          description: t.description,
          amount: t.debit,
          entityName: matched || extractEntityName(t.description),
          matchedName: matched,
          category: t.category || 'Unknown',
          confirmed: false,
        }
      })

    setBankData({
      bankName: bank_name,
      periodStart: period_start,
      periodEnd: period_end,
      openingBalance: opening_balance,
      closingBalance: closing_balance,
      credits,
      debits,
      isConfirmed: false,
      confirmedDebtors: null,
      confirmedCreditors: null,
    })
  }

  function updateEntityName(type, id, newName) {
    setBankData(prev => {
      if (!prev) return prev
      const key = type === 'credit' ? 'credits' : 'debits'
      return {
        ...prev,
        [key]: prev[key].map(t => t.id === id ? { ...t, entityName: newName, confirmed: true } : t),
      }
    })
  }

  function confirmBankReconciliation() {
    if (!bankData) return
    // Group credits by entityName → debtors
    const creditGroups = {}
    bankData.credits.forEach(t => {
      const key = t.entityName || 'Unknown'
      if (!creditGroups[key]) creditGroups[key] = { name: key, amount: 0, transactions: [] }
      creditGroups[key].amount += t.amount
      creditGroups[key].transactions.push(t)
    })
    // Group debits by entityName → creditors
    const debitGroups = {}
    bankData.debits.forEach(t => {
      const key = t.entityName || 'Unknown'
      if (!debitGroups[key]) debitGroups[key] = { name: key, amount: 0, transactions: [] }
      debitGroups[key].amount += t.amount
      debitGroups[key].transactions.push(t)
    })

    const confirmedDebtors = Object.values(creditGroups).map((g, i) => ({
      name: g.name,
      reference: `BANK-${String(i + 1).padStart(3, '0')}`,
      amount: Math.round(g.amount),
      days_overdue: 0,
      due_date: bankData.periodEnd,
      source: 'bank',
    }))

    const confirmedCreditors = Object.values(debitGroups).map((g, i) => ({
      name: g.name,
      supplier: g.name,
      ref: `BANK-${String(i + 1).padStart(3, '0')}`,
      amount: Math.round(g.amount),
      due: bankData.periodEnd,
      daysLeft: 0,
      overdue: false,
      source: 'bank',
    }))

    setBankData(prev => ({ ...prev, isConfirmed: true, confirmedDebtors, confirmedCreditors }))
  }

  function clearBankData() {
    setBankData(null)
    localStorage.removeItem(`zeeder_bank_${activeTenantId}`)
  }

  async function deleteAccount() {
    if (!currentUser) return
    const { tenantId } = currentUser
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    }
    const updatedCustom = customTenants.filter(t => t.id !== tenantId)
    setCustomTenants(updatedCustom)
    localStorage.setItem('zeeder_custom_tenants', JSON.stringify(updatedCustom))
    localStorage.removeItem(`zeeder_bank_${tenantId}`)
    try {
      const imp = JSON.parse(localStorage.getItem('zeeder_imported_data') || '{}')
      delete imp[tenantId]
      localStorage.setItem('zeeder_imported_data', JSON.stringify(imp))
    } catch {}
    await supabase.auth.signOut()
    setCurrentUser(null)
    localStorage.removeItem('zeeder_tenant')
    setBankData(null)
    setAdminUnlocked(false)
  }

  return (
    <TenantContext.Provider value={{
      tenant,
      data:           mergedData,
      systemPrompt:   tenant.systemPrompt,
      tenants:        allTenants,
      activeTenantId,
      currentUser,
      authLoading,
      login,
      logout,
      registerAccount,
      switchTenant,
      adminUnlocked,
      unlockAdmin,
      lockAdmin,
      bankData,
      loadBankStatement,
      updateEntityName,
      confirmBankReconciliation,
      clearBankData,
      deleteAccount,
      canDeleteAccount: customTenants.some(t => t.id === activeTenantId),
      importDebtors,
      importCreditors,
      clearImportedDebtors,
      clearImportedCreditors,
      importedData,
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

// ─── Admin Tenant Switcher Modal ────────────────────────────────────────────
// Rendered by Sidebar — self-contained so Sidebar stays clean
export function AdminSwitcher({ onClose }) {
  const { tenant, tenants, activeTenantId, currentUser, switchTenant, adminUnlocked, unlockAdmin, lockAdmin } = useTenant()
  const visibleTenants = tenants.filter(t => t.id === currentUser?.tenantId)
  const [pin, setPin]       = useState('')
  const [pinError, setPinError] = useState(false)

  function handleUnlock() {
    if (unlockAdmin(pin)) { setPin(''); setPinError(false) }
    else { setPinError(true); setPin('') }
  }

  function handleSwitch(id) {
    switchTenant(id)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 280, marginLeft: 10, marginBottom: 70,
          background: '#0f1e35', border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '18px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>

        <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
          Admin — Switch Tenant
        </div>

        {!adminUnlocked ? (
          <>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>Enter admin PIN to continue</div>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(false) }}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              placeholder="••••"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 5,
                border: `1px solid ${pinError ? C.danger : C.border}`,
                background: '#0a1828', color: C.text,
                fontSize: 18, letterSpacing: 6, textAlign: 'center',
                outline: 'none', marginBottom: 10, boxSizing: 'border-box',
                fontFamily: 'var(--mono)',
              }}
            />
            {pinError && <div style={{ fontSize: 12, color: C.danger, marginBottom: 8 }}>Incorrect PIN</div>}
            <button
              onClick={handleUnlock}
              style={{
                width: '100%', padding: '9px', borderRadius: 5,
                border: `1px solid ${C.frank}30`, background: C.frankDim,
                color: C.frank, fontSize: 12, cursor: 'pointer', fontWeight: 700, letterSpacing: 1,
              }}>
              Unlock
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {visibleTenants.map(t => {
                const active = t.id === activeTenantId
                return (
                  <button
                    key={t.id}
                    onClick={() => !active && handleSwitch(t.id)}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: 6, textAlign: 'left',
                      border: `1px solid ${active ? C.frank : C.border}`,
                      background: active ? C.frankDim : 'transparent',
                      cursor: active ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: active ? C.frank : C.dim, flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.frank : C.text }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{t.sector} · {t.plan} Plan</div>
                    </div>
                    {active && <span style={{ marginLeft: 'auto', fontSize: 10, color: C.frank, letterSpacing: 1 }}>ACTIVE</span>}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => { lockAdmin(); onClose() }}
              style={{
                width: '100%', padding: '8px', borderRadius: 5,
                border: `1px solid ${C.border}`, background: 'transparent',
                color: C.dim, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
              }}>
              Lock Admin
            </button>
          </>
        )}
      </div>
    </div>
  )
}
