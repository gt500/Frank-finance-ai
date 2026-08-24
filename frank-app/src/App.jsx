import { useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/views/Dashboard'
import { CashFlow } from './components/views/CashFlow'
import { Reports } from './components/views/Reports'
import { Health } from './components/views/Health'
import { Documents } from './components/views/Documents'
import { Debtors } from './components/views/Debtors'
import { Creditors } from './components/views/Creditors'
import { Connections } from './components/views/Connections'
import { Reconciliation } from './components/views/Reconciliation'
import { Chat } from './components/views/Chat'
import { useFrank } from './hooks/useFrank'
import { useWonderlandData } from './hooks/useWonderlandData'
import { useSimplePayData } from './hooks/useSimplePayData'
import { C } from './lib/theme'
import { TenantProvider, useTenant } from './context/TenantContext'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'

const VIEW_LABELS = {
  dashboard:  'Dashboard',
  cashflow:   'Cash Flow',
  reports:    'Reports',
  health:     'Business Health',
  documents:  'Upload Documents',
  ar:         'Debtors',
  ap:         'Creditors',
  reconcile:  'Reconciliation',
  connect:    'Connections',
  chat:       'Ask Zeeder',
}

export default function App() {
  return (
    <TenantProvider>
      <AppContent />
    </TenantProvider>
  )
}

function AppContent() {
  const { tenant, systemPrompt, currentUser, login, registerAccount } = useTenant()
  const [authMode, setAuthMode] = useState('login') // 'login' | 'onboarding'
  const [view, setView] = useState('dashboard')

  // Live data hooks — Wonderland-specific; other tenants get null
  const { data: liveData, loading, error } = useWonderlandData()
  const { data: payrollData, error: payrollError } = useSimplePayData()
  const isWonderland = tenant.id === 'wonderland-educare'

  const frank = useFrank([{
    role: 'assistant',
    content: `Good morning. Here's your ${tenant.name} snapshot:\n\n**Cash: ${tenant.data.MONTHLY[tenant.data.MONTHLY.length - 1]?.cash?.toLocaleString('en-ZA') ?? '—'}** · **Revenue: ${tenant.data.MONTHLY[tenant.data.MONTHLY.length - 1]?.rev?.toLocaleString('en-ZA') ?? '—'}/mo**\n\nAsk me anything about your finances.`,
  }])

  const goChat = useCallback((question) => {
    setView('chat')
    if (question) {
      setTimeout(() => frank.send(question, systemPrompt), 100)
    }
  }, [frank, systemPrompt])

  const viewProps = {
    onAsk: goChat,
    frank,
    liveData:     isWonderland ? liveData    : null,
    loading:      isWonderland ? loading     : false,
    error:        isWonderland ? error       : null,
    payrollData:  isWonderland ? payrollData : null,
    payrollError: isWonderland ? payrollError : null,
  }

  if (!currentUser) {
    if (authMode === 'onboarding') {
      return (
        <Onboarding
          onComplete={(form) => { registerAccount(form) }}
          onBack={() => setAuthMode('login')}
        />
      )
    }
    return <Login onLogin={login} onStartOnboarding={() => setAuthMode('onboarding')} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      <Sidebar view={view} onNav={setView} onAsk={goChat} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: C.bg }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: 0.5 }}>{VIEW_LABELS[view]}</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2, letterSpacing: 0.5 }}>
              {tenant.name} · {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button onClick={() => goChat(`Give me a complete financial briefing for ${tenant.name} with cashflow risks and the 3 most urgent actions`)}
            style={{
              padding: '7px 16px', borderRadius: 4, border: `1px solid ${C.frank}30`,
              background: C.frankDim, color: C.frank, cursor: 'pointer',
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            }}>
            ⚡ Full Briefing
          </button>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
          {view === 'dashboard'  && <Dashboard     {...viewProps} />}
          {view === 'cashflow'   && <CashFlow      {...viewProps} />}
          {view === 'reports'    && <Reports       {...viewProps} />}
          {view === 'health'     && <Health        {...viewProps} />}
          {view === 'documents'  && <Documents     {...viewProps} onNav={setView} />}
          {view === 'ar'         && <Debtors       {...viewProps} onNav={setView} />}
          {view === 'ap'         && <Creditors     {...viewProps} onNav={setView} />}
          {view === 'reconcile'  && <Reconciliation {...viewProps} onNav={setView} />}
          {view === 'connect'    && <Connections   {...viewProps} />}
          {view === 'chat'       && <Chat          frank={frank} />}
        </div>
      </div>
    </div>
  )
}
