import { useState, useId, cloneElement } from 'react'
import { C, FONT_BODY } from '../lib/theme'
import { PLANS, PLAN_ORDER, priceText } from '../lib/plans'
import { LEGAL } from './legalContent'

const SECTORS = [
  'Retail', 'Food & Beverage', 'Early Childhood Education', 'Healthcare',
  'Construction & Property', 'Professional Services', 'Logistics & Transport',
  'Manufacturing', 'Agriculture', 'Technology', 'Other',
]

const baseInput = {
  width: '100%', padding: '11px 14px', borderRadius: 6,
  border: `1px solid ${C.border}`, background: C.bg,
  color: C.text, fontSize: 14, outline: 'none',
  fontFamily: FONT_BODY, boxSizing: 'border-box',
}

const btnPrimary = {
  flex: 1, padding: '12px 20px', borderRadius: 6, border: 'none',
  background: C.frank, color: '#000', fontSize: 13, fontWeight: 800,
  cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: FONT_BODY,
}

const btnBack = {
  padding: '12px 18px', borderRadius: 6,
  border: `1px solid ${C.border}`, background: 'transparent',
  color: C.sub, fontSize: 13, cursor: 'pointer', fontFamily: FONT_BODY,
}

// The label is tied to its input, and a problem is announced to screen readers.
function Field({ label, error, children }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} style={{ fontSize: 11, color: C.dim, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
        {label}
      </label>
      {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-err` : undefined })}
      {error && <div id={`${id}-err`} role="alert" style={{ fontSize: 11, color: C.danger, marginTop: 5 }}>{error}</div>}
    </div>
  )
}

const STEP_LABELS = ['Your account', 'Your business', 'Choose a plan', "You're in!"]

// Supabase's raw auth error strings aren't written for end users — translate
// the ones we actually see in practice.
function friendlyAuthError(message) {
  if (!message) return message
  if (/rate limit/i.test(message)) {
    return "We're getting a lot of signups right now — please wait a few minutes and try again."
  }
  if (/already registered|already exists/i.test(message)) {
    return 'An account with this email already exists — try signing in instead.'
  }
  if (/invalid format|invalid email/i.test(message)) {
    return 'That email address looks invalid — please check it and try again.'
  }
  return message
}

export function Onboarding({ onComplete, onBack, initialPlan }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    businessName: '', sector: '', location: '', staff: '',
    plan: PLAN_ORDER.includes(initialPlan) ? initialPlan : 'growth',
  })
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  async function handleEnter() {
    if (!consent) return
    setSubmitError(null)
    setSubmitting(true)
    const result = await onComplete({ ...form, consent: true })
    if (!result?.ok) {
      setSubmitError(friendlyAuthError(result?.error) || 'Something went wrong creating your account')
      setSubmitting(false)
    } else if (result.needsConfirmation) {
      setNeedsConfirmation(true)
      setSubmitting(false)
    }
    // Otherwise App swaps to the dashboard once currentUser is set — nothing left to do here.
  }

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  function validateStep0() {
    const e = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required'
    if (form.password.length < 6) e.password = 'Minimum 6 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep1() {
    const e = {}
    if (!form.businessName.trim()) e.businessName = 'Required'
    if (!form.sector) e.sector = 'Please select a sector'
    if (!form.location.trim()) e.location = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (step === 0 && !validateStep0()) return
    if (step === 1 && !validateStep1()) return
    setStep(s => s + 1)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${C.card} 0%, ${C.bg} 70%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: FONT_BODY, padding: '40px 20px',
    }}>

      {/* Logo */}
      <div style={{ marginBottom: 32 }}>
        <img src="/zeeder-logo.png" alt="Zeeder AI" style={{ height: 240, display: 'block' }} />
      </div>

      {/* Progress indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: i < step ? C.frank : i === step ? C.frank : 'transparent',
                border: `2px solid ${i <= step ? C.frank : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: i <= step ? '#000' : C.dim,
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: i === step ? C.frank : C.dim, fontWeight: i === step ? 700 : 400 }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ width: 28, height: 1, background: i < step ? C.frank : C.border, margin: '0 10px' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step card */}
      <div style={{
        width: '100%', maxWidth: step === 2 ? 900 : 480,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '36px 40px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {step === 0 && <StepAccount form={form} set={set} errors={errors} onNext={handleNext} onBack={onBack} />}
        {step === 1 && <StepBusiness form={form} set={set} errors={errors} onNext={handleNext} onBack={() => setStep(0)} />}
        {step === 2 && <StepPlan form={form} set={set} onNext={handleNext} onBack={() => setStep(1)} />}
        {step === 3 && (
          <StepReady
            form={form} onEnter={handleEnter} consent={consent} setConsent={setConsent}
            submitting={submitting} error={submitError} needsConfirmation={needsConfirmation}
          />
        )}
      </div>
    </div>
  )
}

function StepAccount({ form, set, errors, onNext, onBack }) {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6 }}>Create your account</div>
        <div style={{ fontSize: 13, color: C.sub }}>You'll use these details to sign in to Zeeder</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Full name" error={errors.name}>
          <input type="text" value={form.name} autoFocus placeholder="Jane Smith"
            onChange={e => set('name', e.target.value)}
            style={{ ...baseInput, border: `1px solid ${errors.name ? C.danger : C.border}` }} />
        </Field>
        <Field label="Email address" error={errors.email}>
          <input type="email" value={form.email} placeholder="jane@business.co.za"
            onChange={e => set('email', e.target.value)}
            style={{ ...baseInput, border: `1px solid ${errors.email ? C.danger : C.border}` }} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" value={form.password} placeholder="Min. 6 characters"
            onChange={e => set('password', e.target.value)}
            style={{ ...baseInput, border: `1px solid ${errors.password ? C.danger : C.border}` }} />
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword}>
          <input type="password" value={form.confirmPassword} placeholder="Repeat your password"
            onChange={e => set('confirmPassword', e.target.value)}
            style={{ ...baseInput, border: `1px solid ${errors.confirmPassword ? C.danger : C.border}` }} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
        <button onClick={onBack} style={btnBack}>← Sign in</button>
        <button onClick={onNext} style={btnPrimary}>Continue →</button>
      </div>
    </>
  )
}

function StepBusiness({ form, set, errors, onNext, onBack }) {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6 }}>Tell us about your business</div>
        <div style={{ fontSize: 13, color: C.sub }}>Zeeder uses this to personalise your financial insights</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Business name" error={errors.businessName}>
          <input type="text" value={form.businessName} autoFocus placeholder="Your Business (Pty) Ltd"
            onChange={e => set('businessName', e.target.value)}
            style={{ ...baseInput, border: `1px solid ${errors.businessName ? C.danger : C.border}` }} />
        </Field>
        <Field label="Industry / Sector" error={errors.sector}>
          <select value={form.sector} onChange={e => set('sector', e.target.value)}
            style={{ ...baseInput, border: `1px solid ${errors.sector ? C.danger : C.border}`, appearance: 'none', cursor: 'pointer' }}>
            <option value="">Select your sector…</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="City / Location" error={errors.location}>
          <input type="text" value={form.location} placeholder="Cape Town, Johannesburg…"
            onChange={e => set('location', e.target.value)}
            style={{ ...baseInput, border: `1px solid ${errors.location ? C.danger : C.border}` }} />
        </Field>
        <Field label="Number of staff (optional)">
          <input type="number" min="1" value={form.staff} placeholder="e.g. 8"
            onChange={e => set('staff', e.target.value)}
            style={baseInput} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
        <button onClick={onBack} style={btnBack}>← Back</button>
        <button onClick={onNext} style={btnPrimary}>Continue →</button>
      </div>
    </>
  )
}

function StepPlan({ form, set, onNext, onBack }) {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6 }}>Choose your plan</div>
        <div style={{ fontSize: 13, color: C.sub }}>Start with a 14-day free trial. Cancel any time.</div>
      </div>

      <div role="radiogroup" aria-label="Choose a pack" style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {PLAN_ORDER.map(id => {
          const plan = PLANS[id]
          const active = form.plan === plan.id
          return (
            <button type="button" role="radio" aria-checked={active} key={plan.id} onClick={() => set('plan', plan.id)} style={{
              flex: '1 1 200px', padding: '22px 24px', borderRadius: 8, cursor: 'pointer',
              border: `2px solid ${active ? C.frank : C.border}`,
              background: active ? C.frankMid : C.bg,
              position: 'relative', textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
              transition: 'border-color 0.15s',
            }}>
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  background: C.frank, color: '#000', fontSize: 9, fontWeight: 800,
                  letterSpacing: 1.5, padding: '2px 12px', borderRadius: 10, whiteSpace: 'nowrap', textTransform: 'uppercase',
                }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: `2px solid ${active ? C.frank : C.border}`,
                  background: active ? C.frank : 'transparent',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: active ? C.frank : C.text }}>{plan.name}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: active ? C.frank : C.text, fontFamily: 'var(--mono)', marginBottom: 18 }}>
                {priceText(plan)}<span style={{ fontSize: 12, fontWeight: 400, color: C.sub }}>/mo</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {plan.highlights.map(f => (
                  <div key={f} style={{ fontSize: 12, color: active ? C.frank : C.sub, display: 'flex', gap: 8 }}>
                    <span aria-hidden="true" style={{ color: active ? C.frank : C.dim, flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ padding: '12px 14px', background: `${C.frank}06`, border: `1px solid ${C.frank}15`, borderRadius: 6, fontSize: 12, color: C.sub, marginBottom: 24 }}>
        14-day free trial included. No credit card required.
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={btnBack}>← Back</button>
        <button onClick={onNext} style={btnPrimary}>Create my account →</button>
      </div>
    </>
  )
}

function StepReady({ form, onEnter, consent, setConsent, submitting, error, needsConfirmation }) {
  const plan = PLANS[form.plan]
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, color: C.frank, marginBottom: 16, lineHeight: 1 }}>✦</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.frank, marginBottom: 10 }}>
          {form.businessName} is ready!
        </div>
        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7 }}>
          Review your details, then create your Zeeder Finance OS workspace.<br />
          Your 14-day free trial starts now.
        </div>
      </div>

      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 22px', marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Account summary</div>
        {[
          ['Business', form.businessName],
          ['Sector', form.sector],
          ['Location', form.location],
          ['Plan', `${plan?.name} · ${priceText(plan)}/mo (14-day trial)`],
          ['Email', form.email],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <span style={{ color: C.dim }}>{label}</span>
            <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 18px', background: `${C.frank}06`, border: `1px solid ${C.frank}15`, borderRadius: 8, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.dim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Your first steps</div>
        {[
          ['↑', 'Upload a bank statement to populate your dashboard'],
          ['⊟', 'Add your outstanding debtors'],
          ['⊞', 'Add your supplier bills to track creditors'],
          ['◉', 'Ask Zeeder anything about your finances'],
        ].map(([icon, text]) => (
          <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: C.sub }}>
            <span style={{ color: C.frank, flexShrink: 0 }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          fontSize: 13, color: C.danger, background: `${C.danger}10`,
          border: `1px solid ${C.danger}33`, borderRadius: 6,
          padding: '10px 14px', marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {needsConfirmation ? (
        <div style={{
          fontSize: 14, color: C.frank, background: `${C.frank}10`,
          border: `1px solid ${C.frank}33`, borderRadius: 8,
          padding: '16px 18px', textAlign: 'center', lineHeight: 1.6,
        }}>
          Almost there — we've sent a confirmation link to <strong>{form.email}</strong>.<br />
          Click it, then sign in to enter your dashboard.
        </div>
      ) : (
        <>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0, accentColor: C.frank }} />
            <span>
              I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.frank }}>terms of use</a> and
              {' '}the <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.frank }}>privacy notice</a>, and I
              {' '}consent to {LEGAL.company} processing my information, including by AI, as described there.
            </span>
          </label>
          <button onClick={onEnter} disabled={submitting || !consent}
            style={{
              ...btnPrimary, width: '100%', padding: '15px', fontSize: 15,
              opacity: submitting || !consent ? 0.5 : 1, cursor: submitting || !consent ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Creating your workspace…' : 'Enter my dashboard →'}
          </button>
        </>
      )}
    </>
  )
}
