# Skill: LLM Knowledge Wiki
# Karpathy Layer 3 — Compounding domain knowledge base
# Load with: /load .claude/skills/skill-llm-wiki.md

---

## Directory Structure

```
project-root/
  raw/              <- Source documents (read-only to Claude)
  wiki/
    index.md        <- Master index: all pages, categories, summaries
    log.md          <- Timestamped record of every wiki change
    [entity].md     <- One page per key concept, person, or system
    [concept].md    <- Cross-domain synthesis pages
  CLAUDE.md         <- Includes wiki schema (see block below)
```

---

## Wiki Schema Block (add to your CLAUDE.md)

```markdown
# Wiki Maintenance Rules

## When ingesting a new source from /raw/:
1. Read the full document
2. NEW concept/person/system: create wiki/[name].md
3. EXISTING page: update with new info, flag contradictions
4. Add cross-reference links to related pages
5. Update wiki/index.md
6. Append to wiki/log.md: [date] | [source] | [pages affected]

## Page format:
- First line: ## [Name] — [one sentence definition]
- Sections: Overview | Key Properties | Related Concepts | Open Questions
- Cross-references: [See: [page-name]] at the bottom

## Query behaviour:
- Search wiki/ FIRST before reasoning from memory
- If wiki has no answer, say so and offer to research + update
```

---

## Ingest Prompt

```
Ingest this document into the wiki following CLAUDE.md wiki rules.
Source: /raw/[filename]

After ingesting, list:
1. Pages created (new)
2. Pages updated (existing)
3. Contradictions found with existing wiki content
4. Confirm wiki/index.md and wiki/log.md are updated
```

---

## Query Prompt

```
Search wiki/ and answer: [YOUR QUESTION]
Cite the specific page if found.
If not in wiki, say so and ask if I want you to research and add it.
```

---

## Suggested Wiki Pages by Project

### Zeeder:
- `dealership-crm-landscape.md` — competitors, features, pricing
- `lead-scoring-models.md` — scoring logic, signals
- `automotive-buyer-journey.md` — funnel stages
- `whatsapp-lead-flow.md` — WA Business API patterns
- `sa-dealer-compliance.md` — POPIA requirements

### Gaz2go OVG:
- `lpg-regs-south-africa.md` — SABS, DoE, compliance
- `vending-machine-telemetry.md` — sensor types, failure modes
- `site-scoring-model.md` — census variables, algorithm
- `cylinder-safety-standards.md` — composite vs steel, ATEX
- `kzn-expansion-plan.md` — site shortlist, logistics

### Social Synapse:
- `platform-api-limits.md` — rate limits by platform
- `content-scheduling-logic.md` — optimal posting windows
- `sa-social-benchmarks.md` — engagement rates by industry

---

## Karpathy
> "You do the thinking. The LLM does the bookkeeping.
> Knowledge compiled once compounds — knowledge re-derived every session doesn't."
