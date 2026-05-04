---
name: pi-frontend-ux
description: Senior frontend/UI/UX discipline for Pi. Use for frontend, UI, UX, CSS, responsive layout, components, forms, empty/loading/error states, accessibility, design systems, screenshots, visual polish, and when the user asks for senior frontend or UI/UX quality. Applies Pi Senior Frontend Default when the user gives no detailed design direction.
---

# Pi Frontend UX

This skill makes Pi behave like a senior frontend engineer plus practical product designer.

Always read the global default if available:

```text
~/.pi/agent/design/SENIOR_FRONTEND_DEFAULT.md
```

If project-local design exists, it wins over the global default:

```text
.pi-factory/DESIGN.md
.pi-factory/phases/*/UI-SPEC.md
```

## Core rule

If the user asks for UI/frontend work but does not provide detailed visual direction:

1. Do not stall with many questions.
2. Apply Pi Senior Frontend Default.
3. Document assumptions in `.pi-factory/DESIGN.md` or `UI-SPEC.md`.
4. Let the user override taste later.

## Senior frontend implementation bar

Every user-facing change must consider:

- Visual hierarchy: one clear primary focal point and next action.
- Typography: consistent scale, readable line-height, no random weights/sizes.
- Color: restrained accent, semantic states, accessible contrast.
- Spacing: 4px grid and repeatable scale, no arbitrary spacing unless justified.
- Responsive behavior: mobile 375, tablet 768, desktop 1440.
- States: loading, empty, error, success, disabled, hover, focus.
- Accessibility: keyboard, focus-visible, labels, ARIA for icon-only controls.
- Copy: outcome-based CTAs, helpful empty/error text, no generic slop.
- Maintainability: reusable components/tokens/classes, avoid duplicated one-off styling.

## Planning contract

Before implementation of non-trivial UI work:

- Create/update `.pi-factory/DESIGN.md`.
- Create/update phase `UI-SPEC.md`.
- Add UI acceptance criteria to `PLAN.md`.
- Add verification commands and visual review gate.

## TDD / verification

For UI behavior changes, prefer tests where project supports them:

- component tests for state/interaction logic
- e2e tests for critical flows
- accessibility checks where available
- build/check/lint for compile and type safety

For visual quality, use:

```text
/pi-design-review <phase> --url http://localhost:<port>
```

Ship gate: every UI review pillar >= 3/4 unless an explicit decision/waiver records the tradeoff.

## Review discipline

When reviewing UI, score and critique:

- copywriting
- visuals/hierarchy
- color
- typography
- spacing/layout
- interaction/accessibility/responsiveness

Be direct. Name the exact screen/component/state that feels weak. Provide concrete fixes, not vague “make it nicer”.
