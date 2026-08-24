# Karpathy Master CLAUDE.md
# Drop into the ROOT of any project. Claude reads this automatically at session start.
# Customise the [BRACKETS] sections per project.

---

# Project Identity
- **Project:** [PROJECT NAME — e.g. Zeeder CRM / Gaz2go OVG / Social Synapse]
- **Purpose:** [ONE LINE — e.g. Lead management and CRM for automotive dealerships]
- **Stack:** [e.g. Next.js / FastAPI / Supabase / Vercel]
- **Primary Language:** [TypeScript / Python]
- **Key Directories:**
  - `src/` — application source
  - `tests/` — test suites
  - `.claude/skills/` — Karpathy skill files
  - `wiki/` — LLM Knowledge Wiki (Claude-maintained)
  - `raw/` — raw source documents (read-only to Claude)

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
- If 50 lines solves it, do not write 200

## 3. Surgical Changes
- Every changed line traces back to a specific part of the request
- Do not improve adjacent code or rename things unless asked
- Match existing project style throughout
- Mention dead code — do not silently delete it

## 4. Goal-Driven Execution
- Before any multi-step task: state verifiable success criteria
- WRONG: "Fix the bug"   RIGHT: "Write a failing test, then make it pass"
- Format: [step] -> verify: [check command or condition]
- Loop until all criteria are met. Do not stop at "looks right"

## 5. Verification Protocol
- After any significant task: run the defined check and report results
- Flag uncertainties before proceeding to the next step
- If verification fails: state what failed, hypothesis, and proposed fix

---

# Guardrails

## Always Do
- Run linter after any file change
- Write a basic test for any new function or endpoint

## Ask First
- Deleting any file
- Database schema migrations
- Changes to .env or credentials files
- Changes touching more than 3 files at once

## Never Do
- Modify /secrets, /credentials, or .env.production
- Push directly to main or production branch
- Make live API calls with real credentials in dev/test context

---

# Multi-Tenant Context
- All queries MUST be scoped to tenant_id
- Never return cross-tenant data under any circumstances
- New features must include a tenant isolation test before merge

---

# Session Discipline
- Default to smallest possible scope per session
- After each deliverable: pause, report what was done, wait for review
- When context grows long (50+ messages): summarise, commit, start fresh session
