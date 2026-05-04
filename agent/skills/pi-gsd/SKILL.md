---
name: pi-gsd
description: Pi-native GSD/get-shit-done workflow. Use for large features, project planning, phase decomposition, context engineering, implementation roadmaps, phase execution, and automated build loops. Creates `.pi-factory` artifacts and keeps each phase small enough for fresh Pi child sessions.
---

# Pi GSD

Pi GSD adapts the core Get Shit Done workflow to Pi.

Original idea:

```text
project context → requirements → roadmap → phase context → phase plan → execute → verify → state update
```

Pi-native artifact root:

```text
.pi-factory/
  PROJECT.md
  REQUIREMENTS.md
  ROADMAP.md
  STATE.md
  config.json
  decisions/
  phases/
    01-phase-slug/
      CONTEXT.md
      PLAN.md
      SUMMARY.md
      VERIFICATION.md
  runs/
```

## Principles

- Keep phases small, explicit, and independently verifiable.
- Write context before plan.
- Write plan before implementation.
- Prefer fresh context per phase via child Pi sessions.
- Track status in `.pi-factory/STATE.md`.
- Create checkpoint commits after verified phase completion when git is available.

## Status model

Use these statuses in `ROADMAP.md` and `STATE.md`:

- `pending`
- `context-ready`
- `planned`
- `running`
- `blocked`
- `failed`
- `verified`
- `done`

A phase is executable when it has a `PLAN.md` and is not `done`/`verified`.

## Phase plan contract

Every phase `PLAN.md` should include:

```markdown
# Phase NN: Name

## Objective

## Files to read first
- `path`

## Assumptions / locked decisions

## Tasks
1. ...
2. ...

## TDD requirements
- Required unless docs/config-only.

## Verification commands
- `npm test`
- `npm run build`

## Done criteria
- ...

## Failure handling
- Stop on verification failure.
- Write logs to SUMMARY.md / VERIFICATION.md.
```

## Execution process

When asked to execute a phase:

1. Read `.pi-factory/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` if present.
2. Read the phase `CONTEXT.md` and `PLAN.md`.
3. Apply `pi-superpowers` discipline.
4. Execute tasks in order.
5. Run verification commands fresh.
6. Write `SUMMARY.md` and `VERIFICATION.md`.
7. Update `STATE.md` and roadmap status.
8. Create git checkpoint if configured/available.

## Automation notes

The `/build-loop` extension command automates phase execution. It expects phase directories under `.pi-factory/phases/` containing `PLAN.md`.

To make automation reliable:

- Keep verification commands explicit.
- Avoid vague tasks like “finish UI”.
- Include exact files or discovery commands.
- Keep each phase small enough for one child Pi run.

## If no `.pi-factory` exists

Guide the user to run:

```text
/pi-new-project <project idea>
```

or create the structure manually using the conventions above.
