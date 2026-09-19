# Frank — Operational Finance AI

Real-time financial co-pilot for South African small businesses. Built on React + Vite, powered by Claude AI.

## What it does

Frank connects to your bank feeds, reads uploaded documents (PDF/CSV/Excel), and answers financial questions in plain English. No accounting software required.

**Current demo:** Wonderland Educare — an early childhood development centre in Brackenfell, Cape Town.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/frank-finance-ai.git
cd frank-finance-ai
npm install
```

### 2. Configure Supabase and set secrets

```bash
cp .env.example .env
```

Open `.env` and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (the anon
key is safe to expose — it's protected by RLS, not the secret itself).

The Anthropic key is **not** an env var anymore — Claude is called through
`chat-message` and `extract-document` Supabase edge functions so the key
never reaches the browser. Set it once with:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy chat-message extract-document
```

Get your key at: https://console.anthropic.com

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000

---

## Project Structure

```
frank-app/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx          ← Navigation
│   │   ├── shared/              ← Reusable UI (Card, Badge, StatBox, etc.)
│   │   └── views/
│   │       ├── Dashboard.jsx    ← 5 core metrics overview
│   │       ├── CashFlow.jsx     ← 13-week forecast + issue flags
│   │       ├── Reports.jsx      ← Charts: revenue, expenses, margin
│   │       ├── Health.jsx       ← Business health score + actions
│   │       ├── Documents.jsx    ← PDF/CSV/Excel upload + AI extraction ✅ BUILT
│   │       ├── Debtors.jsx      ← AR aging
│   │       ├── Creditors.jsx    ← AP management
│   │       ├── Connections.jsx  ← Bank feeds + Sage integration
│   │       └── Chat.jsx         ← Ask Frank (AI chat) ✅ BUILT
│   ├── data/
│   │   └── wonderland.js        ← Demo data + AI system prompt
│   ├── hooks/
│   │   └── useFrank.js          ← Claude API hook + PDF extraction
│   ├── lib/
│   │   └── theme.js             ← Colours + format helpers
│   └── styles/
│       └── index.css            ← Global styles + animations
└── frank-financial-ai/          ← Skill files (AI instructions)
    ├── SKILL.md
    ├── references/
    │   ├── metrics.md
    │   ├── integrations.md      ← Upload tiers + PDF extraction docs
    │   ├── sa-market-context.md
    │   └── lead-qualification.md
    └── tests/
        └── test-cases.md
```

---

## Views — Build Status

| View | Status | Notes |
|---|---|---|
| Chat | ✅ Built | Full AI chat with Wonderland context |
| Documents | ✅ Built | PDF/CSV/Excel upload with real AI extraction |
| Dashboard | 🔧 Stub | See `src/data/wonderland.js` for all data |
| Cash Flow | 🔧 Stub | 13-week forecast data ready in `wonderland.js` |
| Reports | 🔧 Stub | Monthly data + expense breakdown ready |
| Health | 🔧 Stub | `HEALTH_CHECKS` + `CASHFLOW_FLAGS` data ready |
| Debtors | 🔧 Stub | `DEBTORS` array ready in `wonderland.js` |
| Creditors | 🔧 Stub | `CREDITORS` array ready in `wonderland.js` |
| Connections | 🔧 Stub | Bank connectors + Sage integration |

All stub views have the data ready — they just need the chart/UI components wired up.

---

## Document Upload

Frank reads:

**Debtors (AR):**
- Age analysis PDF (Sage/Xero/QB export)
- Individual customer invoices (PDF)
- Customer statements (PDF)
- Debtor list (Excel/CSV — any layout)
- Photos of invoices (JPG/PNG)

**Creditors (AP):**
- Supplier invoices (PDF)
- Supplier statements (PDF)
- Creditor age analysis (PDF/Excel)
- Individual bills (PDF/photo)

**Bank:**
- Standard Bank CSV
- Absa/FNB/Nedbank/Capitec CSV
- Any SA bank PDF statement

---

## Data Tiers

Frank works without accounting software:

| Tier | What you upload | What Frank gives you |
|---|---|---|
| 1 | Bank statement (CSV/PDF) | Cash, burn rate, transaction categories |
| 2 | Bank + debtor/creditor lists | Full AR/AP aging + cashflow forecast |
| 3 | Live bank feed (Stitch Money) | Real-time balance, auto-sync |
| 4 | Bank + Sage/Xero/QB | Everything + P&L + job margins |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Charts | Recharts |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Routing | React Router v6 |
| Styles | CSS variables + inline styles |
| Icons | Lucide React |

### Production Stack (when scaling to hundreds of customers)

| Layer | Recommended |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL + RLS for multi-tenancy) |
| Auth | Supabase Auth (POPIA-compliant) |
| Bank feeds | Stitch Money (SA) + Plaid (US/CA) |
| Accounting | Sage API + Xero API |
| Cache | Upstash Redis |
| Hosting | Vercel (frontend) + Railway (backend) |
| Payments | PayFast (SA) or Stripe |
| AI | Anthropic Claude API (server-side proxy) |

---

## Push to GitHub

```bash
# In the frank-app directory
git init
git add .
git commit -m "Initial commit — Frank Finance AI"

# Create repo on GitHub then:
git remote add origin https://github.com/YOUR_USERNAME/frank-finance-ai.git
git branch -M main
git push -u origin main
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `VITE_DEMO_MODE` | No | `true` = use Wonderland demo data |
| `VITE_ENABLE_BANK_FEEDS` | No | `true` when Stitch Money configured |
| `VITE_ENABLE_SAGE_INTEGRATION` | No | `true` when Sage API configured |

> ⚠️ **Security note:** In production, never expose the API key to the browser. Add a backend proxy endpoint and call that instead. See `docs/DEPLOYMENT.md` (coming soon).

---

## Skill Files

The `/frank-financial-ai/` folder contains the AI skill documentation:

- **SKILL.md** — triggers, rules, and response format for Frank AI
- **references/metrics.md** — exact formulas for all 5 core metrics
- **references/integrations.md** — data tiers, PDF extraction, SA bank formats
- **references/sa-market-context.md** — SA market, pricing, SARS/VAT, WCED
- **references/lead-qualification.md** — sales qualification flow + objection handling
- **tests/test-cases.md** — 23 test cases with pass/fail criteria

---

## Roadmap

- **Phase 1 (now):** Frank (finance AI) + Zeeder (lead management)
- **Phase 2:** Cost escalation alerts, funding readiness score, invoice finance integration
- **Phase 3:** Loop (client comms) + Pulse (SA sector benchmarking)

Built for South Africa. POPIA compliant. ZAR native.
