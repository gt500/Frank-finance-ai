# Skill: The Spec
# Karpathy Layer 1 — Turning goals into precise Claude briefs
# Load with: /load .claude/skills/skill-spec.md

---

## What This Skill Does
Forces you to extract the TRUE goal before Claude writes anything.
Eliminates silent assumptions. Produces a crisp, verifiable brief.

---

## Step 1 — Goal Discovery Interview

```
Interview me to find the true goal of this task.
Ask questions one at a time until you can write a spec starting with:
"The outcome we need is..."
Do not write any code until I approve the spec.
```

---

## Step 2 — Agile Scope Lock

```
Break this into the smallest possible first step. State:
  1. What you will build in this step only
  2. What you will NOT build yet
  3. How we will verify this step is done
After I confirm, proceed only with step 1. Stop and wait before continuing.
```

---

## Step 3 — Surface Assumptions

```
Before writing anything, list:

ASSUMPTIONS I AM MAKING:
1. [assumption]
2. [assumption]

AMBIGUITIES I NEED RESOLVED:
1. [ambiguity]

Correct me now, or I will proceed with the above.
```

---

## Step 4 — Locked Spec Template

```
# Feature Spec: [NAME]

## Outcome
[One sentence: what must be true when this is done]

## Scope — This Session Only
- [what IS included]
- NOT included: [explicitly out of scope]

## Success Criteria
1. [specific, measurable — prefer a passing test]
2. [specific, measurable condition]
3. [edge case handled]

## Assumptions
- [assumption 1]

## Constraints
- [e.g. "must use existing Supabase schema"]
- [e.g. "must be multi-tenant safe"]
```

---

## Anti-Patterns

| Wrong (Waterfall) | Right (Agile Spec) |
|-------------------|--------------------|
| Dump everything at once | One step at a time |
| "Make it better" | "Must pass test X" |
| Let Claude decide | State assumptions explicitly |
| Long session, no checkpoints | Checkpoint after every deliverable |

---

## Karpathy
> "The bottleneck is not compute — it is human clarity.
> If you cannot articulate what done looks like, no amount of AI power will get you there."
