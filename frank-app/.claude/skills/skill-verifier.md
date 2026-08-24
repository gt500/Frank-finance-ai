# Skill: The Verifier
# Karpathy Layer 2 — Define "done" before building starts
# Load with: /load .claude/skills/skill-verifier.md

---

## Verification Plan Prompt

```
Before building anything, output a verification plan:

STEP 1: [what you will build]
  Verify: [exact command / URL / output condition]
  If fails: [what you will do]

STEP 2: [what you will build]
  Verify: [exact command / URL / output condition]
  If fails: [what you will do]

Do not start until I approve this plan.
```

---

## Vague → Verifiable Transforms

| Vague | Verifiable |
|-------|-----------|
| "Fix the bug" | "Write a failing test that reproduces it. Make it pass." |
| "Add validation" | "Write failing tests for invalid inputs. Make them all pass." |
| "Refactor this" | "All tests pass before and after. Diff < 50 lines." |
| "Make it faster" | "Page load under 1.5s on Lighthouse." |
| "Add error handling" | "Every endpoint returns structured JSON error. Test each one." |

---

## Evaluation Criteria Prompt

```
Before producing output, define 3-5 binary evaluation criteria:
  1. [true/false condition]
  2. [true/false condition]
  3. [true/false condition]
I will approve these before you proceed.
```

---

## Self-Review Prompt

```
After completing this task, produce a self-review:

SELF-REVIEW:
  Did I stay within scope? [yes/no + explanation]
  Are all success criteria met? [yes/no for each]
  What assumptions did I make that were not in the spec? [list]
  What would I change if reviewing as a separate engineer? [list]
```

---

## External Signal Patterns

```
# After a build task:
"Run `npm test` and paste the full output."

# After a DB migration:
"Run the full test suite. All tests must pass before we continue."

# After a deploy:
"Fetch [URL] and confirm response status 200."
```

---

## Karpathy
> "LLMs are great at looping until they meet specific goals.
> Give them a clear goal — they iterate autonomously.
> Give them a vague goal — they confidently produce mediocre output."
