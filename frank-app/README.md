# Zeeder Finance OS

Cash, debtors, creditors, invoices and financial statements for South African small businesses. Live at https://zeederfinanceos.com.

Clients upload a bank statement (CSV, Excel or PDF). There are no live bank feeds. Zeeder reads it, shows the cash position and what to do next, and answers questions with AI.

## Packs

Defined once in `src/lib/plans.js` (shared with the edge functions through `supabase/functions/_shared/packs.js`).

| Pack | Price a month | For |
|---|---|---|
| Starter | R499 | Know your cash: dashboard, forecast, statement upload, debtors and creditors, 60 AI requests |
| Growth | R999 | Bill and get paid: invoices, quotes, customer statements, reconciliation, income statement, 340 AI requests |
| Pro | R1 999 | Books ready for the accountant: all statements, automatic bank posting, depreciation, stock, tax estimate, 1 100 AI requests |

New workspaces get a 14-day trial on the pack chosen at sign-up. Workspaces opened before 16 Nov 2026 keep full access until they subscribe. The screens are gated in the app, and the AI allowance is enforced on the server (`_shared/entitlement.ts`).

## Stack

Vite + React 18 (JSX) · Supabase (Postgres with row-level security, Auth, Vault, Edge Functions) · Vercel (hosting) · Anthropic Claude (through edge functions) · PayGate PayHost (subscriptions) · Resend (our own billing alerts).

Client invoices are sent from the client's own mailbox over SMTP, not through Resend.

## Run it

```bash
cp .env.example .env     # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:3000
npm test                 # Vitest
npm run lint
npm run build
deno test -A --node-modules-dir=none supabase/functions   # edge function tests
```

CI (`.github/workflows/ci.yml`) runs lint, tests, build and the function tests on every pull request.

## Layout

```
src/pages/        Landing, Login, Onboarding, ResetPassword, Legal (/privacy, /terms), BillingReturn
src/components/   Sidebar, PlanGate (pack gating), views/, statements/, bank/, invoices
src/context/      TenantContext: sign-in, workspace, subscription and pack
src/lib/          plans, ledgerApi, statements, bankPosting, invoicing, seo, upgrade
supabase/
  migrations/     run in order, by hand in the Supabase SQL editor (see below)
  functions/      edge functions and _shared helpers
public/           robots.txt, sitemap.xml, favicon, social preview image
```

## Database

Migrations are applied by hand, in filename order, in the Supabase SQL editor of project `ffmlvksocucfidaclzih`. Do not run `supabase db push`: older migrations were applied by hand and are not in the migration history.

The newest is `20261116a_packs_and_database_tidy.sql` (Pro at sign-up, foreign-key indexes, faster row-level-security policies). Run it before the landing page's Pro pack goes live.

## Edge functions

`chat-message` and `extract-document` (Claude), `send-document` and `mailbox` (invoices from the client's mailbox), `paygate-initiate`, `paygate-charge`, `paygate-notify`, `paygate-status`, `paygate-cancel` (billing), `delete-account`, `wonderland-proxy`, `simplepay-proxy`.

Deploy with `supabase functions deploy <names> --project-ref ffmlvksocucfidaclzih`. Gateway auth is pinned in `supabase/config.toml`.

Secrets (names only): `ANTHROPIC_API_KEY`, `PAYGATE_3DS_ID`, `PAYGATE_3DS_KEY`, `PAYGATE_MOTO_ID`, `PAYGATE_MOTO_KEY`, `APP_URL`, `RESEND_API_KEY`, `BILLING_FROM_EMAIL`, `ALERT_EMAIL`, `WONDERLAND_API_KEY`. PayHost uses one URL: whether it is test or live depends on the PayGate IDs.

## Deploying

Vercel builds every push. `master` is production. Never commit secrets: `.env` is ignored.

## Legal

The privacy notice and terms are in `src/pages/legalContent.js`. Fill in the company registration number, address and Information Officer there once confirmed. Sign-up needs an explicit tick, and the time and version of that consent are stored with the account.
