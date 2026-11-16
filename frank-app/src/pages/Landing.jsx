import { useEffect } from 'react'
import { PublicShell } from './PublicShell'
import { PLANS, PLAN_ORDER, priceText } from '../lib/plans'
import { setPageMeta } from '../lib/seo'

export const PAGE_TITLE = 'Zeeder Finance OS | Cash, invoices and books for South African small business'
export const PAGE_DESCRIPTION = 'Upload your bank statement and see your cash, who owes you and what to do next. Invoices, quotes and financial statements for South African small businesses. 14-day free trial.'

const STEPS = [
  ['Upload your bank statement', 'Drop in a CSV, Excel or PDF statement from FNB, Standard Bank, Nedbank, Absa or Capitec.'],
  ['Zeeder reads it for you', 'Money in, money out, who owes you and what you owe are sorted in seconds.'],
  ['See what to do next', 'Your cash position, the weeks that run tight and a short list of actions, in plain English.'],
]

const FEATURES = [
  ['Cash you can trust', 'Your balance, money in and out, and a month-by-month view, all from your own statements.'],
  ['13-week cash forecast', 'See which weeks run tight before they happen, with a safety buffer to plan around.'],
  ['Debtors and creditors', 'Who owes you, whom you owe, and what is overdue, in one place.'],
  ['Invoices and quotes', 'Send them from your own mailbox, track payments, and send customers a statement.', 'Growth and Pro'],
  ['Financial statements', 'Income statement, balance sheet, cash flows and trial balance, ready for your accountant.', 'Pro'],
  ['Ask Zeeder AI', 'Ask a question in plain English and get an answer from your own numbers.'],
]

const FAQ = [
  ['Does Zeeder connect to my bank?', 'No. You upload your bank statement as a CSV, Excel or PDF file. It takes a minute, works with all five major South African banks, and your bank login never leaves you.'],
  ['Is this accounting software?', 'It does the day-to-day work that owners need: cash, debtors, creditors and invoices. The Pro pack adds full financial statements and keeps your books up to date for your accountant.'],
  ['Is my information safe?', 'Each business is kept separate from every other. Everything is encrypted in transit, and we never see or store your card number. You can delete your account and data at any time.'],
  ['Can I cancel?', 'Yes, at any time. Cancelling stops future charges and you keep access until the end of the period you have paid for.'],
]

export function Landing({ onStart, onSignIn }) {
  useEffect(() => { setPageMeta({ title: PAGE_TITLE, description: PAGE_DESCRIPTION, path: '/' }) }, [])

  return (
    <PublicShell onSignIn={onSignIn} onStart={onStart}>
      <div className="pub-wrap">
        <section className="pub-hero" aria-labelledby="hero-title">
          <div>
            <div className="pub-eyebrow"><i aria-hidden="true" />Finance operating system for small business</div>
            <h1 id="hero-title" className="pub-h1">Know your cash. <em>Get paid faster.</em> Keep your books ready.</h1>
            <p className="pub-sub">Upload your bank statement and Zeeder shows your cash position, who owes you, what you owe and what to do next, in plain English.</p>
            <div className="pub-cta">
              <button type="button" className="pub-btn pub-btn-primary" onClick={() => onStart()}>Start free trial</button>
              <a className="pub-btn pub-btn-outline pub-btn-link" href="#pricing">See pricing</a>
            </div>
            <p className="pub-trust">14-day free trial. No credit card needed. Cancel any time.</p>
          </div>

          <aside className="pub-example" aria-label="Example dashboard">
            <div className="pub-example-top"><span>Cash position</span><span className="pub-example-badge">Example</span></div>
            <div className="pub-example-balance">R&nbsp;61&nbsp;400</div>
            <dl>
              <div><dt>Owed to you</dt><dd className="good">R&nbsp;34&nbsp;200</dd></div>
              <div><dt>Bills due this week</dt><dd className="warn">R&nbsp;18&nbsp;500</dd></div>
              <div><dt>Wages in 8 days</dt><dd>R&nbsp;94&nbsp;500</dd></div>
            </dl>
            <p className="pub-example-note">Collect 2 overdue invoices before the 25th to cover wages.</p>
            <p className="pub-example-foot">Example figures for illustration. Yours come from your own statements.</p>
          </aside>
        </section>
      </div>

      <div className="pub-wrap">
        <section className="pub-section" aria-labelledby="how-title">
          <div className="pub-label">How it works</div>
          <h2 id="how-title" className="pub-h2">From a statement to a decision in three steps</h2>
          <ol className="pub-steps">
            {STEPS.map(([title, text]) => <li key={title} className="pub-card"><h3>{title}</h3><p>{text}</p></li>)}
          </ol>
        </section>

        <section className="pub-section" aria-labelledby="features-title">
          <div className="pub-label">What you get</div>
          <h2 id="features-title" className="pub-h2">Built for owners, not accountants</h2>
          <p className="pub-lead">Every screen answers one question: what do I need to know to run the business today?</p>
          <ul className="pub-features">
            {FEATURES.map(([title, text, tag]) => (
              <li key={title} className="pub-card"><h3>{title}</h3><p>{text}</p>{tag && <span className="pub-tag">{tag}</span>}</li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="pub-section" aria-labelledby="pricing-title">
          <div className="pub-label">Pricing</div>
          <h2 id="pricing-title" className="pub-h2">Pick the pack that fits your business</h2>
          <p className="pub-lead">Every pack includes a 14-day free trial. No credit card needed to start.</p>
          <div className="pub-plans">
            {PLAN_ORDER.map((id) => {
              const p = PLANS[id]
              return (
                <article key={id} className={`pub-plan${p.badge ? ' featured' : ''}`} aria-labelledby={`plan-${id}`}>
                  {p.badge && <div className="pub-plan-badge">{p.badge}</div>}
                  <h3 id={`plan-${id}`}>{p.name}</h3>
                  <div className="pub-plan-tag">{p.tagline}</div>
                  <div className="pub-plan-price">{priceText(p)}<small> a month</small></div>
                  <p className="pub-plan-sum">{p.summary}</p>
                  {p.groups.map(([heading, items]) => (
                    <div key={heading}>
                      <h4>{heading}</h4>
                      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
                    </div>
                  ))}
                  <div className="pub-plan-cta">
                    <button type="button" className={`pub-btn ${p.badge ? 'pub-btn-primary' : 'pub-btn-outline'}`} onClick={() => onStart(id)}>
                      Start {p.name} free trial
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <p className="pub-plans-note">Prices are in rand a month. Where VAT applies it is shown on your invoice.</p>
        </section>

        <section className="pub-section" aria-labelledby="faq-title">
          <div className="pub-label">Questions</div>
          <h2 id="faq-title" className="pub-h2">Before you start</h2>
          <div className="pub-faq">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>
      </div>
    </PublicShell>
  )
}
