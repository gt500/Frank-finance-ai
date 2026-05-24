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
import { Chat } from './components/views/Chat'
import { useFrank } from './hooks/useFrank'
import { C } from './lib/theme'
import { FRANK_SYSTEM_PROMPT } from './data/wonderland'

const VIEW_LABELS = {
  dashboard: 'Dashboard',
  cashflow:  'Cash Flow',
  reports:   'Reports',
  health:    'Business Health',
  documents: 'Upload Documents',
  ar:        'Debtors',
  ap:        'Creditors',
  connect:   'Connections',
  chat:      'Ask Frank',
}

export default function App() {
  const [view, setView] = useState('dashboard')
  const frank = useFrank([{
    role: 'assistant',
    content: `Morning, Bev. Here's your Wonderland snapshot:\n\n**Cash: R 61,400** · **Revenue: R 177,800/mo** · **Margin: R 3,600** ⚠️\n\n3 things need attention:\n1. Salary run on 25 July drops cash by R 94,500 — collect fees before then\n2. Smith family fee (R 9,000) is 3 months overdue — write-off risk\n3. Margin has dropped 81% since January — costs growing faster than revenue\n\nWant me to build a 90-day action plan?`,
  }])

  const goChat = useCallback((question) => {
    setView('chat')
    if (question) {
      setTimeout(() => frank.send(question, FRANK_SYSTEM_PROMPT), 100)
    }
  }, [frank])

  const views = { dashboard, cashflow, reports, health, documents, ar: debtors, ap: creditors, connect, chat }
  const viewProps = { onAsk: goChat, frank }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      <Sidebar view={view} onNav={setView} onAsk={goChat} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '11px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: C.bg }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{VIEW_LABELS[view]}</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>
              Wonderland Educare · {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button onClick={() => goChat('Give me a complete financial briefing for Wonderland Educare with cashflow risks and the 3 most urgent actions')}
            style={{ padding: '6px 14px', borderRadius: 5, border: `1px solid ${C.frank}44`, background: C.frankDim, color: C.frank, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
            ⚡ Full Briefing
          </button>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
          {view === 'dashboard'  && <Dashboard  {...viewProps} />}
          {view === 'cashflow'   && <CashFlow   {...viewProps} />}
          {view === 'reports'    && <Reports    {...viewProps} />}
          {view === 'health'     && <Health     {...viewProps} />}
          {view === 'documents'  && <Documents  {...viewProps} />}
          {view === 'ar'         && <Debtors    {...viewProps} />}
          {view === 'ap'         && <Creditors  {...viewProps} />}
          {view === 'connect'    && <Connections {...viewProps} />}
          {view === 'chat'       && <Chat       frank={frank} />}
        </div>
      </div>
    </div>
  )
}
