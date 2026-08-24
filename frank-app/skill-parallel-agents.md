# Skill: Parallel Agents
# Karpathy Layer 3 — Running multiple Claude sessions simultaneously
# Load with: /load .claude/skills/skill-parallel-agents.md

---

## Setup: Git Worktrees

```bash
# From project root — create one isolated checkout per feature
git worktree add ../[project]-feature-A -b feature/A
git worktree add ../[project]-feature-B -b feature/B
git worktree add ../[project]-bugfix-1  -b bugfix/1

git worktree list
```

---

## Launch Sessions

```bash
# Terminal 1
cd ../[project]-feature-A && claude

# Terminal 2
cd ../[project]-feature-B && claude

# Terminal 3
cd ../[project]-bugfix-1 && claude
```

---

## Session Start Prompt (paste in each session)

```
This session is working on: [FEATURE / TASK NAME]
Scope for this session only:
  - [what this session will build]
  - NOT touching: [what other sessions handle]

Start in Plan Mode. Do not write code until I approve the plan.
Success criteria: [define here]
```

---

## DB Isolation (Supabase)

```bash
# Use separate schema per worktree in .env
DATABASE_URL=postgresql://[user]:[pass]@[host]/[db]?schema=test_feature_a
```

Or use Supabase branching:
```bash
supabase db branch create feature-a
```

---

## Merging

```bash
git merge feature/A --no-ff -m "feat: [description]"
git worktree remove ../[project]-feature-A
```

---

## Rules
- One branch per session — never share branches between sessions
- Start in Plan Mode → review → then switch to auto-accept
- Keep CLAUDE.md under 2,500 tokens per session for optimal performance
- Commit frequently inside each session for rollback safety

---

## Karpathy
> "Remove yourself as the bottleneck.
> Set up workflows that are autonomous — you should be adding tokens occasionally, not constantly."
