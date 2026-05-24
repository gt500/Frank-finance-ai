# Frank — Test Cases

Use these to verify the skill behaves correctly. Each test has:
- **Input**: What the user says
- **Expected behaviour**: What Frank must do
- **Pass criteria**: What a correct response must contain
- **Fail criteria**: What makes the response wrong

---

## Test Suite 1: Core Metric Queries

### T1 — Available Cash (basic)
**Input**: "How much cash do I have?"
**Expected**: Fetch all bank balances, sum them, break down by account
**Pass if**:
  - Shows total figure
  - Shows per-account breakdown
  - Shows data freshness timestamp
  - Ends with one next action
**Fail if**:
  - Gives a made-up number without fetching
  - No breakdown
  - No timestamp
  - Missing unconnected account warning (if applicable)

---

### T2 — Runway Query
**Input**: "What's my runway?"
**Expected**: Calculate runway = cash / burn rate. Show months + date.
**Pass if**:
  - States runway in months (e.g. "3.2 months")
  - States the zero-cash date
  - Shows conservative scenario if runway < 6 months
  - One clear next action to extend runway
**Fail if**:
  - No date given
  - No scenario modelling
  - Runway stated without showing cash + burn inputs

---

### T3 — Burn Rate
**Input**: "What's my monthly burn?"
**Expected**: Pull 90-day outflows, calculate avg monthly, break by category
**Pass if**:
  - States monthly burn figure
  - Shows Payroll / COGS / Overheads / Other breakdown
  - Shows percentages
  - Uses 90-day default window
**Fail if**:
  - No breakdown
  - Uses only 30-day window without being asked
  - Includes capital expenditure in burn

---

### T4 — AR Overview
**Input**: "Who owes me money?"
**Expected**: Pull open invoices, bucket by overdue/due-soon/current
**Pass if**:
  - Shows total AR figure
  - 🔴/🟡/🟢 buckets present
  - Individual invoices listed with client + due date + days overdue
  - Sorted by most overdue first
**Fail if**:
  - No ageing buckets
  - No per-invoice detail
  - Doesn't flag invoices > 30% of total

---

### T5 — AP Overview
**Input**: "What bills do I need to pay?"
**Expected**: Pull outstanding bills, bucket by urgency
**Pass if**:
  - Shows total AP
  - Shows what's due today / this week
  - Lists specific suppliers with amounts
**Fail if**:
  - No urgency bucketing
  - Missing due-today items

---

### T6 — Sales Performance
**Input**: "How are sales this month?"
**Expected**: Pull revenue from accounting system for current month
**Pass if**:
  - States this month's revenue
  - Shows % change vs last month
  - Shows trend arrow ↑ ↓ →
  - Breaks down by product/service if categories exist
**Fail if**:
  - No period comparison
  - No trend indicator
  - Includes unpaid invoices in revenue figure

---

## Test Suite 2: What-If Scenarios

### T7 — Hire Scenario
**Input**: "What if I hired a developer at R 40,000/month?"
**Expected**: Add R 40k to monthly burn, recalculate runway
**Pass if**:
  - Shows current burn → new burn → delta
  - Shows current runway → new runway
  - States clearly "you can / cannot afford this now"
**Fail if**:
  - Only shows the delta without full context
  - No runway impact shown

---

### T8 — Revenue Scenario
**Input**: "What if I landed a client worth R 150k/month?"
**Expected**: Add R 150k/month to revenue, recalculate net burn and runway
**Pass if**:
  - Shows new net burn
  - Shows new runway
  - Notes when you'd reach cash-positive (if not already)
**Fail if**:
  - No net burn calculation
  - Confuses gross revenue with net impact

---

### T9 — Affordability Check
**Input**: "Can I afford to upgrade our office space for R 25,000/month more?"
**Expected**: Model new burn + runway impact + give a clear yes/no/conditional
**Pass if**:
  - Clear recommendation with reasoning
  - Shows runway before and after
  - Offers alternative if answer is "not now"
**Fail if**:
  - Gives a vague "it depends" without modelling the numbers
  - No runway comparison

---

## Test Suite 3: Edge Cases

### T10 — Stale Data
**Input**: "Show me my cash" (when last bank sync was 6 hours ago)
**Expected**: Show data with stale warning
**Pass if**:
  - ⚠️ Data staleness warning shown
  - Shows time of last sync
  - Still shows data (don't withhold)
  - Offers to trigger resync
**Fail if**:
  - No warning shown
  - Refuses to show data at all

---

### T11 — Unconnected Account
**Input**: "How much cash do I have?" (user has a bank not yet connected)
**Expected**: Sum connected accounts, flag unconnected one
**Pass if**:
  - Shows total of connected accounts
  - Lists unconnected account with ⚠️
  - Explains what to do to connect it
**Fail if**:
  - Pretends unconnected account doesn't exist
  - Refuses to answer until all accounts are connected

---

### T12 — Payment Request (Security Rule)
**Input**: "Pay the Afrox invoice for me"
**Expected**: Explain Frank's role, provide payment details, direct to banking app
**Pass if**:
  - Does NOT claim to transfer money
  - Shows invoice details + banking info
  - Directs user to banking app to authorise
  - Offers to track it once paid
**Fail if**:
  - Claims it can make payments
  - Asks for banking credentials

---

### T13 — Phase 2/3 Feature Request
**Input**: "Can you automatically categorise my expenses?"
**Expected**: Explain Phase 2 roadmap, offer Phase 1 alternative
**Pass if**:
  - Tells user this is coming in Phase 2
  - Gives rough timeline
  - Offers current best alternative (manual review list)
**Fail if**:
  - Claims it can already do this
  - Just says "not available" with no context or alternative

---

### T14 — Cash-Positive Business
**Input**: "What's my runway?" (when revenue > burn)
**Expected**: Tell user they are cash-positive, don't calculate "months to zero"
**Pass if**:
  - Detects net burn is negative (profitable)
  - Says "You are cash-positive" clearly
  - Shows net monthly surplus
  - Still shows cash balance for context
**Fail if**:
  - Tries to calculate runway when business is profitable
  - Shows confusing negative runway number

---

## Test Suite 4: Full Dashboard

### T15 — Full Briefing
**Input**: "Give me a financial briefing" or "Show me my finances"
**Expected**: All 5 metrics in one response, concise
**Pass if**:
  - All 5 metrics present (Cash, Sales, AR, AP, Burn/Runway)
  - Each has a figure + plain-English sentence
  - Single most important next action at end
  - Total response is scannable in under 60 seconds
**Fail if**:
  - Any metric missing
  - Response is a wall of text without structure
  - Multiple "next actions" (should be one)

---

## Grading Rubric

Each test is scored 0–3:

| Score | Meaning |
|---|---|
| 3 | All pass criteria met, no fail criteria triggered |
| 2 | Most pass criteria met, minor issue |
| 1 | Core answer present but missing key element |
| 0 | Fail criteria triggered OR no live data fetched |

**Target**: Average ≥ 2.5 across all tests before shipping.
**Mandatory 3s**: T1, T2, T12 (cash, runway, security rule — non-negotiable).

---

## Test Suite 5: SA Market & Product

### T16 — VAT Awareness
**Input**: "What were my sales this month?" (user is VAT-registered)
**Expected**: Clarify or show both VAT-inclusive and VAT-exclusive figures
**Pass if**:
  - Distinguishes VAT-incl vs VAT-excl
  - Does not mix the two in the same total
**Fail if**:
  - Shows a single revenue figure with no VAT note

---

### T17 — SARS Deadline Flag
**Input**: "Anything I need to worry about financially?" (provisional tax due in 2 weeks)
**Expected**: Flag SARS deadline as Priority
**Pass if**:
  - SARS deadline surfaced prominently
  - Shows estimated provisional tax amount if available
  - Recommends contacting tax practitioner
**Fail if**:
  - SARS deadline buried or missing
  - Frank claims to file the tax

---

### T18 — Onboarding (No Data Connected)
**Input**: "Show me my cash position" (no bank connected yet)
**Expected**: Guide user through connecting their bank — don't show zero or error
**Pass if**:
  - Explains data isn't connected yet
  - Offers clear step to connect SA bank
  - Lists supported SA banks
**Fail if**:
  - Shows R 0 as if that's the real balance
  - Just says "no data available" with no path forward

---

### T19 — Product Explanation
**Input**: "What does Frank do exactly?"
**Expected**: Clear, honest product description using approved language
**Pass if**:
  - Explains real-time financial co-pilot concept
  - Mentions bank + accounting integration
  - States what Frank does NOT do (taxes, payments)
  - Mentions SA focus
**Fail if**:
  - Claims Frank files taxes
  - Claims Frank can make payments
  - No mention of what Frank doesn't do

---

### T20 — Late Payment Culture (SA AR)
**Input**: "My invoice is 60 days overdue — is that normal?"
**Expected**: Contextualise SA payment norms, then give Frank's chase strategy
**Pass if**:
  - Acknowledges 60–90 day late payment is common in SA
  - Does not normalise it as acceptable
  - Provides a concrete follow-up action
**Fail if**:
  - Says "that's fine, it's normal" without action
  - Gives generic advice with no SA context

---

## Test Suite 6: Lead Qualification

### T21 — Hot Lead Qualification
**Input**: "Hi, I run a plumbing business, about R 2m turnover. My bookkeeper costs me
R 4,000/month and I still have no idea what my cash position is day-to-day."
**Expected**: Score high (12+), route to demo/trial immediately
**Pass if**:
  - Recognises service business + R 2m revenue + bookkeeper pain = hot lead
  - Produces Lead Summary Card with score
  - Offers to connect bank account right now
  - Does NOT ask all 5 questions when answers are already in the message
**Fail if**:
  - Asks questions already answered
  - Routes to warm/borderline despite strong signals
  - Skips the Lead Summary Card

---

### T22 — Disqualification (Not a Fit)
**Input**: "I run a small spaza shop, we do maybe R 200k a year in sales."
**Expected**: Honest, kind disqualification — Frank is not right for them yet
**Pass if**:
  - Does NOT try to sell Frank to them
  - Explains Frank is better suited once they're growing
  - Suggests a free/cheaper alternative (e.g. Wave)
  - Leaves door open for when they scale
**Fail if**:
  - Tries to push them onto Starter plan
  - Gives generic "Frank helps all businesses" response

---

### T23 — Objection: Accountant Already Does This
**Input**: "My accountant handles all of this for me, I don't really look at the numbers."
**Expected**: Handle the objection, reframe Frank's value vs accountant
**Pass if**:
  - Does NOT say Frank replaces the accountant
  - Explains the daily vs monthly gap
  - Mentions accountant will benefit from cleaner data
  - Asks a follow-up to find the real pain
**Fail if**:
  - Backs off entirely ("sounds like you don't need Frank then")
  - Claims Frank does what an accountant does
