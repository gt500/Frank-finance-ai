import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { TENANTS, getTenantById } from '../data/tenants'
import { C } from '../lib/theme'

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

// Shared by loadBankStatement (existing tenant) and registerAccount (brand
// new tenant, onboarding) — takes the raw AI extraction and the target
// tenant's own debtor/creditor names, so it never matches against another
// tenant's data.
function buildBankData(extractedData, debtorNames, creditorNames) {
  const {
    transactions = [],
    bank_name = 'Bank',
    period_start = '',
    period_end = '',
    opening_balance = 0,
    closing_balance = 0,
  } = extractedData

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

  return {
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
  }
}

const DEMO_ACCOUNTS = [
  { email: 'admin@capefresh.co.za', password: import.meta.env.VITE_DEMO_PASSWORD, name: 'Cape Fresh Admin', tenantId: 'cape-fresh-grocery' },
]

// Private accounts are validated at login time only — NEVER written to localStorage
const PRIVATE_ACCOUNTS = [
  { email: 'bev@wonderlandeducare.com', password: import.meta.env.VITE_WONDERLAND_PASSWORD, name: 'Bev Manson', tenantId: 'wonderland-educare' },
]

function seedAccounts() {
  const stored = localStorage.getItem('zeeder_accounts')
  const existing = stored ? JSON.parse(stored) : DEMO_ACCOUNTS
  // Strip any private accounts that leaked from a prior version — they must never live in localStorage
  const privateEmails = new Set(PRIVATE_ACCOUNTS.map(p => p.email))
  const cleaned = existing.filter(a => !privateEmails.has(a.email))
  localStorage.setItem('zeeder_accounts', JSON.stringify(cleaned))
  return cleaned
}

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
  const [accounts, setAccounts] = useState(seedAccounts)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zeeder_user') || 'null') } catch { return null }
  })
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
  const [categoryMaps, setCategoryMaps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zeeder_category_map') || '{}') } catch { return {} }
  })

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

  function setCategoryMapping(rawCategory, accountCode) {
    const updated = { ...categoryMaps, [activeTenantId]: { ...(categoryMaps[activeTenantId] || {}), [rawCategory]: accountCode } }
    setCategoryMaps(updated)
    localStorage.setItem('zeeder_category_map', JSON.stringify(updated))
  }

  function login(email, password) {
    const now = Date.now()
    if (loginAttempts.lockedUntil > now) {
      const secs = Math.ceil((loginAttempts.lockedUntil - now) / 1000)
      return { ok: false, error: `Too many failed attempts — wait ${secs}s before trying again` }
    }
    // Check private accounts against env vars first — never read from localStorage
    const matched =
      PRIVATE_ACCOUNTS.find(a => a.email === email && a.password === password) ||
      accounts.find(a => a.email === email && a.password === password)
    if (!matched) {
      const newCount = loginAttempts.count + 1
      setLoginAttempts(newCount >= 5
        ? { count: 0, lockedUntil: now + 30000 }
        : { count: newCount, lockedUntil: 0 })
      return { ok: false, error: 'Invalid email or password' }
    }
    setLoginAttempts({ count: 0, lockedUntil: 0 })
    const user = { email: matched.email, name: matched.name, tenantId: matched.tenantId }
    setCurrentUser(user)
    localStorage.setItem('zeeder_user', JSON.stringify(user))
    setActiveTenantId(matched.tenantId)
    localStorage.setItem('zeeder_tenant', matched.tenantId)
    return { ok: true }
  }

  function logout() {
    setCurrentUser(null)
    localStorage.removeItem('zeeder_user')
    setBankData(null)
    setAdminUnlocked(false)
    // Purge any private-account entries that may have leaked into localStorage from a prior version
    const privateEmails = new Set(PRIVATE_ACCOUNTS.map(p => p.email))
    const cleaned = accounts.filter(a => !privateEmails.has(a.email))
    if (cleaned.length !== accounts.length) {
      setAccounts(cleaned)
      localStorage.setItem('zeeder_accounts', JSON.stringify(cleaned))
    }
  }

  function registerAccount(form, bankExtract) {
    const email = form.email.trim().toLowerCase()
    if (accounts.find(a => a.email === email)) {
      return { ok: false, error: 'An account with this email already exists' }
    }
    const newTenant  = buildNewTenant(form)
    const newAccount = { email, password: form.password, name: form.name, tenantId: newTenant.id }

    const updatedCustom   = [...customTenants, newTenant]
    const updatedAccounts = [...accounts, newAccount]
    setCustomTenants(updatedCustom)
    setAccounts(updatedAccounts)
    localStorage.setItem('zeeder_custom_tenants', JSON.stringify(updatedCustom))
    localStorage.setItem('zeeder_accounts', JSON.stringify(updatedAccounts))

    const user = { email, name: form.name, tenantId: newTenant.id }
    setCurrentUser(user)
    localStorage.setItem('zeeder_user', JSON.stringify(user))
    setActiveTenantId(newTenant.id)
    localStorage.setItem('zeeder_tenant', newTenant.id)

    // Uses newTenant's own (empty) debtor/creditor lists, never the
    // previously-active tenant's — this new tenant has no data to leak into.
    if (bankExtract) {
      const debtorNames   = newTenant.data.DEBTORS.map(d => d.name)
      const creditorNames = newTenant.data.CREDITORS.map(c => c.name || c.supplier)
      setBankData(buildBankData(bankExtract, debtorNames, creditorNames))
    }
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
    const debtorNames   = (tenant.data.DEBTORS  || []).map(d => d.name)
    const creditorNames = (tenant.data.CREDITORS || []).map(c => c.name || c.supplier)
    setBankData(buildBankData(extractedData, debtorNames, creditorNames))
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

  function deleteAccount() {
    if (!currentUser) return
    const { tenantId, email } = currentUser
    // Prevent deletion of hardcoded private/demo tenants — only custom tenants can self-delete
    if (PRIVATE_ACCOUNTS.some(p => p.email === email)) return
    const updatedCustom    = customTenants.filter(t => t.id !== tenantId)
    const updatedAccounts  = accounts.filter(a => a.email !== email)
    setCustomTenants(updatedCustom)
    setAccounts(updatedAccounts)
    localStorage.setItem('zeeder_custom_tenants', JSON.stringify(updatedCustom))
    localStorage.setItem('zeeder_accounts', JSON.stringify(updatedAccounts))
    localStorage.removeItem(`zeeder_bank_${tenantId}`)
    try {
      const imp = JSON.parse(localStorage.getItem('zeeder_imported_data') || '{}')
      delete imp[tenantId]
      localStorage.setItem('zeeder_imported_data', JSON.stringify(imp))
    } catch {}
    try {
      const catMap = JSON.parse(localStorage.getItem('zeeder_category_map') || '{}')
      delete catMap[tenantId]
      setCategoryMaps(catMap)
      localStorage.setItem('zeeder_category_map', JSON.stringify(catMap))
    } catch {}
    setCurrentUser(null)
    localStorage.removeItem('zeeder_user')
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
      categoryMap: categoryMaps[activeTenantId] || {},
      setCategoryMapping,
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
