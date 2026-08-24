# SaaS Code Audit Skill — SKILL.md
# Inspired by Andrej Karpathy, Sabrina Ramonov, Nate Herk & Austin Marchese
# Stack: Next.js · FastAPI · Supabase · Vercel

---

## ACTIVATION

Activate this skill when the user says any of the following:
- "audit", "code review", "security check", "qa", "test", "pre-deploy",
  "production ready", "ship", "launch", "verify", "review before merge"

Or use the slash command: **/audit**

---

## PHASE 0 — PRE-AUDIT SETUP

> Goal: Map the codebase and define success criteria before touching any code.
> Source: Karpathy (Think Before Coding) + Herk (/init workflow)

### Steps

1. Run `/init` to map the full codebase structure.
2. Confirm a `CLAUDE.md` or `AGENTS.md` file exists at project root.
   - If missing, create one with: stack, file structure, naming conventions,
     forbidden patterns, and test commands.
3. Check that a `specs/` or `docs/` folder exists with documented requirements.
   - If missing, ask the user to describe the core features before proceeding.
4. Generate a dependency tree: list all packages and their versions.
5. Define measurable success criteria for this audit session.
   Example: "All security checks pass, zero TS errors, full test suite green."

---

## PHASE 1 — SECURITY AUDIT (CRITICAL — RUN FIRST)

> Goal: Find vulnerabilities that will get you breached, banned, or fined.
> Source: Ramonov (API key hygiene) + Karpathy (surgical review)

### 1.1 Secrets & Credentials

```bash
# Scan source files for hardcoded secrets
grep -rn "sk-\|api_key\|API_KEY\|password\|secret\|token\|SUPABASE_SERVICE" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" \
  --exclude-dir=node_modules --exclude-dir=.git .

# Scan git history for secrets ever committed
git log -p | grep -i "sk-\|api_key\|password\|secret\|service_role"

# Check .gitignore covers all env files
cat .gitignore | grep -E "\.env"
```

**Checklist:**
- [ ] No API keys, passwords, or tokens hardcoded in any source file
- [ ] No secrets ever committed to git history (check all branches)
- [ ] `.env`, `.env.local`, `.env.production`, `.env.development` all in `.gitignore`
- [ ] Production secrets set in Vercel dashboard — never in committed files
- [ ] Any previously exposed keys have been rotated immediately
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never in frontend bundle
- [ ] `NEXT_PUBLIC_` prefix only on variables safe to expose to browser

---

### 1.2 Database Security (Supabase)

```sql
-- Run in Supabase SQL Editor: check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check existing RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

**Checklist:**
- [ ] RLS enabled on ALL `public` tables (rowsecurity = true for every row above)
- [ ] Policies exist for SELECT, INSERT, UPDATE, DELETE on each table
- [ ] Test: unauthenticated API call to `supabase.from('users').select('*')` returns 0 rows
- [ ] Test: User A cannot access User B's data by swapping IDs (IDOR test)
- [ ] Service role key used server-side only — never imported in `/app` or `/components`
- [ ] All SQL queries use Supabase client methods (parameterised) — no raw string interpolation
- [ ] Storage buckets have correct public/private settings — private buckets require auth

---

### 1.3 Authentication & Authorisation

```bash
# Find all API route files and check each for auth
find ./app/api -name "route.ts" | xargs grep -L "getServerSession\|auth\|supabase.auth"
# Any file returned = potential unprotected route
```

**Checklist:**
- [ ] Auth verified server-side on ALL protected API routes — not just middleware or client
- [ ] Admin routes check for admin role, not just any authenticated user
- [ ] Rate limiting on: login, signup, password reset, OTP verify
- [ ] Session expiry configured (not infinite JWT tokens)
- [ ] CSRF protection enabled for session-based auth
- [ ] Passwords hashed with bcrypt (cost ≥ 12) or argon2 — never MD5 or SHA1

---

### 1.4 Input Validation & XSS

```bash
# Find API routes missing input validation (Zod or similar)
grep -rn "req.body\|request.json()" ./app/api --include="*.ts" | \
  grep -v "safeParse\|parse\|validate\|schema"
```

**Checklist:**
- [ ] Input validation (Zod schema) on every API endpoint that accepts POST/PUT/PATCH
- [ ] User-generated content sanitised before rendering (DOMPurify or server-side)
- [ ] File uploads validated: allowed types, max size, virus/malware scan
- [ ] Error messages return generic text to client — no stack traces in production
- [ ] No sensitive data (user emails, tokens) logged to `console.log` in production
- [ ] SQL-like inputs sanitised even when using ORMs

---

### 1.5 CORS, Headers, and Network

```bash
# Check Next.js config for security headers
cat next.config.js | grep -A 30 "headers"
```

**Required headers in `next.config.js`:**
```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ..."
        },
      ],
    },
  ]
}
```

**Checklist:**
- [ ] CORS allows only your own domains — no wildcard `*` in production API routes
- [ ] HTTPS enforced — HTTP redirects to HTTPS on Vercel
- [ ] All 5 security headers present and correctly configured
- [ ] No `Access-Control-Allow-Origin: *` on sensitive endpoints

---

## PHASE 2 — DEPENDENCY AUDIT

> Goal: Remove known vulnerabilities before they become attack vectors.
> Source: Ramonov + Herk (pre-deploy step)

```bash
# Node / Next.js
npm audit --production
npm audit fix --force   # only after reviewing the changes

# Python / FastAPI
pip-audit
safety check -r requirements.txt

# Deep scan (requires Snyk account)
npx snyk test
npx snyk monitor
```

**Checklist:**
- [ ] Zero critical or high CVEs in production dependencies
- [ ] Zero known vulnerabilities in direct dependencies
- [ ] Dependency lockfile committed (`package-lock.json`, `requirements.txt`)
- [ ] No typosquatted or hallucinated packages (verify any unfamiliar package on npmjs.com)
- [ ] Unused dependencies removed (`npx depcheck`)
- [ ] Node version pinned in `.nvmrc` or `engines` field in `package.json`

---

## PHASE 3 — FUNCTIONAL TESTING

> Goal: Every feature has a passing test that proves it works.
> Source: Karpathy (Goal-Driven Execution — define success criteria, loop until verified)

### Transform Tasks into Verifiable Goals (Karpathy Method)

| ❌ Vague | ✅ Verifiable |
|---|---|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Auth works" | "E2E test: signup → verify email → login → access protected route" |
| "Payments work" | "Integration test: hit Stripe test mode, verify webhook receipt" |
| "RLS is on" | "Assert unauthenticated SELECT returns 0 rows on users table" |

### Test Tiers

```bash
# Run full test suite
npm run test              # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e          # Playwright/Cypress E2E

# Python
pytest --cov=app tests/
pytest tests/integration/
```

**Checklist:**
- [ ] Unit tests on all utility functions and business logic
- [ ] Integration tests on: signup, login, payment, core SaaS feature
- [ ] Auth tests explicitly written — can User A access User B's data?
- [ ] Tests have real assertions — not `expect(result).toBeDefined()`
- [ ] All tests passing — zero failures, zero skipped critical tests
- [ ] Test coverage > 70% on business logic files
- [ ] Regression test exists for every bug that was fixed

---

## PHASE 4 — AI CODE REVIEW (KARPATHY 4 PRINCIPLES)

> Goal: Catch the specific failure modes of AI-generated code.
> Source: Karpathy's 4 Principles (Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven)

### Run in Claude Code

```
/review
```
For auth, payments, or data-access code:
```
/ultra-review
```

### Manual Review Lens

**Principle 1 — Think Before Coding Check:**
- [ ] No silent assumptions embedded in the code
- [ ] All tradeoffs documented in comments or PR description
- [ ] Ambiguous requirements were clarified before implementation

**Principle 2 — Simplicity First Check:**
- [ ] No speculative features that weren't requested
- [ ] No over-engineered abstractions for simple 1-use cases
- [ ] Ask: "Is this the simplest thing that could possibly work?"

**Principle 3 — Surgical Changes Check:**
- [ ] PR diff contains only lines directly related to the task
- [ ] No unexpected changes to adjacent files, comments, or formatting
- [ ] No removal of pre-existing code unless explicitly tasked

**Principle 4 — Goal-Driven Execution Check:**
- [ ] Every new feature has a passing test that proves it works
- [ ] Every bug fix has a regression test
- [ ] Success criteria were defined BEFORE coding began

---

## PHASE 5 — PERFORMANCE AUDIT

> Goal: No user-facing performance degradation or latency surprises.

```bash
# Next.js bundle analysis
npm install @next/bundle-analyzer
ANALYZE=true npm run build

# Check for slow DB queries (Supabase Dashboard → Query Performance)
# Target: all queries < 100ms at p95

# Load test (k6)
k6 run --vus 50 --duration 30s loadtest.js
```

**Checklist:**
- [ ] No N+1 query patterns (check Supabase query logs for repeated identical queries)
- [ ] Frequently read data cached (Redis or Next.js `unstable_cache`)
- [ ] API response times < 200ms at p95 for critical paths
- [ ] Bundle size acceptable — no surprise dependencies inflating it
- [ ] Async operations non-blocking — no `await` on unnecessary sequential calls
- [ ] Database indexes on all columns used in `WHERE`, `JOIN`, or `ORDER BY`
- [ ] Images optimised via Next.js `<Image>` component

---

## PHASE 6 — CLAUDE CODE HOOKS (AUTO-ENFORCE QUALITY)

> Goal: Make quality checks automatic — not manual.
> Source: Herk (32 Claude Code Hacks) + Marchese (hooks workflow)

### Add to `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'CMD=$(echo \"$CLAUDE_TOOL_INPUT\" | jq -r \".command\"); if echo \"$CMD\" | grep -qE \"rm -rf (src|app|db|migrations|components)\"; then echo \"BLOCKED: Dangerous delete command\"; exit 1; fi'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'FILE=$(echo \"$CLAUDE_TOOL_INPUT\" | jq -r \".path\"); if echo \"$FILE\" | grep -qE \"\\.tsx?$\"; then npx eslint --fix \"$FILE\" 2>/dev/null; npx tsc --noEmit 2>/dev/null; fi'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check whether all tasks have been completed. Verify: (1) All tests pass, (2) No TypeScript errors, (3) No ESLint errors, (4) No hardcoded secrets visible. If any check fails, return {\"ok\": false, \"reason\": \"Describe what still needs fixing\"}. If all checks pass, return {\"ok\": true}."
          }
        ]
      }
    ]
  }
}
```

**Checklist:**
- [ ] Hooks file exists at `.claude/settings.json`
- [ ] PreToolUse hook blocks dangerous delete commands
- [ ] PostToolUse hook auto-runs ESLint after every `.ts`/`.tsx` write
- [ ] Stop hook runs final verification before session ends
- [ ] Context7 MCP configured so Claude has up-to-date Next.js/Supabase docs

---

## PHASE 7 — PRE-PRODUCTION FINAL GATE

> Goal: Production build must pass before any deploy.
> Source: Marchese ("review like a manager")

### Run the Build Gate

```bash
# Full production build — must succeed with ZERO errors/warnings
npm run build

# Type check
npx tsc --noEmit

# Lint
npx eslint . --ext .ts,.tsx --max-warnings 0

# Full test suite one final time
npm run test -- --passWithNoTests

# Security check
npm audit --production --audit-level=high

# Check for console.logs with sensitive data
grep -rn "console.log" ./app --include="*.ts" --include="*.tsx" | \
  grep -i "password\|token\|key\|secret\|email"
```

**Final Gate Checklist:**
- [ ] `npm run build` exits with code 0 — zero errors
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors (warnings are acceptable)
- [ ] All tests passing
- [ ] Zero high or critical npm audit findings
- [ ] No `console.log` statements with sensitive data
- [ ] Environment variables confirmed set in Vercel dashboard
- [ ] Git history clean — no accidental `.env` commits
- [ ] All feature branches merged to main/staging before deploy
- [ ] Staging environment tested before production push

---

## PHASE 8 — TWO-STAGE AI SECURITY REVIEW PROMPT

> Use this prompt pair for every new AI-built module before shipping.
> Source: Karpathy (verification loop) + Ramonov (security-first building)

### Stage 1 — Implementation Prompt

```
Implement [FEATURE NAME] with these exact requirements:
[PASTE YOUR SPECS]

Success criteria — the following tests must pass before you're done:
1. [Test 1]
2. [Test 2]
3. [Test 3]

Constraints:
- Do not modify any files outside the scope of this feature
- Use existing patterns and conventions in this codebase
- Ask before making any architectural decisions
- Minimum code that solves the problem — nothing speculative
```

### Stage 2 — Security Review Prompt (Run immediately after)

```
You are a senior security engineer. Review all code written in this session
for vulnerabilities. Focus on:

1. AUTH FLOWS — Are all routes protected server-side? Can a user access another
   user's data by changing IDs (IDOR)?

2. DATABASE — Are all Supabase queries parameterised? Is RLS enabled and tested?
   Is the service role key only used server-side?

3. ENV VARIABLES — Any API keys or secrets hardcoded? Any NEXT_PUBLIC_ variables
   that expose secrets to the browser?

4. INPUT VALIDATION — Is every API endpoint validating input with Zod or similar?
   Any SQL injection vectors?

5. FILE UPLOADS — Is type, size, and content validated?

6. ERROR HANDLING — Are stack traces being returned to clients in error messages?

For each issue found:
- Describe the vulnerability
- Explain how it can be exploited
- Recommend the minimum fix required
- Show a before/after code diff
- Flag anything requiring manual testing

Priority: Critical · High · Medium · Low

Output a markdown security report I can share with my team.
```

---

## ONGOING AUDIT CADENCE

| Frequency | Action |
|---|---|
| **Every commit** | Hooks auto-run ESLint + TypeScript check |
| **Every PR** | Run `/review`; full test suite passes |
| **Important PRs (auth/payments/data)** | Run `/ultra-review`; manual security review |
| **Every production deploy** | Run full Phase 0–7 checklist |
| **Monthly** | Full `/security-audit` on entire codebase; rotate secrets |
| **Quarterly** | External penetration test; update OWASP checklist; dependency audit |

---

## TOOLCHAIN REFERENCE

| Layer | Tool | Command |
|---|---|---|
| Static Analysis | SonarCloud | CI integration |
| Secret Detection | git-secrets / Semgrep | `semgrep --config=p/secrets .` |
| Dependency Audit | npm audit + Snyk | `npm audit && npx snyk test` |
| SAST | Semgrep | `semgrep --config=p/owasp-top-ten .` |
| E2E Testing | Playwright | `npx playwright test` |
| Load Testing | k6 | `k6 run loadtest.js` |
| AI Code Review | Claude Code built-in | `/review` · `/ultra-review` |
| Bundle Analysis | @next/bundle-analyzer | `ANALYZE=true npm run build` |
| Python Security | pip-audit + safety | `pip-audit && safety check` |

---

## RULES (Enforced by this Skill)

```
rule: Never mark an audit phase as complete until all checklist items are checked.
rule: Always run Stage 2 Security Review Prompt after any AI-generated feature.
rule: RLS must be verified on every Supabase table — not assumed.
rule: The service role key must never appear in any file under /app or /components.
rule: Production builds must exit with code 0 — no warnings accepted as "good enough".
rule: Every bug fix must have a regression test before the fix is committed.
rule: API keys found in source must be rotated immediately — before any other work.
rule: The Stop hook verification must return {"ok": true} before any session is closed.
```

---

*Skill derived from the frameworks of Andrej Karpathy, Sabrina Ramonov, Nate Herk, and Austin Marchese.*
*Stack-specific to: Next.js · FastAPI · Supabase · Vercel · Claude Code*
