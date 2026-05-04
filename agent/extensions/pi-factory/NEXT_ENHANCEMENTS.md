# Pi Factory — Next Enhancements

Dokumen ini adalah roadmap setelah **MVP 3 UI/UX workflow baseline**. Untuk command dan penggunaan harian, baca `README.md`. Untuk contoh end-to-end, baca `USECASES.md`.

## Status saat ini: MVP 3 UI/UX workflow implemented

Sudah ada:

- `.pi-factory/` project artifacts: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `phases/`, `runs/`, `decisions/`.
- Sequential `/build-loop` via fresh child Pi process.
- Parent-side verification command runner.
- Config loader dengan precedence:
  ```text
  CLI flags > .pi-factory/config.json > extension defaults
  ```
- Safe defaults:
  ```text
  maxPhases=1
  requireCheck=true
  maxRetries=0
  maxAgentTurns=20
  childTimeoutMs=1200000
  childIdleTimeoutMs=300000
  verifyTimeoutMs=600000
  ```
- `/pi-factory-check` dan `/pi-check` readiness checker.
- Structured verification extraction dari YAML, fenced shell block, Markdown table, dan inline backticks.
- Child guard: total timeout, idle timeout, max assistant turns.
- `DONE.json` done protocol dan veto:
  ```text
  status failed -> failed
  status blocked -> blocked
  readyForParentVerification false -> blocked
  ```
- Safety audit:
  - protected paths
  - max changed files
  - max diff lines
  - `--allow-protected-changes`
  - `--allow-large-diff`
- Dangerous verification command detector + `--allow-dangerous-verify`.
- Run logs, child logs, `SUMMARY.md`, `VERIFICATION.md`.
- Git checkpoint after verified phase.
- GStack-style `/pi-decide` dan `/pi-review`.
- Helper commands `/pi-factory-docs` dan `/pi-factory-next`.
- UI/UX design layer:
  - `.pi-factory/DESIGN.md` scaffold/source of truth.
  - Phase `UI-SPEC.md` design contract.
  - `/pi-design-system`, `/pi-ui-phase`, `/pi-sketch`, `/pi-design-review`, `/pi-dx-review`, `/pi-ship-review`.
  - 6-pillar visual audit with Playwright screenshot capture when a live URL is available, fallback code heuristics otherwise.
  - `.pi-factory/sketches/` throwaway HTML variants + manifest.
- Operator UX layer:
  - `/pi-dashboard` interactive TUI overlay.
  - `/pi-next` next-best-action routing.
  - `/pi-factory-wizard` guided setup.

## Current known behavior / gotchas

### UI review without live URL

`/pi-design-review` can run without a URL, but then it is a code-only heuristic audit. For real visual quality gate, start the app and pass URL:

```text
/pi-design-review 1 --url http://localhost:5173
```

Screenshot capture uses Playwright via `npx --yes playwright screenshot`. If Playwright/browser binaries are not installed, `UI-REVIEW.md` is still written and records screenshot command failures as evidence.

### UI phase contracts

For phases touching user-facing UI, run:

```text
/pi-design-system
/pi-ui-phase <phase>
```

Readiness check warns when likely UI work lacks `.pi-factory/DESIGN.md` or phase `UI-SPEC.md`. This is a quality gate warning, not a hard block yet.

### `rg` negative checks

`rg` exits `1` when no matches are found. For verification commands where “no match” means success, use:

```bash
if rg "\\$lib/server|@prisma/client|PrismaClient" src --glob "*.svelte"; then exit 1; else exit 0; fi
```

### Safety audit on fresh uncommitted repos

If a repo has never committed baseline files, safety audit may see many `??` untracked files and block with:

```text
Changed files N exceeds maxChangedFiles 40.
```

Best fix:

```bash
git add -A
git commit -m "baseline before pi factory run"
```

Manual override after review:

```text
/build-loop <phase> --allow-large-diff
```

### All phases sequentially

Default remains one phase. To run all remaining phases in order:

```text
/build-loop --dry-run --max-phases 6
/build-loop --max-phases 6
```

Build-loop skips `verified`/`done` phases and stops on first `blocked`/`failed` unless `--continue-on-failure` is used.

---

## Recommended next priorities

| Priority | Enhancement | Why |
|---:|---|---|
| Done | UI/UX workflow P0-P3 baseline | DESIGN.md, UI-SPEC, sketch, design review, DX/ship review, dashboard, next action. |
| P0 | Fix negative-check command semantics | Support declarative “no match expected” verification without shell wrapping. |
| P0 | Dirty start policy enforcement | `allowDirtyStart` exists in config but should actively block dirty starts when false. |
| P0 | Status reset/reopen command | Need deterministic way to reopen false-verified or blocked phases. |
| P1 | Phase contract validation | Make `phase.json` authoritative for expected files, forbidden files, verification, and dependency edges. |
| P1 | Better safety baseline | Compare against phase start snapshot, not only git working tree. Helps non-git/fresh repos. |
| P1 | Resume/crash recovery | Lock file, stale run detection, recommended resume command. |
| P2 | TDD evidence checker | Detect whether tests were added/run before implementation for behavior phases. |
| P2 | Project adapters | SvelteKit/Prisma, Node, Python, Rust defaults for verification and safety. |
| P3 | Worktree sandbox execution | Isolate child changes before merge/checkpoint. |
| P3 | Parallel wave execution | Run independent phases concurrently after contract/dependency graph exists. |

---

## P0.1 Declarative negative verification checks

Problem: shell tools often use non-zero exit for safe negative results (`rg` no matches = `1`).

Proposed structured verification:

```yaml
verification:
  - command: rg "\\$lib/server|@prisma/client|PrismaClient" src --glob "*.svelte"
    expectExitCodes: [1]
    required: true
    description: no server-only imports in Svelte components
```

Or:

```yaml
verification:
  - search:
      pattern: "\\$lib/server|@prisma/client|PrismaClient"
      paths: ["src"]
      glob: "*.svelte"
      expect: no_match
```

Acceptance criteria:

- Parent verifier can treat configured exit codes as pass.
- `VERIFICATION.md` clearly shows expected vs actual exit code.
- Dangerous command detection still applies to shell commands.

---

## P0.2 Dirty start policy enforcement

Problem: `allowDirtyStart` exists, but safety audit is more useful if phase start is clean or explicitly acknowledged.

Behavior:

```json
{
  "allowDirtyStart": false
}
```

If git working tree dirty before child run:

- Stop before execution.
- Show changed files.
- Recommend commit/stash or `/build-loop --allow-dirty-start`.

Acceptance criteria:

- Dirty git state blocks before child starts when `allowDirtyStart=false`.
- Non-git repos are allowed but warning is shown.
- Run log records dirty-start decision.

---

## P0.3 Status reset / reopen command

Need commands for correcting status without hand-editing Markdown.

Proposed commands:

```text
/pi-factory-reset-phase 3 --status planned
/pi-factory-reopen 3
/pi-factory-mark 3 blocked --reason "missing repository helpers"
```

Behavior:

- Update `STATE.md` with timestamp.
- Optionally update `ROADMAP.md` table row.
- Optionally move/annotate stale `DONE.json`/`VERIFICATION.md`.

Acceptance criteria:

- `/pi-status` immediately reflects reset.
- No production files changed.
- Every manual status change is auditable.

---

## P1.1 Strong `phase.json` contract

Current `phase.json` is scaffolded but not yet strongly enforced.

Target schema:

```json
{
  "version": 2,
  "id": 4,
  "slug": "server-load-actions",
  "status": "planned",
  "dependsOn": [3],
  "allowedFiles": ["src/routes/+page.server.ts", "src/lib/server/**"],
  "expectedFiles": ["src/routes/+page.server.ts"],
  "forbiddenFiles": ["src/routes/+page.svelte"],
  "verification": [
    { "command": "npm test", "required": true },
    { "command": "npm run check", "required": true }
  ]
}
```

Acceptance criteria:

- Build-loop blocks if dependencies are not `verified`/`done`.
- Safety audit checks expected/forbidden files.
- Verification can be read from `phase.json` before Markdown fallback.

---

## P1.2 Better safety baseline

Current safety audit uses git status/diff. This is weak for fresh non-committed repos.

Enhancement:

- Capture phase-start file snapshot.
- Compare after child run.
- Exclude `.pi-factory/runs/`, phase summary/log artifacts, generated ignore patterns.
- Use git diff when available for line counts.

Acceptance criteria:

- Fresh repo does not count pre-existing untracked files as phase changes.
- Summary distinguishes pre-existing dirty files from child-created files.

---

## P1.3 Resume and lock files

Commands:

```text
/pi-factory-resume
/pi-factory-unlock
```

Lock file:

```text
.pi-factory/RUNNING.lock
```

Acceptance criteria:

- Prevent two build-loops in same project.
- Detect stale lock.
- Suggest exact next command after crash/timeout.

---

## P2.1 TDD evidence checker

For behavior phases, collect evidence that child followed red-green-refactor.

Possible signals:

- Test file changed before implementation file in child event stream.
- Summary includes failing-test command and output.
- Parent verifies new tests exist or test count increased.

Acceptance criteria:

- Warning if TDD evidence missing, not automatic failure at first.
- Config can make it required for selected projects/phases.

---

## P2.2 Project adapters

Adapters provide defaults for common stacks.

Examples:

### SvelteKit + Prisma

- Verification defaults:
  ```text
  npx prisma validate
  npx prisma generate
  npm run check
  npm test
  npm run build
  ```
- Server-only import guard.
- Common generated paths ignored.

### Python

- `pytest`
- `ruff check .`
- `.venv/**` protected/ignored.

### Rust

- `cargo test`
- `cargo clippy -- -D warnings`
- `target/**` ignored.

---

## P3 Worktree and parallel execution

Only implement after contracts/dependencies are deterministic.

### Worktree sequential

- Create temp branch/worktree per phase.
- Child works inside isolated worktree.
- Parent verifies.
- Merge back or create patch.

### Parallel waves

- Use `dependsOn` graph from `phase.json`.
- Run independent phases concurrently.
- Merge verified outputs with conflict detection.

Acceptance criteria:

- No two parallel phases can write same allowed file pattern unless explicit conflict strategy exists.
- Failed phase leaves inspectable worktree/patch.
- Parent remains final verifier after merge.

---

## Current best practice summary

```text
/reload
/pi-status
/pi-factory-check <phase>
/build-loop --dry-run
/build-loop
```

For all remaining phases:

```text
/build-loop --dry-run --max-phases 6
/build-loop --max-phases 6
```

For a safety-audited fresh repo:

```bash
git add -A
git commit -m "baseline before pi factory run"
```

Then rerun:

```text
/build-loop <phase>
```
