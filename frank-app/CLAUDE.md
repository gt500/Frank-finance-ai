# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity
- **Project:** Zeeder Finance OS (a.k.a. Frank)
- **Purpose:** Real-time operational finance AI for South African small businesses — bank reconciliation, debtors/creditors, cash flow, and AI-powered business health
- **Stack:** Vite + React 18 JSX (no TypeScript) · Direct Anthropic API (called from the browser) · SheetJS · Recharts · React Router v6
- **Primary Language:** JavaScript (JSX)
- **Working directory:** the app lives in `frank-app/` — run all commands below from there
- **Key Directories:**
  - `src/components/views/` — 10 feature views (Dashboard, CashFlow, Debtors, Creditors, Documents, Health, Reports, Reconciliation, Connections, Chat)
  - `src/pages/` — pre-auth flow (Landing, Login, Onboarding)
  - `src/context/TenantContext.jsx` — single source of truth: auth, tenant data, bank data, imported spreadsheet data
  - `src/hooks/useFrank.js` — Anthropic API: chat (`claude-sonnet-4-6`) + document extraction `extractFromDocument()` (`claude-haiku-4-5-20251001`)
  - `src/hooks/useWonderlandData.js` — live data hook, **Wonderland-only** (gated by `tenant.id === 'wonderland-educare'` in `App.jsx`; other tenants get `null`)
  - `src/hooks/useSimplePayData.js` — payroll via the `simplepay-proxy` edge function, any workspace that connected a key in Connections
  - `src/data/tenants.js` — tenant definitions (Wonderland Educare real client + Cape Fresh demo)
  - `src/lib/theme.js` — brand CI constants (C.frank teal, C.gold, C.bg pure black, FONT_BODY Century Gothic, FONT_SUB Bruno Ace)
  - `src/test/` — Vitest test setup (mocks `FileReader` globally for document-extraction tests)
  - `.claude/skills/` — project skill files

## Commands
All run from `frank-app/`:
- `npm run dev` — start Vite dev server on port 3000 (no proxies: Anthropic, Wonderland and SimplePay all go through Supabase edge functions)
- `npm run build` — production build (`vite build`)
- `npm test` — run the full Vitest suite once
- `npm run test:watch` — Vitest watch mode
- `npx vitest run src/hooks/useFrank.test.js` — run a single test file
- `npm run lint` — ESLint over `src` (`.jsx`/`.js`)

## Auth Flow
`App.jsx` renders `TenantProvider` → `AppContent` → `AppShell` (keyed per user, so nothing carries over between accounts). Unauthenticated (`!currentUser`) shows `Login` or `Onboarding` (`pages/`); `registerAccount()` calls Supabase `signUp`, and the `handle_new_user` DB trigger creates the profile + `tenants` row with zeroed starter data. Saves go through `src/lib/saveQueue.js` (ordered, retried). Authenticated users see the `Sidebar` + routed view (`view` state, no React Router route change — `VIEW_LABELS` in `App.jsx` maps view keys to titles).

---

## Architecture Rules

### Multi-Tenant
- Every data access goes through `useTenant()` — never import from `tenants.js` directly in views
- `mergedData` in TenantContext overlays imported spreadsheet data over static tenant data
- Auth is Supabase Auth only; one workspace per account (no admin PIN, no tenant switching) · workspace data lives in the `tenant_data` table, never localStorage
- localStorage: the old `zeeder_*` data keys are purged on login (legacy cross-tenant leak). The only key written is `zeeder_last_view_${userId}` (a view name, no data)

### Data Priority (Debtors & Creditors)
Bank statement confirmed → imported spreadsheet → static tenant data

### File Upload / AI Extraction
- CSV/text → send as plain text to Claude API
- Images → send as base64 image block
- Excel (.xlsx/.xls/.ods) → parse with SheetJS → send as CSV text (**never** send as PDF)
- PDF/Word → send as base64 document block with `media_type: 'application/pdf'`

---

## Brand CI (always enforce)
| Token | Value |
|---|---|
| `C.bg` | `#000000` pure black |
| `C.frank` | `#20e5f6` teal |
| `C.gold` | `#c1b081` gold |
| `C.card` | dark card bg |
| `FONT_BODY` | Century Gothic |
| `FONT_SUB` | Bruno Ace |

Never hardcode hex colours — use theme constants from `src/lib/theme.js`.

---

# Karpathy Behavioural Rules

## 1. Think Before Coding
- State ALL assumptions explicitly before any non-trivial implementation
- When a prompt is ambiguous, list interpretations and ask which to use
- Push back if a simpler path exists before writing a single line
- Never guess and proceed — stop and ask when unclear

## 2. Simplicity First
- Write minimum code that solves the stated problem
- No abstractions unless used in 2+ places
- No speculative features or extra configurability unless asked

## 3. Surgical Changes
- Every changed line traces back to a specific part of the request
- Do not improve adjacent code or rename things unless asked
- Match existing project style throughout

## 4. Goal-Driven Execution
- Before any multi-step task: state verifiable success criteria
- Loop until all criteria are met — do not stop at "looks right"

## 5. Verification Protocol
- After any significant task: run `npm test` (51 tests must pass) and `npx vite build`
- Flag uncertainties before proceeding to the next step

---

## Guardrails

### Always Do
- Run `npm test` after editing `useFrank.js`, `TenantContext.jsx`, or `extractFromDocument`
- Use theme constants — never hardcode colours or fonts

### Ask First
- Deleting any file
- Changes to `.env` or credentials
- Changes touching more than 3 files at once

### Never Do
- Add `media_type: 'application/pdf'` for Excel files
- Return cross-tenant data
- Import tenant data directly in views (use `useTenant()`)
- Push directly to main
- Hardcode any password, PIN, or credential in source — use `import.meta.env.VITE_*`
- Write private account credentials to localStorage — validate against env vars at login time only

---

## Session Discipline
- Default to smallest possible scope per session
- After each deliverable: report what was done, wait for review
- When context grows long: summarise and commit before starting fresh
