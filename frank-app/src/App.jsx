import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
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
  const { currentUser } = useTenant()
  // A different user gets a fresh tree: chat history, view and data hooks never carry over between accounts.
  return <AppShell key={currentUser?.email ?? 'signed-out'} />
}

// Last screen per user, so coming back resumes where they left off. Only a view name — never data.
const lastViewKey = (user) => `zeeder_last_view_${user.id}`
function readLastView(user) {
  try { const v = user && localStorage.getItem(lastViewKey(user)); return v && VIEW_LABELS[v] ? v : 'dashboard' } catch { return 'dashboard' }
}

function AppShell() {
  const {
    tenant, data, tenantError, saveError, retrySave, systemPrompt, currentUser, authLoading,
    login, logout, registerAccount, bankData,
    simplePayConnected, connectSimplePay, disconnectSimplePay,
  } = useTenant()
  const [authMode, setAuthMode] = useState('login')
  const [view, setView] = useState(() => readLastView(currentUser))
  useEffect(() => {
    if (!currentUser) return
    try { localStorage.setItem(lastViewKey(currentUser), view) } catch { /* private mode: resume is best-effort */ }
  }, [view, currentUser])

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
  // P0-1: never fall back into another tenant's workspace. Checked before Login so a signed-in
  // user whose profile/workspace failed to load sees why (and can sign out) instead of a Login loop.
  if (tenantError) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: C.danger, fontSize: 15 }}>{tenantError}</div>
        <button onClick={logout} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 6, cursor: 'pointer' }}>Sign out</button>
      </div>
    )
  }
  if (!currentUser) {
    if (authMode === 'onboarding') return <Onboarding onComplete={(form) => registerAccount(form)} onBack={() => setAuthMode('login')} />
    return <Login onLogin={login} onStartOnboarding={() => setAuthMode('onboarding')} />
  }
  if (!tenant || !data) return spinner

  return (
    <div className="app-bg" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar view={view} onNav={setView} onAsk={goChat} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ padding: '22px 26px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
          <div>
            <div className="tag">
              {tenant.name} · {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: 0.2 }}>{VIEW_LABELS[view]}</h1>
          </div>
          <button className="btn-gold" onClick={() => goChat(`Give me a complete financial briefing for ${tenant.name} with cashflow risks and the 3 most urgent actions`)}>
            Full briefing
          </button>
        </header>
        {saveError && (
          <div role="alert" style={{ padding: '8px 24px', background: `${C.danger}18`, borderBottom: `1px solid ${C.danger}40`, color: C.danger, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>{saveError}</span>
            <button onClick={retrySave} style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.danger}60`, background: 'transparent', color: C.danger, fontSize: 12, cursor: 'pointer' }}>Retry now</button>
          </div>
        )}
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