# Pi Senior Frontend Code Quality Standard

This is Pi's persistent frontend engineering bar. Apply it to every frontend/UI phase unless a project-local standard overrides it.

## Goal

Frontend code should be easy to change, hard to break, accessible by default, performant enough for production, and visually consistent with the design system.

Good frontend is not only what users see. It is also component boundaries, state modeling, tests, data flow, performance, and maintainable styling.

## Default engineering principles

1. **Small focused components** — split when a component owns unrelated concerns, multiple data flows, or many states.
2. **One source of truth** — avoid duplicated derived state, parallel booleans that can conflict, and hidden global coupling.
3. **Explicit state model** — represent loading, empty, error, success, disabled, optimistic, and permission states deliberately.
4. **Semantic HTML first** — prefer native button/link/form/table/list elements before custom ARIA-heavy widgets.
5. **Typed boundaries** — validate/normalize data at server/API boundaries; keep component props narrow and explicit.
6. **Design tokens over one-offs** — use existing tokens/classes/components before inline styles, arbitrary Tailwind values, or hardcoded colors.
7. **Behavior gets tests** — user-visible logic, state transitions, permissions, form validation, and navigation flows need tests where the project supports them.
8. **No unrelated cleanup** — improve surrounding code only when required by the phase or when it reduces immediate risk.

## Component architecture

### Component size and responsibility

Prefer components that have one clear job:

- Presentational component: renders UI from props and emits events/callbacks.
- Container/route component: loads data, coordinates state, handles navigation/actions.
- Form component: owns validation, submission state, field errors, and success/error feedback.
- Design primitive: button, input, card, modal, table, tabs, toast, badge, skeleton.

Refactor or split when:

- A file mixes data fetching, complex transformation, UI layout, modal logic, and form logic.
- A component has repeated branches for unrelated states.
- The same markup/style pattern appears 3+ times.
- Props become vague bags like `data`, `config`, `options`, `anyProps` without explicit shape.

Avoid:

- God components.
- Copy-pasted card/table/form blocks.
- Deep prop drilling through unrelated components.
- Creating global state for local UI concerns.

## Props and API design

Good component APIs:

- Use explicit prop names that describe product meaning.
- Keep optional props truly optional with safe defaults.
- Model variants with constrained values, not free-form strings.
- Expose events/callbacks at product intent level: `onSave`, `onInvite`, `onDismiss`.
- Do not leak backend DTO shape into deeply nested UI unless intentionally mapped.

Avoid:

- `any`, `unknown` without narrowing, or untyped event/data payloads.
- Boolean prop explosions like `primary`, `secondary`, `danger`, `ghost` together; prefer `variant`.
- Passing raw HTML unless sanitized and explicitly justified.

## State and data flow

Every async/data-driven UI must handle:

- loading
- empty
- error
- success/ready
- refetch/retry when relevant
- disabled/pending while submitting
- optimistic update rollback when used

Rules:

- Keep server data, local UI state, and derived state separate.
- Do not store derived values that can be calculated from source state unless performance requires it.
- Prefer finite-state style thinking for complex flows.
- Make impossible states impossible where the framework/type system allows it.

## Forms

Forms must include:

- visible labels
- help text where needed
- field-level errors
- form-level/server error summary when needed
- disabled/pending submit state
- success confirmation or next step
- keyboard submission behavior
- validation close to the data boundary

Avoid:

- placeholder-only labels
- generic submit text
- swallowing server errors
- clearing user input after failed submit unless intentional
- duplicate validation logic with inconsistent messages

## Styling and CSS quality

Prefer:

- existing design tokens/classes/components
- shared primitives for repeated controls
- predictable spacing scale
- responsive utilities/patterns already used in the project
- class composition helpers where project has them

Avoid:

- arbitrary spacing/type/color values without design reason
- inline styles for static styling
- global CSS leaks
- fragile selectors based on generated markup
- layout hacks like magic negative margins unless documented
- random gradients/shadows that do not serve hierarchy

Tailwind-specific:

- Prefer theme tokens and existing utility patterns.
- Arbitrary values are allowed only for true one-off integration constraints.
- Repeated utility strings should become a component, variant helper, or shared class.

## Accessibility engineering

Minimum bar:

- interactive elements are keyboard reachable
- visible focus state
- icon-only controls have accessible labels
- form fields have associated labels/errors
- dialogs/menus/tabs follow framework/project accessibility patterns
- color is not the only carrier of meaning
- motion respects reduced-motion when non-essential
- async updates announce status where appropriate

Never replace native controls with custom div/span controls unless there is a strong reason and accessibility is implemented.

## Performance and rendering

Frontend changes should avoid:

- unnecessary large dependencies
- repeated expensive computation in render without memoization/derived caching where needed
- loading all data when pagination/windowing is expected
- layout shift from images/skeletons/async content
- client-only code when server rendering would be simpler/faster
- eager loading of heavy charts/editors/media on initial route when deferrable

Check when relevant:

- bundle impact
- hydration/client boundary size
- image dimensions and lazy loading
- list rendering with large data
- debounced search/input behavior

## Security and safety

Watch for:

- unsafe HTML rendering (`innerHTML`, `{@html}`, `dangerouslySetInnerHTML`, `v-html`)
- unescaped user content in URLs or attributes
- external links missing `rel="noopener noreferrer"` when `target="_blank"`
- client-side permission checks without server enforcement
- leaking secrets/tokens into client bundles
- trusting query params/localStorage without validation

Unsafe HTML is allowed only with documented sanitization and a reason.

## Testing expectations

Use the project's existing test stack. If no test stack exists, add verification through build/check/lint and document the gap.

Behavior changes should have at least one of:

- unit test for transformation/validation logic
- component test for state rendering and interactions
- e2e test for critical user flow
- server/action/API test for data mutation path

UI code should be verified with:

- typecheck/build
- lint/check if available
- targeted tests for changed behavior
- `/pi-design-review` for visual/accessibility/copy heuristics when user-facing

## Review checklist

Before calling frontend code senior-grade, confirm:

- component boundaries are clear
- props/types are explicit
- async states are complete
- forms are accessible and resilient
- styling uses tokens/patterns, not random one-offs
- responsive behavior is intentional
- behavior changes are tested or test gap is documented
- no avoidable unsafe HTML/security issue
- no new large dependency without justification
- changed files are focused on the phase

## Red flags that should block ship

- compile/type errors
- missing loading/error state for async UI
- inaccessible custom controls
- unsafe HTML without sanitization
- client-only auth/permission enforcement
- large unreviewed dependency
- arbitrary styling scattered across multiple files
- duplicated complex business/UI logic
- no verification evidence
