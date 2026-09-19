import { useEffect, useState } from 'react'
import { C, fmt, FONT_SUB } from '../lib/theme'

// PayGate redirects the browser here after the hosted page completes.
// It appends PAY_REQUEST_ID (and other fields) as query params on the
// ReturnUrl — we poll our own status endpoint (which itself trusts only
// PayGate's server-to-server notify, not this redirect) until it settles.

const POLL_MS = 2000
const TIMEOUT_MS = 30000

export function BillingReturn() {
  const [state, setState] = useState('checking') // checking | active | failed | timeout
  const [plan, setPlan] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payRequestId = params.get('PAY_REQUEST_ID') || params.get('pay_request_id')

    if (!payRequestId) {
      setState('failed')
      return
    }

    let cancelled = false
    const startedAt = Date.now()

    async function poll() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paygate-status?pay_request_id=${encodeURIComponent(payRequestId)}`
        )
        const data = await res.json()
        if (cancelled) return

        if (data.status === 'active') {
          setPlan(data)
          setState('active')
          return
        }
        if (data.status === 'failed') {
          setState('failed')
          return
        }
        if (Date.now() - startedAt > TIMEOUT_MS) {
          setState('timeout')
          return
        }
        setTimeout(poll, POLL_MS)
      } catch {
        if (!cancelled) setTimeout(poll, POLL_MS)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [])

  const copy = {
    checking: {
      color: C.sub,
      title: 'Confirming your payment…',
      body: "Hang tight — we're checking with PayGate. This usually takes a few seconds.",
    },
    active: {
      color: C.frank,
      title: 'Upgrade complete',
      body: plan
        ? `You're now on the ${plan.plan} plan at ${fmt(plan.amount_cents / 100)}/mo.`
        : "You're upgraded.",
    },
    failed: {
      color: C.danger,
      title: 'Payment did not go through',
      body: 'Your card was not charged. You can try again from the sidebar, or contact us if this keeps happening.',
    },
    timeout: {
      color: C.warn,
      title: "Still confirming…",
      body: "This is taking longer than usual. If your card was charged, your plan will update shortly — refresh in a minute. Otherwise, try again.",
    },
  }[state]

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        maxWidth: 420, width: '100%', background: C.card, border: `1px solid ${C.border}`,
        borderTop: `2px solid ${copy.color}`, borderRadius: 8, padding: '32px 28px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: FONT_SUB, fontSize: 10, color: C.gold, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 18 }}>
          Zeeder Finance OS
        </div>

        {state === 'checking' && (
          <div className="blink" style={{ width: 10, height: 10, borderRadius: '50%', background: copy.color, margin: '0 auto 18px' }} />
        )}
        {state === 'active' && <div style={{ fontSize: 34, color: copy.color, marginBottom: 12 }}>✓</div>}
        {(state === 'failed' || state === 'timeout') && <div style={{ fontSize: 34, color: copy.color, marginBottom: 12 }}>{state === 'failed' ? '✕' : '⋯'}</div>}

        <div style={{ fontSize: 17, fontWeight: 700, color: copy.color, marginBottom: 10 }}>{copy.title}</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 24 }}>{copy.body}</div>

        <button
          onClick={() => { window.location.href = '/' }}
          style={{
            padding: '10px 22px', borderRadius: 5, border: `1px solid ${copy.color}40`,
            background: `${copy.color}10`, color: copy.color, fontSize: 12, fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
          }}>
          {state === 'active' ? 'Go to dashboard' : 'Back to Zeeder'}
        </button>
      </div>
    </div>
  )
}
