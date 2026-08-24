import { C } from '../../lib/theme'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

function StatusDot({ status }) {
  const colors = { live: C.frank, error: C.warn, off: C.dim, soon: C.dim }
  const labels = { live: 'Live', error: 'Error', off: 'Not connected', soon: 'Coming soon' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: colors[status], fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {labels[status]}
      </span>
    </div>
  )
}

function ConnCard({ icon, name, desc, status, detail, onAsk, askQ }) {
  return (
    <div style={{
      background: C.card, borderRadius: 8, padding: '18px 20px',
      border: `1px solid ${status === 'live' ? C.frank + '33' : C.border}`,
      borderLeft: `3px solid ${status === 'live' ? C.frank : status === 'error' ? C.warn : C.dim}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{name}</div>
            <StatusDot status={status} />
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: detail ? 8 : 0 }}>{desc}</div>
      {detail && (
        <div style={{
          fontSize: 11, color: status === 'error' ? C.warn : C.frank,
          background: status === 'error' ? `${C.warn}10` : `${C.frank}08`,
          border: `1px solid ${status === 'error' ? C.warn + '33' : C.frank + '22'}`,
          borderRadius: 4, padding: '5px 10px', marginBottom: 8,
        }}>{detail}</div>
      )}
      {askQ && (
        <button
          onClick={() => onAsk(askQ)}
          style={{
            marginTop: 4, padding: '5px 12px', borderRadius: 4,
            border: `1px solid ${C.frank}33`, background: C.frankDim,
            color: C.frank, cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}>
          Ask Zeeder →
        </button>
      )}
    </div>
  )
}

export function Connections({ onAsk, liveData, loading, error, payrollData, payrollError }) {
  const claudeOk  = API_KEY && !API_KEY.startsWith('your-')
  const financeOk = !loading && !error && liveData != null
  const financeErr = !loading && !!error
  const payrollOk  = payrollData?.employees != null || payrollData?.payRuns != null
  const payrollErr = !!payrollError

  return (
    <div className="fade-up">
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.6 }}>
        These are the data sources Zeeder uses to give you real-time insights.
        Green means live data is flowing. If something is not connected, Zeeder falls back to your uploaded documents.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>

        <ConnCard
          icon="🤖"
          name="Zeeder AI (Claude)"
          desc="Powers all of Zeeder's analysis, document reading, and financial insights. Uses Anthropic's Claude model."
          status={claudeOk ? 'live' : 'error'}
          detail={claudeOk ? 'API key active — Zeeder is thinking' : 'API key missing — add VITE_ANTHROPIC_API_KEY to .env'}
          onAsk={onAsk}
          askQ={claudeOk ? 'Give me a quick financial summary of the business right now' : null}
        />

        <ConnCard
          icon="🏫"
          name="Wonderland Finance API"
          desc="Live feed of income, expenses, outstanding fees, and learner data direct from Wonderland's management system."
          status={loading ? 'soon' : financeOk ? 'live' : financeErr ? 'error' : 'off'}
          detail={
            loading ? 'Connecting...' :
            financeOk ? `${liveData?.children?.length ?? '—'} learners · ${liveData?.payments?.length ?? '—'} payment records loaded` :
            financeErr ? `Connection failed: ${error}` : null
          }
          onAsk={onAsk}
          askQ={financeOk ? 'What does the live Wonderland data tell us about cash flow this month?' : null}
        />

        <ConnCard
          icon="👥"
          name="SimplePay Payroll"
          desc="Pulls live employee records and pay run history from SimplePay. Used to monitor salary costs and payroll dates."
          status={payrollOk ? 'live' : payrollErr ? 'error' : 'off'}
          detail={
            payrollOk
              ? `${payrollData?.employees?.length ?? '—'} employees · ${payrollData?.payRuns?.length ?? '—'} pay runs`
              : payrollErr
              ? 'SimplePay API not responding — upload a payroll PDF instead'
              : 'Not connected — check VITE_SIMPLEPAY_API_KEY in .env'
          }
          onAsk={onAsk}
          askQ={payrollOk ? 'Summarise the payroll data — headcount, total salary cost, and next pay date' : null}
        />

        <ConnCard
          icon="🏦"
          name="Absa Bank Feed"
          desc="Direct bank feed for real-time transaction monitoring. Eliminates the need to upload bank statements manually."
          status="soon"
          detail="Coming in next release — upload your bank statement PDF in the meantime"
          onAsk={onAsk}
          askQ="What would a live Absa bank feed add to my financial visibility?"
        />

        <ConnCard
          icon="📒"
          name="Accounting Software"
          desc="Connect Sage, Xero, or QuickBooks to pull trial balances, aged debtors, and creditor reports automatically."
          status="soon"
          detail="Coming soon — upload your age analysis reports manually until then"
          onAsk={onAsk}
          askQ="Which accounting software would work best for a business like mine?"
        />

        <ConnCard
          icon="📄"
          name="Document Upload"
          desc="Upload bank statements, invoices, debtor lists, and payroll reports as PDFs or CSVs. Zeeder reads and analyses them instantly."
          status="live"
          detail="Always available — the fallback when direct connections aren't set up yet"
          onAsk={onAsk}
          askQ="What documents should I upload to give Zeeder the best picture of my finances?"
        />

      </div>
    </div>
  )
}
