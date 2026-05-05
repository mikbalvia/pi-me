# Pi Factory — Contoh Use Case Lengkap

Dokumen ini berisi contoh praktis memakai Pi Factory dari awal sampai automation.

> Dokumentasi utama: `~/.pi/agent/extensions/pi-factory/README.md`
>
> Catatan MVP 4: default aman masih aktif (`maxPhases=1`, `requireCheck=true`, `retries=0`, `maxAgentTurns=20`, child timeout 20 menit, idle timeout 5 menit), plus UI/UX/frontend engineering layer: `DESIGN.md`, `UI-SPEC.md`, `/pi-frontend-review`, `/pi-design-review`, `/pi-design-loop`, `/pi-dashboard`, `/pi-next`, dan automation shortcut `/pi-auto-plan` → `/pi-run-all`.

---

## Use Case 0 — Auto workflow: auto-plan → run-all

### Goal

Mulai dari goal besar, biarkan Pi membuat `.pi-factory` plan lalu menjalankan next actions otomatis sampai semua phase selesai atau blocked.

### Langkah

```text
/pi-auto-plan Improve the dashboard UI/UX: clearer hierarchy, better empty states, responsive layout, and polished visual system.
```

Setelah autoplan selesai membuat `.pi-factory/phases`, jalankan:

```text
/pi-run-all
```

Untuk membatasi automation:

```text
/pi-run-all --max-phases 2
/pi-run-all --max-steps 20
```

Behavior expected:

- Pi mengikuti `/pi-next` otomatis.
- Jika perlu `DESIGN.md` atau `UI-SPEC.md`, Pi menjalankan planning/design child.
- Jika phase ready, Pi menjalankan `/build-loop <phase>` langsung.
- Frontend/UI phase tetap melewati `/pi-frontend-review` dan `/pi-design-review` gate via build-loop.
- Stop jika verified semua, mencapai limit, atau blocked.

Manual single-step helper:

```text
/pi-auto-next
/pi-auto-next --execute
```

---

## Use Case 0.1 — UI/UX workflow manual: design system → UI-SPEC → build → review

### Goal

Memperbaiki UI dashboard agar tidak terlihat generic/AI slop. Jika user tidak memberi detail, Pi memakai `~/.pi/agent/design/SENIOR_FRONTEND_DEFAULT.md`; untuk kualitas kode frontend Pi memakai `~/.pi/agent/design/FRONTEND_CODE_QUALITY.md`.

### Langkah

```text
/pi-autoplan Improve the dashboard UI/UX: clearer hierarchy, better empty states, responsive layout, and polished visual system.
/pi-design-system Dashboard product should feel calm, premium, and fast for power users.
/pi-create-phase dashboard visual polish
/pi-ui-phase 1
/pi-sketch dashboard layout alternatives
/pi-plan-phase 1
/build-loop 1 --dry-run
/build-loop 1
/pi-frontend-review 1
/pi-design-review 1 --url http://localhost:5173
# optional RalphLoop-style visual iteration
/pi-design-loop 1 --url http://localhost:5173 --max-iterations 2
```

Jika review blocked:

```text
/pi-design-review 1 --url http://localhost:5173 --fix
```

Final gate:

```text
/pi-ship-review
```

Artifacts expected:

```text
.pi-factory/DESIGN.md
.pi-factory/sketches/*/index.html
.pi-factory/sketches/*/DECISION.md
.pi-factory/phases/01-dashboard-visual-polish/UI-SPEC.md
.pi-factory/phases/01-dashboard-visual-polish/ui-review/UI-REVIEW.md
.pi-factory/phases/01-dashboard-visual-polish/ui-review/screenshots/
```

Operator shortcut:

```text
/pi-dashboard
/pi-next
```

Use `/pi-next` kalau bingung command berikutnya; gunakan `/pi-dashboard` untuk cockpit interaktif.

## Use Case 1 — File sederhana: membuat `hello.txt`

Use case ini cocok untuk smoke test.

### Goal

Buat file `hello.txt` berisi teks `hello`.

### Langkah

Buka Pi di folder project/temp folder:

```bash
mkdir /tmp/pi-factory-hello
cd /tmp/pi-factory-hello
pi
```

Di Pi:

```text
/pi-new-project Create hello.txt containing hello
```

Buat phase:

```text
/pi-create-phase create hello file
```

Edit atau minta plan:

```text
/pi-plan-phase 1
```

Pastikan `.pi-factory/phases/01-create-hello-file/PLAN.md` punya verification command seperti:

```md
## Verification commands

- `test -f hello.txt && grep -q hello hello.txt`
```

Preview + run manual:

```text
/build-loop --dry-run
/build-loop
```

Atau otomatis mengikuti `/pi-next`:

```text
/pi-run-all
```

Cek hasil:

```bash
cat hello.txt
cat .pi-factory/phases/01-create-hello-file/VERIFICATION.md
```

Expected:

```text
hello
```

Dan `VERIFICATION.md` berisi `Status: verified`.

---

## Use Case 2 — SvelteKit: tambah server-side validation pada form

### Goal

Menambahkan validasi server-side pada form profile update di SvelteKit.

### Initial command

```text
/pi-autoplan Add server-side validation to the user profile update form. Validate displayName length, reject empty value, preserve existing UI behavior, and add tests.
```

### Review roadmap

```text
/pi-status
/pi-review .pi-factory/ROADMAP.md
```

### Contoh phase yang bagus

Misal hasil phase:

```text
.pi-factory/phases/01-profile-validation/PLAN.md
```

Isi ideal:

```md
# Phase 01: Profile Validation

## Objective

Add server-side validation for profile update displayName.

## Files to read first

- `.pi-factory/PROJECT.md`
- `.pi-factory/REQUIREMENTS.md`
- `src/routes/profile/+page.server.ts`
- `src/routes/profile/+page.svelte`
- existing test files under `src/routes/profile/` or `tests/`

## Assumptions / locked decisions

- Keep existing UI structure.
- Validation source of truth is server-side action.
- No database schema changes in this phase.

## Tasks

1. Find existing profile update action and tests.
2. Add failing test for empty displayName.
3. Add failing test for displayName max length.
4. Implement minimal validation in server action.
5. Ensure action returns useful form errors.
6. Run verification.

## TDD requirements

- Add/modify tests before implementation.
- Observe failing test before making production changes.

## Verification commands

- `npm test`
- `npm run lint`

## Done criteria

- Empty displayName is rejected.
- Too-long displayName is rejected.
- Valid displayName still updates normally.
- Tests and lint pass.

## Failure handling

- If tests fail, write failing command and output to SUMMARY.md and stop.
```

### Dry run

```text
/build-loop --dry-run
```

### Execute phase

Jika verification sudah tertulis jelas di `PLAN.md`, cukup:

```text
/build-loop
```

Atau override explicit:

```text
/build-loop --verify "npm test && npm run lint"
```

### Review hasil

```text
/pi-status
/pi-review current git diff
```

Lihat evidence:

```bash
cat .pi-factory/phases/01-profile-validation/VERIFICATION.md
cat .pi-factory/phases/01-profile-validation/SUMMARY.md
```

### Jika gagal

Default retry adalah `0` agar agent tidak over-loop. Setelah membaca `SUMMARY.md`/`VERIFICATION.md`, jalankan retry manual bila memang perlu:

```text
/build-loop 1 --retries 1 --verify "npm test && npm run lint"
```

Atau minta decision jika ada tradeoff:

```text
/pi-decide "Should profile validation live inline in +page.server.ts or in a shared schema module?"
```

---

## Use Case 3 — SvelteKit + Prisma: email queue MVP

### Goal

Membangun email queue sederhana dengan Prisma model, enqueue function, dan worker script.

### Start

```text
/pi-autoplan Implement an email queue MVP in this SvelteKit Prisma project. It should enqueue email jobs in the database, support retries, store failure reason, and include tests. Do not send real emails in tests.
```

### Expected phase split

Contoh phase yang bagus:

```text
01-email-queue-schema
02-enqueue-service
03-worker-send-loop
04-admin-observability
```

### Review phase split

```text
/pi-review .pi-factory/ROADMAP.md
```

Pertanyaan decision yang mungkin muncul:

```text
/pi-decide "For MVP should email job status be enum values pending/processing/sent/failed or use timestamps only?"
```

### Phase 1 PLAN example

```md
# Phase 01: Email Queue Schema

## Objective

Add Prisma schema support for queued email jobs without implementing SMTP sending yet.

## Files to read first

- `prisma/schema.prisma`
- existing migration docs/package scripts
- existing tests setup

## Assumptions / locked decisions

- Use a Prisma model named EmailJob.
- Do not connect to SMTP in this phase.
- Store recipient, subject, body/text/html, status, attempts, nextAttemptAt, lastError.

## Tasks

1. Add failing test or schema validation check for EmailJob availability where practical.
2. Update Prisma schema with EmailJob model.
3. Generate migration using project convention.
4. Update seed/test setup only if required.
5. Run Prisma validation and test command.

## TDD requirements

- Prefer test or schema validation command before implementation.
- If migration generation cannot be automated safely, document exact manual command.

## Verification commands

- `npx prisma validate`
- `npm test`

## Done criteria

- Prisma schema validates.
- Migration exists if project uses migrations.
- No SMTP code yet.

## Failure handling

- If Prisma validate fails, write error to SUMMARY.md and stop.
```

### Run phase 1

```text
/build-loop 1 --verify "npx prisma validate && npm test"
```

### Phase 2 PLAN example

```md
# Phase 02: Enqueue Service

## Objective

Add server-side function to enqueue email jobs.

## Files to read first

- `src/lib/server/db.ts`
- existing service patterns under `src/lib/server/`
- `prisma/schema.prisma`
- tests from phase 1

## Tasks

1. Add failing unit test for enqueueEmail creating pending EmailJob.
2. Add failing test for idempotency if required by requirements.
3. Implement `enqueueEmail` service.
4. Ensure no real SMTP send happens.
5. Run tests.

## Verification commands

- `npm test`
- `npx prisma validate`

## Done criteria

- enqueueEmail creates DB job with pending status.
- Tests pass.
```

### Run remaining sequentially

```text
/build-loop --from 2 --max-phases 1
```

Ulangi sampai semua verified. Pakai `--verify` hanya jika perlu override command di `PLAN.md`.

### Final review

```text
/pi-review current git diff
```

---

## Use Case 4 — Bug fix: race condition atau flaky test

### Goal

Memperbaiki flaky test `payment webhook creates duplicate order`.

### Start dengan project artifacts

```text
/pi-new-project Fix flaky payment webhook duplicate order test without changing external API behavior
```

### Create focused phase

```text
/pi-create-phase reproduce and fix duplicate order webhook race
```

### Plan

```text
/pi-plan-phase 1
```

Pastikan plan memaksa reproduksi dulu:

```md
## Tasks

1. Read webhook handler and related tests.
2. Run the flaky test repeatedly to reproduce or inspect failure pattern.
3. Add/adjust a deterministic failing regression test.
4. Implement minimal idempotency/race fix.
5. Run focused test repeatedly.
6. Run broader payment test suite.

## Verification commands

- `npm test -- payment-webhook`
- `for i in {1..5}; do npm test -- payment-webhook || exit 1; done`
```

### Run

```text
/build-loop 1 --verify "for i in {1..5}; do npm test -- payment-webhook || exit 1; done"
```

### If architectural decision needed

```text
/pi-decide "Should duplicate webhook protection use a unique DB constraint or an application-level lock?"
```

---

## Use Case 5 — Refactor aman dengan behavior lock

### Goal

Refactor service lama tanpa mengubah behavior.

### Start

```text
/pi-autoplan Refactor the legacy billing calculation service into smaller modules without changing behavior. Add characterization tests first.
```

### Good plan pattern

```md
## Objective

Refactor billing calculation internals while preserving behavior.

## Tasks

1. Add characterization tests for current behavior.
2. Run tests and confirm baseline pass.
3. Extract pure helper functions one at a time.
4. Keep public API unchanged.
5. Run full relevant tests.

## TDD requirements

- Characterization tests must be added before refactor.
- Do not change expected outputs unless explicitly documented.

## Verification commands

- `npm test -- billing`
- `npm run lint`
```

### Execute one phase at a time

```text
/build-loop
```

### Review

```text
/pi-review current git diff
```

Review checklist:

- Public API unchanged.
- No hidden behavior changes.
- Tests cover legacy behavior.
- Refactor small enough to review.

---

## Use Case 6 — Documentation-only change

### Goal

Menulis dokumentasi setup project.

### Start

```text
/pi-autoplan Create onboarding documentation for local development setup, test commands, environment variables, and common troubleshooting
```

### Execute

Untuk docs-only, TDD tidak selalu relevan. Verification bisa berupa command docs lint atau file existence.

Contoh `PLAN.md`:

```md
## Verification commands

- `test -f docs/local-development.md`
- `grep -q "Environment variables" docs/local-development.md`
```

Run:

```text
/build-loop --verify "test -f docs/local-development.md && grep -q 'Environment variables' docs/local-development.md"
```

---

## Use Case 7 — API endpoint baru

### Goal

Tambah endpoint `GET /api/health`.

### Start

```text
/pi-autoplan Add a GET /api/health endpoint that returns JSON status, version if available, and has tests
```

### Example PLAN

```md
# Phase 01: Health API

## Objective

Add minimal health endpoint.

## Files to read first

- route conventions under `src/routes/api/`
- existing endpoint tests
- package/version config if available

## Tasks

1. Add failing test for GET /api/health returning 200 JSON.
2. Implement endpoint.
3. Include version only if project already has simple source for it.
4. Run tests.

## Verification commands

- `npm test -- health`
- `npm run lint`

## Done criteria

- Endpoint returns 200.
- JSON includes `status: "ok"`.
- Tests pass.
```

Run:

```text
/build-loop 1 --verify "npm test -- health && npm run lint"
```

---

## Use Case 8 — Multi-phase feature dari nol

### Goal

Membangun feature `team invitations`.

### Autoplan

```text
/pi-autoplan Implement team invitations. Owners can invite users by email, pending invitations can be accepted by signed-in users, invitations expire after 7 days, and all behavior must be tested.
```

### Possible phases

```text
01-invitation-schema
02-invite-service
03-accept-invitation-flow
04-ui-invite-management
05-expiry-and-cleanup
```

### Run safe sequential loop

```text
/build-loop --dry-run
/build-loop
/pi-status
/pi-review current git diff
```

Jika phase 1 sudah verified:

```text
/build-loop
```

Repeat.

### Contoh decision points

```text
/pi-decide "Should invitation tokens be stored hashed or plaintext?"
/pi-decide "Should accepting invitation require same email as invited email?"
/pi-decide "Should invitation expiry be enforced in query or background cleanup?"
```

---

## Use Case 9 — Menggunakan `/build-loop --from`

Misal phase 1 sudah verified, phase 2-4 belum.

Preview:

```text
/build-loop --from 2 --max-phases 3 --dry-run
```

Run satu per satu:

```text
/build-loop --from 2 --max-phases 1
```

Run sampai 3 phase sekaligus jika sudah confident:

```text
/build-loop --from 2 --max-phases 3
```

Rekomendasi: untuk codebase besar tetap pakai `--max-phases 1`.

---

## Use Case 10 — Failure recovery

### Situasi

`/build-loop` gagal di phase 2.

### Cek status

```text
/pi-status
```

### Baca evidence

```bash
cat .pi-factory/phases/02-*/SUMMARY.md
cat .pi-factory/phases/02-*/VERIFICATION.md
ls .pi-factory/phases/02-*/CHILD-*.json
```

### Minta review kegagalan

```text
/pi-review .pi-factory/phases/02-name/SUMMARY.md
```

### Perbaiki plan jika terlalu ambigu

```text
/pi-plan-phase 2
```

Atau edit manual `PLAN.md` agar verification jelas dan scope lebih kecil.

### Retry

```text
/build-loop 2 --retries 1 --verify "npm test"
```

### Jika perlu lanjut walau gagal

Tidak direkomendasikan untuk dependent phases, tapi tersedia:

```text
/build-loop --from 2 --max-phases 3 --continue-on-failure --verify "npm test"
```

---

## Use Case 11 — Menjalankan tanpa auto git commit

Jika ingin review manual sebelum commit:

```text
/build-loop --no-checkpoint
```

Lalu cek:

```bash
git diff
git status
```

Jika oke:

```bash
git add -A
git commit -m "implement phase 1"
```

---

## Use Case 12 — Project non-Node

Pi Factory tidak spesifik Node. Verification bisa command apa pun.

### Python

```text
/pi-autoplan Add CSV import validation to this Python project with pytest coverage
/build-loop --verify "pytest"
```

PLAN.md:

```md
## Verification commands

- `pytest`
- `ruff check .`
```

### Go

```text
/pi-autoplan Add health check endpoint to this Go API
/build-loop --verify "go test ./..."
```

PLAN.md:

```md
## Verification commands

- `go test ./...`
```

### Rust

```text
/pi-autoplan Add config parser validation to this Rust CLI
/build-loop --verify "cargo test"
```

PLAN.md:

```md
## Verification commands

- `cargo test`
- `cargo clippy -- -D warnings`
```

---

## Use Case 13 — Menggunakan tool dari prompt biasa

Kamu bisa bertanya ke Pi:

```text
Check Pi Factory status and recommend the next command.
```

Agent dapat memakai tool:

```text
pi_factory_status
```

Untuk queue build-loop dari agent turn:

```text
Run a dry-run build loop for one phase and tell me what would execute.
```

Agent dapat memakai:

```text
pi_build_loop
```

Untuk decision record:

```text
Decide whether to use hashed invitation tokens and save the decision record.
```

Agent dapat memakai:

```text
pi_decision_record
```

---

## Use Case 14 — Human-in-the-loop production workflow

Untuk perubahan penting/production, gunakan pola ini:

```text
/pi-autoplan <feature>
/pi-review .pi-factory/REQUIREMENTS.md
/pi-review .pi-factory/ROADMAP.md
/build-loop --dry-run
/pi-review .pi-factory/phases/01-name/PLAN.md
/build-loop 1 --verify "npm test && npm run lint" --no-checkpoint
/pi-review current git diff
```

Jika review oke:

```bash
git add -A
git commit -m "phase 1: <feature>"
```

Lanjut phase berikutnya:

```text
/build-loop --no-checkpoint
```

---

## Use Case 15 — Menulis ulang ROADMAP secara manual

Kadang autoplan terlalu besar. Kamu bisa edit manual:

```md
# Roadmap

| Phase | Name | Status | Notes |
|---:|---|---|---|
| 01 | add tests for current behavior | planned | Characterization first |
| 02 | implement minimal service | pending | No UI yet |
| 03 | wire UI | pending | Depends on service |
```

Lalu buat phase folder:

```text
/pi-create-phase add tests for current behavior
/pi-create-phase implement minimal service
/pi-create-phase wire UI
```

Plan masing-masing:

```text
/pi-plan-phase 1
/pi-plan-phase 2
/pi-plan-phase 3
```

Run:

```text
/build-loop --from 1 --max-phases 1
```

---

## Checklist Sebelum `/build-loop`

Sebelum automation, pastikan:

- [ ] `.pi-factory/PROJECT.md` jelas.
- [ ] `.pi-factory/REQUIREMENTS.md` punya acceptance criteria.
- [ ] Phase kecil dan focused.
- [ ] `PLAN.md` punya `Verification commands` bukan `TBD`.
- [ ] Git status aman atau pakai branch baru.
- [ ] Sudah dry-run.
- [ ] Untuk perubahan besar, sudah `/pi-review`.

Command final yang aman:

```text
/build-loop --dry-run
/build-loop --no-checkpoint
```

---

## Pattern Command Harian

### Feature baru

```text
/pi-autoplan <feature>
/build-loop --dry-run
/build-loop
```

### Bug fix

```text
/pi-new-project Fix <bug>
/pi-create-phase reproduce and fix <bug>
/pi-plan-phase 1
/build-loop 1 --verify "npm test -- <focused-test>"
```

### Review

```text
/pi-review current git diff
```

### Decision

```text
/pi-decide "Question?"
```

### Status

```text
/pi-status
```
