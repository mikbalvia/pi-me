---
name: pi-superpowers
description: Pi-native implementation discipline adapted from Superpowers. Use for feature work, bug fixes, refactors, implementation plans, TDD, code review, and any time the user asks for robust/verified execution. Enforces brainstorm/spec before coding, TDD for behavior changes, plan execution checkpoints, and fresh verification before completion claims.
---

# Pi Superpowers

Pi Superpowers is the discipline layer for Pi Factory. It adapts the useful parts of Superpowers to Pi without relying on Claude Code-only `Task` semantics.

## Core laws

1. **No production code without a failing test first** for behavior changes.
2. **No implementation before approved plan** unless the user explicitly asks for a tiny direct change.
3. **No completion claims without fresh verification evidence.**
4. **Do not trust child-agent success reports. Verify independently.**
5. **Stop and ask when blocked instead of guessing.**

## Required workflow

### 1. Brainstorm/spec gate

Before coding non-trivial work:

- Restate objective.
- Identify unknowns and risky assumptions.
- Ask concise clarifying questions when necessary.
- Create or update a written spec/plan.
- Get user approval before implementation when scope is non-trivial.

### 2. TDD gate

For new features, bug fixes, refactors, and behavior changes:

```text
RED   → write one failing test and run it
GREEN → implement minimum code to pass
REFACTOR → clean up while keeping tests green
```

For UI/frontend behavior changes, TDD can be component/e2e/state tests where the project supports them. If visual-only polish cannot be unit-tested, record visual acceptance criteria and run `/pi-design-review` with screenshot evidence where possible.

RED requirements:

- Test one behavior.
- Use real code where possible.
- Run the exact test command.
- Confirm it fails for the expected reason.

GREEN requirements:

- Implement only what the test demands.
- Run targeted test.
- Then run wider verification when practical.

Exceptions require explicit user approval:

- throwaway prototype
- generated code
- config-only change
- documentation-only change

### 3. Plan execution

When executing a plan file:

1. Read the plan.
2. Review it critically before touching files.
3. List blockers/questions.
4. Execute tasks in order.
5. Keep a concise checkpoint after each major step.
6. Run verification specified by the plan.
7. Write a summary with evidence.

If a plan conflicts with actual code, stop and update the plan or ask the user.

### 4. Verification before completion

Before saying anything is done/fixed/passing:

1. Identify what command proves the claim.
2. Run it fresh.
3. Read exit code and output.
4. For UI/frontend work, also run or request `/pi-design-review` when a visual quality claim is being made.
5. Report exact evidence.
6. If verification fails, say so plainly and preserve logs.

Use language like:

```text
Verified with `npm test`: exit 0, 42 tests passed.
```

Avoid unverified phrases:

```text
should work
probably fixed
looks good
done
```

## Child Pi / automation expectations

Pi Factory may spawn child Pi sessions using `pi --mode json -p --no-session`. Treat them as isolated executors, not authorities.

After child execution:

- Inspect git diff.
- Run verification in the parent process if possible.
- Write/update `.pi-factory` summaries.
- Do not move to next phase if verification fails unless config explicitly allows it.

## Completion report format

Use this concise format:

```markdown
## Result
- Status: completed | blocked | failed | partial
- Scope: ...

## Evidence
- Command: `...`
- Exit: 0
- Key output: ...

## Changed files
- `path`: why

## Notes / follow-up
- ...
```
