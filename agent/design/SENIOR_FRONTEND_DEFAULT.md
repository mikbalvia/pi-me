# Pi Senior Frontend Default Design

Use this default whenever the user asks for frontend/UI/UX work but does not provide detailed visual direction. Do not ask endless design questions; apply these defaults, document assumptions, and let the user override later.

## Personality

- Calm, clear, premium-but-not-flashy, utilitarian, trustworthy, fast-feeling.
- Craft signal comes from hierarchy, spacing, copy, state handling, and restraint.
- Anti-goals: generic SaaS template, random gradients, overdecorated AI slop, equal-weight everything, vague copy.

## Visual direction

- Neutral surfaces first, one meaningful accent color, semantic colors only for states.
- Use depth sparingly: borders and subtle shadows before heavy glow/blur.
- Prefer real content density over decorative chrome.
- Every screen needs one obvious primary focal point and one primary next action.

## Typography

- Default to system UI font unless the project already has brand fonts.
- Scale: 12 / 14 / 16 / 20 / 24 / 32 / 40 / 48.
- Body: 14 or 16; labels/captions: 12 or 13; page title: 32-48.
- Use regular, medium, semibold/bold only. Avoid random weights and arbitrary font sizes.
- Line-height should favor readability: body 1.5-1.65, headings 1.1-1.25.

## Color

- Default light: base #FAFAF9, surface #FFFFFF, border #E7E5E4, text #18181B, muted #71717A, accent #2563EB.
- Default dark: base #0C0C0C, surface #141414, border #27272A, text #FAFAFA, muted #A1A1AA, accent #60A5FA.
- Success #22C55E, warning #F59E0B, destructive #EF4444, info #3B82F6.
- Accent is reserved for primary actions, selected states, focus affordance, and meaningful data—not every clickable element.

## Spacing and layout

- 4px base grid.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Component padding: 8 / 12 / 16 / 24.
- Section spacing: 32 / 48 / 64.
- Max readable content width: 720-880px; dashboard/app shell max: 1120-1280px.
- Mobile first: single column at 375px, comfortable tablet layout at 768px, full desktop hierarchy at 1440px.

## Components

- Buttons: primary, secondary, ghost, destructive; all need hover, focus-visible, disabled, and loading treatment.
- Forms: visible label, help text when useful, field-level error, disabled/loading state, server error summary when needed.
- Cards/panels: consistent radius/border/shadow rules; avoid nested cards unless hierarchy needs it.
- Navigation: active state, focus state, collapsed/mobile behavior.
- Tables/lists: empty state, loading state, row actions, overflow behavior, responsive fallback.
- Dialogs/drawers: focus trap where framework supports it, clear cancel/destructive distinction.

## State contract

Every user-facing flow must handle:

- Loading: skeleton/spinner with stable layout and useful label when slow.
- Empty: explain what happened, why it matters, and the next action.
- Error: explain cause if known, recovery action, and support/debug path where useful.
- Success: confirm outcome without blocking the next step.
- Disabled: explain why unavailable where ambiguity exists.
- Hover/focus: visible, consistent, accessible.

## Copywriting

- CTAs describe outcome: “Create project”, “Send invite”, “Save changes”.
- Avoid generic: “Submit”, “OK”, “Click here”, “No data”, “Something went wrong”.
- Empty states should teach and move the user forward.
- Error copy should include recovery, not just failure.
- Prefer concise, direct, human language.

## Accessibility

- Keyboard reachable interactive controls.
- Visible focus-visible states.
- Icon-only controls require accessible labels.
- Inputs require labels; errors must be connected to fields when possible.
- Color contrast target: WCAG AA.
- Respect reduced motion for non-essential animation.

## Verification expectations

- Project check/lint/build/test where available.
- Visual review at mobile 375x812, tablet 768x1024, desktop 1440x900.
- UI review pillars must score at least 3/4 unless a waiver is recorded.
- Any local exception to this default must be documented in `.pi-factory/DESIGN.md` or phase `UI-SPEC.md`.
