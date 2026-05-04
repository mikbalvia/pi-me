---
name: pi-frontend-engineering
description: Senior frontend code quality discipline for Pi. Use for frontend implementation, component architecture, Svelte/React/Vue UI code, CSS/Tailwind, forms, state management, data fetching, accessibility implementation, performance, frontend testing, code review, and when the user asks for senior frontend code quality. Complements pi-frontend-ux by enforcing maintainable engineering, not only visual quality.
---

# Pi Frontend Engineering

This skill makes Pi implement frontend like a senior product engineer.

Always read the persistent frontend code standard when available:

```text
~/.pi/agent/design/FRONTEND_CODE_QUALITY.md
```

Also read visual/design rules when the work is user-facing:

```text
~/.pi/agent/design/SENIOR_FRONTEND_DEFAULT.md
.pi-factory/DESIGN.md
.pi-factory/phases/*/UI-SPEC.md
```

## Core rule

A UI is not senior-grade if the code is fragile. Every frontend change must be judged on both:

1. user-facing quality: hierarchy, states, responsive, accessibility, copy
2. engineering quality: component boundaries, state model, types, tests, performance, security, maintainable styling

## Frontend engineering bar

For every frontend implementation/review, check:

- Component boundaries: small focused components, no god components.
- Props/types: explicit shapes, no avoidable `any`, constrained variants.
- State model: loading/empty/error/success/disabled/pending represented clearly.
- Data flow: separate server data, local UI state, and derived state.
- Forms: labels, errors, pending state, server error path, success feedback.
- Styling: tokens/classes/components first; avoid random inline styles/arbitrary values.
- Accessibility: semantic controls, focus-visible, labels, ARIA only where needed.
- Performance: no unnecessary dependency/render/bundle/hydration cost.
- Security: no unsafe HTML, leaked secrets, client-only authorization, unsafe external links.
- Tests: behavior changes need unit/component/e2e coverage where project supports it.

## Implementation discipline

Before coding:

- Read existing project patterns before inventing new ones.
- Identify component/data/state boundaries.
- Decide what needs tests and what command proves correctness.
- Prefer smallest safe change that fits the existing architecture.

While coding:

- Reuse existing primitives/hooks/stores/actions/loaders.
- Keep route/container logic separate from presentational components when useful.
- Do not introduce global state for local UI.
- Avoid broad refactors unless the phase explicitly requires them.
- Write or update tests before/with behavior changes.

Before completion:

- Run typecheck/build/lint/tests available for the project.
- Run `/pi-design-review` for user-facing visual changes when possible.
- Report test gaps explicitly instead of pretending coverage exists.

## Review discipline

When asked to review frontend code, output:

1. Blockers
2. Should-fix maintainability issues
3. Accessibility/state gaps
4. Test/verification gaps
5. Concrete refactor suggestions
6. Exact commands to prove readiness

Be specific: name file, component, state, or prop/API that needs work.
