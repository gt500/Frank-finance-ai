# Skill: AutoResearch (The Karpathy Loop)
# Overnight self-improving agent loop for skills, prompts, and algorithms
# Load with: /load .claude/skills/skill-autoresearch.md

---

## Three Requirements

1. **One modifiable file** — the thing being improved
2. **One measurable metric** — a number computed without human judgment (pass rate %, score)
3. **A fixed time budget** — short experiment cycle (1–5 min per iteration)

If you cannot define a binary/numeric metric — stop. Define the metric first.

---

## eval.json Setup

```json
{
  "target_file": ".claude/skills/[skill-name].md",
  "metric": "pass_rate",
  "test_cases": [
    {
      "id": "tc1",
      "input": "[a real prompt you want the skill to handle]",
      "assertions": [
        "output contains success criteria",
        "output does not contain vague language like make it better",
        "output length is under 500 words"
      ]
    },
    {
      "id": "tc2",
      "input": "[another real example]",
      "assertions": [
        "output contains a verifiable goal",
        "output contains a verification step"
      ]
    }
  ]
}
```

---

## Loop Prompt

```
You are running an AutoResearch loop to improve: [TARGET FILE]

Rules:
1. Read the current file
2. Form a hypothesis about one specific improvement
3. Make that change
4. Score against eval.json (count assertions passed / total)
5. If score IMPROVED: keep the change (new baseline)
6. If score SAME OR WORSE: revert
7. Log: [iteration] | [hypothesis] | [score before] | [score after] | [kept/reverted]
8. Repeat for [N] iterations

Start by reporting the baseline score. Run [N] iterations. Then summarise.
```

---

## Morning Review Prompt

```
Summarise the AutoResearch run on [target file]:
1. Starting score vs final score
2. Top 3 changes kept (why they worked)
3. Top 3 failure patterns (why they were reverted)
4. Current best version of the file
5. Top recommendation for next improvement area
```

---

## Applied Examples

**Zeeder lead scoring prompt:**
- Target: `.claude/skills/skill-zeeder.md`
- Metric: % of test leads correctly classified (hot/warm/cold)
- Test cases: 10 real lead profiles with known outcomes

**OVG site scoring algorithm:**
- Target: `src/scoring/site_score.py`
- Metric: % of test sites correctly ranked vs historical sales
- Test cases: 20 sites with known performance

**Social Synapse caption generator:**
- Target: `.claude/skills/caption-generator.md`
- Metric: % passing [contains CTA] + [under 150 chars] + [includes emoji]

---

## Karpathy
> "Prompts are the weights. Real outcomes are the loss function.
> Run the loop overnight. Wake up to a measurably better system."
