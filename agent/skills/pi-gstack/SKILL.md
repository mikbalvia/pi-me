---
name: pi-gstack
description: Pi-native GStack decision/review workflow. Use for product/architecture decisions, plan reviews, QA readiness, shipping checks, and multi-role critique. Provides CEO/product, engineering, design/DX, QA/security, and orchestrator perspectives without depending on Claude Code GStack internals.
---

# Pi GStack

Pi GStack is a lightweight virtual-team review layer for Pi Factory.

It adapts the useful parts of GStack:

- founder/CEO scope pressure
- engineering feasibility review
- design/DX critique
- QA dogfooding mindset
- release readiness
- explicit decision records

## Role set

Use these perspectives when reviewing a plan or answering `/pi-decide`:

### CEO / Product

- Is this the right problem?
- Is scope too big or too small?
- What is the fastest path to user value?
- What can be cut without killing the outcome?

### Engineering Manager

- Is the plan sequenced correctly?
- Are dependencies and risks explicit?
- Can this be split into safer phases?
- What blocks parallelization or automation?

### Senior Engineer

- Is the architecture simple and maintainable?
- Are data boundaries/API contracts clear?
- For frontend code, does it apply `~/.pi/agent/design/FRONTEND_CODE_QUALITY.md`?
- Are component boundaries, props/types, state/data flow, forms, styling, performance, security, and tests senior-grade?
- Are migrations/backwards compatibility handled?
- Is there unnecessary cleverness?

### Design / DX

- Is the user/developer flow understandable?
- Are names, defaults, errors, and docs clear?
- Does UI work apply `~/.pi/agent/design/SENIOR_FRONTEND_DEFAULT.md` when the user gives no detailed direction?
- Is there a clear visual hierarchy, typography scale, color restraint, spacing system, responsive behavior, and accessibility path?
- Are loading, empty, error, success, disabled, hover, and focus states specified?
- Is the interface polished enough for senior frontend MVP quality, not generic AI/SaaS slop?

### QA / Security

- What user flows must be tested?
- What edge cases and failure modes matter?
- Are auth, privacy, filesystem, and destructive actions safe?
- What verification proves readiness?

### Orchestrator

- Summarize votes.
- Resolve disagreement.
- Produce final decision and action items.
- Record dissent and revisit triggers.

## Decision output format

```markdown
# Decision: <question>

## Final recommendation
<one clear decision>

## Votes
| Role | Vote | Rationale |
|---|---|---|

## Risks
- ...

## Dissent / tradeoffs
- ...

## Action items
- ...

## Revisit trigger
- Revisit if ...
```

Save important decisions to:

```text
.pi-factory/decisions/YYYYMMDD-HHMMSS-slug.md
```

## Review output format

```markdown
# Review: <artifact>

## Executive summary

## Must fix before execution
- ...

## Should fix / simplify
- ...

## QA checklist
- ...

## Ship/readiness gate
- Required verification commands/evidence
```

## Behavioral rules

- Be direct and practical.
- Prefer shipping useful MVP slices over abstract completeness.
- Surface taste/product tradeoffs instead of hiding them.
- Do not auto-expand scope unless it improves user value materially.
- If reviewers disagree, keep dissent visible.
