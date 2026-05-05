# Pi Factory — Dokumentasi Lengkap

Pi Factory adalah workflow automation **Pi-native** yang mengadaptasi metodologi dari pola kerja **GSD + Superpowers + GStack + Build Loop/RalphLoop** ke dalam Pi coding agent.

Tujuannya: membuat kerja coding agent lebih terstruktur, bisa di-resume, punya gate planning/TDD/verifikasi, dan bisa menjalankan fase implementasi secara semi-otomatis lewat child Pi session yang fresh.

> Lokasi extension: `~/.pi/agent/extensions/pi-factory/index.ts`
>
> Status docs: MVP 4 Senior Frontend UX workflow. Default aman saat ini: `maxPhases=1`, `requireCheck=true`, `maxRetries=0`, `maxAgentTurns=20`, `childTimeoutMs=1200000`/20 menit, `childIdleTimeoutMs=300000`/5 menit. UI phase sekarang punya Pi Senior Frontend Default, Frontend Code Quality Standard, design source of truth, `UI-SPEC.md`, sketch workflow, screenshot/code design review, `/pi-frontend-review`, `/pi-design-loop`, build-loop UI/frontend quality gate, dan dashboard TUI.

---

## 1. Ringkasan Konsep

Pi Factory menggabungkan 4 ide utama:

| Inspirasi | Peran di Pi Factory |
|---|---|
| **GSD** | Memecah pekerjaan besar menjadi project artifacts + phase kecil di `.pi-factory/`. |
| **Superpowers** | Disiplin brainstorm → plan → TDD → verification-before-completion. |
| **GStack** | Review dan decision making multi-role: Product, Engineering, Senior Engineer, Design/DX, QA/Security. |
| **Build Loop / RalphLoop** | Automation yang menjalankan fase demi fase melalui fresh child Pi process. |

Pi Factory **bukan copy langsung** dari framework-framework tersebut. Ini port/adaptasi native untuk Pi dengan path dan command sendiri agar tidak bentrok dengan tool lain.

---

## 2. File yang Di-install

### Extension

```text
~/.pi/agent/extensions/pi-factory/index.ts
```

Extension ini mendaftarkan command dan tool Pi Factory.

### Skills

```text
~/.pi/agent/skills/pi-superpowers/SKILL.md
~/.pi/agent/skills/pi-gsd/SKILL.md
~/.pi/agent/skills/pi-gstack/SKILL.md
~/.pi/agent/skills/pi-frontend-ux/SKILL.md
~/.pi/agent/skills/pi-frontend-engineering/SKILL.md
```

Fungsinya:

- `pi-superpowers`: planning, TDD, verification discipline.
- `pi-gsd`: project/phase workflow berbasis `.pi-factory/`.
- `pi-gstack`: multi-role decision/review workflow.
- `pi-frontend-ux`: senior frontend/UI/UX defaults, states, responsive, accessibility, copy, and visual quality gates.
- `pi-frontend-engineering`: senior frontend code quality: components, props/types, state/data flow, forms, styling, performance, security, and tests.

### Prompt templates

```text
~/.pi/agent/prompts/pi-factory-start.md
~/.pi/agent/prompts/pi-status.md
~/.pi/agent/prompts/pi-plan-phase.md
~/.pi/agent/prompts/pi-execute-phase.md
~/.pi/agent/prompts/pi-build-loop.md
~/.pi/agent/prompts/pi-decide.md
~/.pi/agent/prompts/pi-review.md
# Design/operator workflows are registered by the extension commands:
# /pi-dashboard, /pi-next, /pi-design-system, /pi-ui-phase,
# /pi-sketch, /pi-design-review, /pi-dx-review, /pi-ship-review
```

### Persona agents

```text
~/.pi/agent/agents/pi-ceo-product.md
~/.pi/agent/agents/pi-engineering-manager.md
~/.pi/agent/agents/pi-senior-engineer.md
~/.pi/agent/agents/pi-design-dx.md
~/.pi/agent/agents/pi-qa-security.md
```

Persona ini dipakai sebagai referensi role ketika melakukan review/decision ala GStack.

---

## 3. Cara Aktivasi

Pi akan auto-discover extension global dari:

```text
~/.pi/agent/extensions/
```

Jika Pi sudah berjalan sebelum extension dibuat/diubah, jalankan di Pi:

```text
/reload
```

Untuk cek apakah command tersedia, buka Pi di project apa pun lalu jalankan:

```text
/pi-status
```

Jika belum ada project factory, output normalnya:

```text
No .pi-factory directory found. Run /pi-new-project <idea>.
```

---

## 4. Struktur `.pi-factory/`

Setiap project yang memakai Pi Factory akan punya folder:

```text
.pi-factory/
  PROJECT.md
  REQUIREMENTS.md
  ROADMAP.md
  STATE.md
  config.json
  DESIGN.md
  decisions/
  sketches/
    MANIFEST.md
    <sketch-id>/
      index.html
      DECISION.md
  phases/
    01-foundation/
      CONTEXT.md
      PLAN.md
      phase.json
      UI-SPEC.md
      DONE.json
      SUMMARY.md
      VERIFICATION.md
      ui-review/
        UI-REVIEW.md
        screenshots/
      CHILD-*.json
  runs/
    build-loop-*.json
```

### Penjelasan file utama

| File | Fungsi |
|---|---|
| `.pi-factory/PROJECT.md` | Mission, user, non-goals, technical context. |
| `.pi-factory/REQUIREMENTS.md` | Functional/non-functional requirements dan acceptance criteria. |
| `.pi-factory/ROADMAP.md` | Daftar fase, status, dan notes. |
| `.pi-factory/STATE.md` | Log status phase dan event penting. |
| `.pi-factory/config.json` | Default config untuk automation. |
| `.pi-factory/DESIGN.md` | Design source of truth; seeded from `~/.pi/agent/design/SENIOR_FRONTEND_DEFAULT.md` when user gives no visual detail: personality, typography, color, spacing, components, copy, accessibility. |
| `.pi-factory/sketches/*` | Throwaway HTML design explorations dan decision notes dari `/pi-sketch`. |
| `.pi-factory/decisions/*.md` | Decision record hasil `/pi-decide` atau tool `pi_decision_record`. |
| `.pi-factory/phases/*/CONTEXT.md` | Context, decisions, existing patterns, open questions untuk fase. |
| `.pi-factory/phases/*/PLAN.md` | Rencana eksekusi fase, tasks, TDD, verification commands. |
| `.pi-factory/phases/*/phase.json` | Contract machine-readable opsional untuk fase. |
| `.pi-factory/phases/*/UI-SPEC.md` | UI/UX design contract untuk phase yang menyentuh user-facing UI. |
| `.pi-factory/phases/*/DONE.json` | Done protocol machine-readable yang ditulis child executor. |
| `.pi-factory/phases/*/SUMMARY.md` | Ringkasan hasil child Pi execution. |
| `.pi-factory/phases/*/VERIFICATION.md` | Evidence command verifikasi dari parent process. |
| `.pi-factory/phases/*/ui-review/UI-REVIEW.md` | 6-pillar visual audit + screenshot/code evidence dari `/pi-design-review`. |
| `.pi-factory/phases/*/CHILD-*.json` | Log ringkas child Pi JSON run. |
| `.pi-factory/runs/build-loop-*.json` | Run log build-loop per eksekusi. |

---

## 5. Lifecycle Phase

Status yang dikenali:

```text
pending
context-ready
planned
running
blocked
failed
verified
done
```

Alur normal:

```text
pending/context-ready → planned → running → verified
```

Atau jika gagal:

```text
planned → running → failed
planned → running → blocked
```

Phase dianggap executable jika:

1. Ada folder di `.pi-factory/phases/`.
2. Ada `PLAN.md`.
3. Status belum `verified` atau `done`.

### Status dari `DONE.json`

Pi Factory membaca `DONE.json` sebagai done protocol machine-readable. Ini mencegah false verified ketika child executor sudah jujur bilang blocked/failed tetapi command generic seperti `npm run build` tetap pass.

Rule veto:

```text
DONE.json status failed      -> phase failed
DONE.json status blocked     -> phase blocked
readyForParentVerification false -> phase blocked
```

Jadi parent verification tetap authoritative untuk command evidence, tetapi **tidak boleh mengubah explicit child block/fail menjadi verified**.

---

## 6. Command Reference

### 6.0 UI/UX and operator cockpit commands

Pi Factory v3 menambahkan lapisan design workflow yang diadaptasi dari GSD UI-SPEC/sketch, GStack design review/shotgun/DX review, dan Superpowers visual companion discipline.

| Command | Fungsi |
|---|---|
| `/pi-dashboard` | Pi-native interactive dashboard: pilih phase, dry-run, plan, design review, next action. |
| `/pi-next` | Menampilkan next best action berdasarkan `.pi-factory` state. |
| `/pi-auto-next [--execute]` | Menjalankan rekomendasi `/pi-next` satu langkah; `--execute` melewati dry-run dan langsung eksekusi phase yang ready. |
| `/pi-auto-plan <goal>` | Alias autoplan yang diarahkan ke flow satu-command berikutnya: setelah plan selesai, jalankan `/pi-run-all`. |
| `/pi-run-all [--max-phases N] [--max-steps N]` / `/run-all` | Mengikuti `/pi-next` otomatis dan menjalankan build-loop phase demi phase sampai selesai atau blocked. |
| `/pi-factory-wizard` | Guided setup untuk project/phase, termasuk opsi UI/UX. |
| `/pi-design-system [context]` | Membuat/update `.pi-factory/DESIGN.md` sebagai design source of truth. |
| `/pi-ui-phase [phase]` | Membuat/update `UI-SPEC.md` untuk phase user-facing UI. |
| `/pi-sketch <idea>` | Membuat throwaway HTML sketch 2-3 variant di `.pi-factory/sketches/`. |
| `/pi-design-review [phase] [--url URL] [--fix] [--waive]` | 6-pillar UI audit dengan screenshot Playwright bila URL tersedia, fallback code heuristics bila tidak. |
| `/pi-frontend-review [phase] [--fix] [--waive] [--min-score N]` | Senior frontend code quality audit: architecture, state, types, styling, performance, security, testing. |
| `/pi-design-loop [phase] [--url URL] [--max-iterations N]` | RalphLoop-style UI loop: review → focused fix → re-review sampai pass atau iterasi habis. |
| `/pi-dx-review [target]` | Developer experience audit prompt: onboarding, docs, CLI/API, errors, TTHW. |
| `/pi-ship-review` | Final product/engineering/design/QA release gate. |

Recommended one-command flow:

```text
/pi-auto-plan <goal>
# setelah autoplan selesai membuat .pi-factory/phases
/pi-run-all
```

Manual UI phase flow masih tersedia:

```text
/pi-design-system "brand/product direction"
/pi-ui-phase 1
/build-loop 1
/pi-frontend-review 1
/pi-design-review 1 --url http://localhost:5173
# atau auto-iterate visual fixes
/pi-design-loop 1 --url http://localhost:5173 --max-iterations 2
/pi-ship-review
```

Ship gate default untuk frontend/UI: setiap pillar `/pi-frontend-review` dan `/pi-design-review` minimal `3/4`, kecuali ada waiver eksplisit via decision record. `/build-loop` sekarang dapat menjalankan frontend engineering + UI quality gate otomatis untuk phase UI.

### 6.1 `/pi-new-project`

Inisialisasi `.pi-factory/` dan meminta Pi membantu refine project spec.

```text
/pi-new-project <idea>
```

Contoh:

```text
/pi-new-project Build a SvelteKit notification center with email queue
```

Efek:

- Membuat `.pi-factory/PROJECT.md`.
- Membuat `.pi-factory/REQUIREMENTS.md`.
- Membuat `.pi-factory/ROADMAP.md`.
- Membuat `.pi-factory/STATE.md`.
- Membuat `.pi-factory/config.json`.
- Mengirim prompt ke agent untuk refine spec.
- Tidak langsung implementasi kode.

---

### 6.2 `/pi-autoplan`

Autoplan end-to-end: brainstorm, product review, engineering review, QA review, lalu menyusun artifacts dan phase.

```text
/pi-autoplan <idea atau goal>
```

Alias:

```text
/pi-factory-start <idea atau goal>
```

Contoh:

```text
/pi-autoplan Add password reset with OTP email, rate limiting, and audit logs
```

Output yang diharapkan:

- `.pi-factory/PROJECT.md` diperbarui.
- `.pi-factory/REQUIREMENTS.md` diperbarui.
- `.pi-factory/ROADMAP.md` diperbarui.
- Phase kecil dibuat di `.pi-factory/phases/`.
- Agent tidak langsung coding.

---

### 6.3 `/pi-create-phase`

Membuat scaffold phase manual.

```text
/pi-create-phase <phase name>
```

Contoh:

```text
/pi-create-phase foundation database schema
```

Efek:

```text
.pi-factory/phases/01-foundation-database-schema/CONTEXT.md
.pi-factory/phases/01-foundation-database-schema/PLAN.md
```

Phase juga ditambahkan ke `ROADMAP.md` dan `STATE.md`.

---

### 6.4 `/pi-plan-phase`

Meminta Pi membuat/merapikan `PLAN.md` untuk satu phase.

```text
/pi-plan-phase [phase number | phase slug | new phase name]
```

Contoh memakai phase yang sudah ada:

```text
/pi-plan-phase 1
```

Contoh membuat phase baru sekaligus planning:

```text
/pi-plan-phase add server side validation and tests
```

Gate penting:

- Command ini hanya planning.
- Tidak boleh implementasi production code.
- `PLAN.md` harus berisi verification commands yang jelas.

---

### 6.5 `/pi-execute-phase`

Menjalankan satu phase via fresh child Pi session.

```text
/pi-execute-phase [phase] [--verify "<command>"]
```

Contoh:

```text
/pi-execute-phase 1 --verify "npm test"
```

Secara internal ini memanggil build-loop untuk satu phase:

```text
/build-loop <phase> --max-phases 1
```

---

### 6.6 `/build-loop`

Automation utama. Menjalankan phase executable secara sequential melalui child Pi process, lalu parent menjalankan verification command.

```text
/build-loop [phase] [options]
```

Alias:

```text
/pi-build-loop [phase] [options]
```

Default:

```text
/build-loop
```

Artinya menjalankan 1 phase berikutnya yang belum verified/done.

#### Options

| Option | Fungsi |
|---|---|
| `--dry-run` | Tampilkan phase yang akan dijalankan tanpa eksekusi. |
| `--max-phases N` | Maksimum phase yang dijalankan dalam satu run. Default `1`. |
| `--max N` | Alias internal untuk `--max-phases`. |
| `--from N` | Mulai dari phase nomor N ke atas. |
| `--phase N` | Jalankan phase tertentu. |
| `--verify "<cmd>"` | Override verification command. |
| `--retries N` | Retry count per phase. Default `0`. |
| `--no-checkpoint` | Jangan membuat git commit checkpoint. |
| `--continue-on-failure` | Lanjut phase berikutnya walau phase sekarang gagal. Tidak direkomendasikan untuk dependent phases. |
| `--child-timeout-ms N` | Timeout total child Pi process. Default `1200000` ms / 20 menit. |
| `--child-idle-timeout-ms N` | Timeout jika child tidak mengeluarkan output. Default `300000` ms / 5 menit. |
| `--max-agent-turns N` | Stop child jika terlalu banyak assistant turns tanpa final answer. Default `20`. |
| `--verify-timeout-ms N` | Timeout verification command. Default `600000` ms / 10 menit. |
| `--tools list` | Override tools child Pi. Default `read,bash,edit,write`. |
| `--require-check` | Wajibkan readiness checker pass sebelum child jalan. Default aktif via config/default. |
| `--allow-dangerous-verify` | Override detector command verifikasi berbahaya. |
| `--allow-protected-changes` | Override safety audit protected paths. |
| `--allow-large-diff` | Override batas max changed files / diff lines. |

Contoh:

```text
# Preview next executable phase; tidak edit file.
/build-loop --dry-run

# Execute one next phase with safe defaults.
/build-loop

# Execute all remaining phases sequentially, stopping on first blocked/failed phase.
/build-loop --max-phases 6

# Start from phase 2, run at most 3 sequential executable phases.
/build-loop --from 2 --max-phases 3

# Execute phase 2 only with explicit verification override.
/build-loop 2 --verify "npm test"

# Retry override when needed; default is 0.
/build-loop --max-phases 2 --retries 2 --verify "npm run test && npm run lint"

# No git commit checkpoint.
/build-loop --max-phases 1 --no-checkpoint
```

Best-practice sequence:

```text
/reload
/pi-status
/build-loop --dry-run
/build-loop
```

Untuk all phases berurutan:

```text
/build-loop --dry-run --max-phases 6
/build-loop --max-phases 6
```

Build-loop akan skip phase yang sudah `verified`/`done`, lalu mulai dari executable phase pertama. Jika ada phase `blocked`/`failed`, run berhenti kecuali memakai `--continue-on-failure`.

---

### 6.7 `/pi-factory-check`

Readiness checker deterministik untuk satu phase.

```text
/pi-factory-check [phase]
/pi-check [phase]
```

Cek yang dilakukan:

- `CONTEXT.md` dan `PLAN.md` ada.
- Section wajib ada.
- Objective/tasks/done criteria tidak masih `TBD`.
- Verification command valid dan bisa diekstrak.

Gunakan bersama build-loop:

```text
/pi-factory-check 1
/build-loop 1
```

`requireCheck` aktif secara default, jadi `/build-loop` akan block sebelum child jalan jika `PLAN.md` belum siap.

---

### Structured verification

Format yang direkomendasikan di `PLAN.md`:

```yaml
verification:
  - command: npm test
    required: false
    skip_if_missing_npm_script: test
  - command: npm run build
    required: true
    timeoutMs: 600000
```

Untuk command pencarian yang expected pass ketika **tidak ada match**, jangan pakai `rg pattern ...` langsung karena `rg` exit `1` saat no matches. Wrap menjadi command yang mengembalikan `0` untuk kondisi aman:

```bash
if rg "\\$lib/server|@prisma/client|PrismaClient" src --glob "*.svelte"; then exit 1; else exit 0; fi
```

Artinya: kalau server-only import ditemukan di `.svelte`, verification gagal; kalau tidak ditemukan, verification pass.

Masih didukung juga:

- inline backtick: ``- `npm test` ``
- fenced shell block
- Markdown table `Command | Required | Timeout`

---

### 6.8 `/pi-status`

Menampilkan status `.pi-factory/`.

```text
/pi-status
```

Alias:

```text
/pi-factory-status
```

Output berisi:

- Root `.pi-factory`.
- Progress phase.
- Apakah `.pi-factory/DESIGN.md` ada.
- Table phase.
- Status setiap phase.
- Apakah `PLAN.md` ada.
- Apakah `CONTEXT.md` ada.
- Apakah `UI-SPEC.md` ada/relevan.
- Next executable phase.
- Next recommended command dari `/pi-next`.

---

### 6.9 `/pi-decide`

Decision workflow ala GStack dengan role multi-perspective.

```text
/pi-decide "<question>"
```

Contoh:

```text
/pi-decide "Should password reset OTP be stored hashed in DB or encrypted?"
```

Output expected:

```text
# Decision: ...

## Final recommendation
## Votes
## Risks
## Dissent / tradeoffs
## Action items
## Revisit trigger
```

Gunakan ini ketika:

- Ada tradeoff product vs engineering.
- Ada keputusan security/architecture.
- Ada pertanyaan saat phase execution.
- Ada scope creep.

---

### 6.10 `/pi-review`

Review plan/diff/artifact dengan multi-role perspective.

```text
/pi-review [subject]
```

Contoh:

```text
/pi-review .pi-factory/phases/01-foundation/PLAN.md
/pi-review current git diff before running build-loop
/pi-review authentication flow implementation
```

Output expected:

```text
# Review
## Executive summary
## Must fix before execution/ship
## Should fix / simplify
## QA checklist
## Verification gate
```

---


### Senior Frontend Code Quality

Pi now also carries a persistent frontend engineering standard:

```text
~/.pi/agent/design/FRONTEND_CODE_QUALITY.md
```

Rule: when a phase touches frontend code, Pi applies this standard so the code is senior-grade, not only the UI appearance. It covers component boundaries, props/types, state/data flow, forms, styling discipline, accessibility implementation, performance, security, and testing.

Command:

```text
/pi-frontend-review <phase>
```

### Senior Frontend Default

Pi now carries a global default design that sticks across projects:

```text
~/.pi/agent/design/SENIOR_FRONTEND_DEFAULT.md
```

Rule: when the user asks for frontend/UI/UX work but gives no detailed visual direction, Pi applies this default instead of leaving design as TBD. Project-local `.pi-factory/DESIGN.md` and phase `UI-SPEC.md` can override it.

Default characteristics: calm, clear, premium-but-not-flashy, restrained accent, 4px spacing grid, responsive mobile/tablet/desktop behavior, accessible controls, polished loading/empty/error/success/disabled/hover/focus states, and outcome-based copy.

### 6.11 Design/UI command details

#### `/pi-dashboard`

Interactive TUI cockpit untuk operator. Command ini membuka overlay, bukan menulis artifact besar.

```text
/pi-dashboard
```

Keys:

| Key | Action |
|---|---|
| `↑/↓` | Pilih phase. |
| `Enter` | Queue `/build-loop <phase> --dry-run`. |
| `p` | Queue `/pi-plan-phase <phase>`. |
| `d` | Queue `/pi-design-review <phase>`. |
| `r` | Queue `/pi-review current git diff`. |
| `n` | Queue next recommended action. |
| `s` | Queue `/pi-status`. |
| `q` / `Esc` | Close overlay. |

#### `/pi-next`

Menampilkan command berikutnya yang paling masuk akal berdasarkan state:

```text
/pi-next
```

Routing umum:

```text
no .pi-factory      -> /pi-autoplan <goal>
UI project no design -> /pi-design-system
no phases           -> /pi-create-phase <name>
phase not planned   -> /pi-plan-phase <phase>
UI phase no spec    -> /pi-ui-phase <phase>
ready phase         -> /build-loop <phase> --dry-run
all done            -> /pi-review current git diff or /pi-ship-review
```

#### `/pi-auto-next`, `/pi-auto-plan`, `/pi-run-all`

Untuk mengurangi command manual:

```text
/pi-auto-plan <goal>
/pi-run-all
```

- `/pi-auto-plan` membuat/refine `.pi-factory` project, roadmap, phase plan, design/code-quality gate.
- `/pi-auto-next` menjalankan rekomendasi `/pi-next` satu langkah.
- `/pi-run-all` menjalankan planning/design child jika masih dibutuhkan, lalu menjalankan executable phase otomatis mengikuti `/pi-next` sampai semua phase verified/done atau ada blocker.
- Jika tidak ada `.pi-factory` dan goal tidak diberikan ke `/pi-run-all`, command akan stop dan meminta `/pi-auto-plan <goal>` dulu.

Options:

```text
/pi-run-all --max-phases 3
/pi-run-all --max-steps 20
/pi-auto-next --execute
```

#### `/pi-design-system`

Membuat atau memperbarui source of truth design:

```text
/pi-design-system [context]
```

Artifact:

```text
.pi-factory/DESIGN.md
```

Isi yang diharapkan:

- Product personality.
- Audience and UX principles.
- Visual direction.
- Typography.
- Color system.
- Spacing/layout rules.
- Components and states.
- Copywriting voice.
- Accessibility requirements.
- Design review gates.

#### `/pi-ui-phase`

Membuat/memperbarui design contract per phase:

```text
/pi-ui-phase [phase number | phase slug]
```

Artifact:

```text
.pi-factory/phases/NN-slug/UI-SPEC.md
```

`UI-SPEC.md` wajib untuk phase yang menyentuh user-facing UI. Isinya harus cukup konkret agar child executor tidak menebak desain:

- Screens/routes/components.
- User flow.
- Visual hierarchy.
- Copy/content requirements.
- States: loading, empty, error, success, disabled, hover/focus.
- Responsive breakpoints.
- Accessibility acceptance criteria.
- Screenshot checkpoints.
- UI acceptance criteria.

#### `/pi-sketch`

Membuat throwaway HTML design variants untuk eksplorasi sebelum implementation:

```text
/pi-sketch <idea>
```

Artifacts:

```text
.pi-factory/sketches/MANIFEST.md
.pi-factory/sketches/<timestamp-slug>/index.html
.pi-factory/sketches/<timestamp-slug>/DECISION.md
```

Gunakan saat desain masih ambigu, misalnya dashboard layout, onboarding flow, pricing page, atau empty state.

#### `/pi-design-review`

Menjalankan 6-pillar UI audit:

```text
/pi-design-review [phase] [--url URL] [--fix] [--waive]
```

Options:

| Option | Fungsi |
|---|---|
| `--url URL` | Live app URL untuk screenshot desktop/tablet/mobile via Playwright. |
| `--fix` | Jika blocked, queue prompt untuk focused visual/copy/accessibility fix. |
| `--waive` | Mark gate accepted walau score rendah; sebaiknya setelah `/pi-decide` mencatat tradeoff. |

Artifact phase:

```text
.pi-factory/phases/NN-slug/ui-review/UI-REVIEW.md
.pi-factory/phases/NN-slug/ui-review/screenshots/desktop.png
.pi-factory/phases/NN-slug/ui-review/screenshots/tablet.png
.pi-factory/phases/NN-slug/ui-review/screenshots/mobile.png
```

Jika tidak ada `--url` dan tidak ada server lokal terdeteksi, review tetap jalan sebagai code-only heuristic audit. Untuk UI ship gate yang serius, pakai live URL.

Score gate:

| Pillar | Meaning |
|---|---|
| Copywriting | Clarity, microcopy, helpful labels, empty/error text. |
| Visuals | Hierarchy, composition, scannability, perceived polish. |
| Color | Semantic colors, contrast, restraint, theme consistency. |
| Typography | Scale, rhythm, readability, headings/body balance. |
| Spacing | Layout, density, alignment, responsive spacing. |
| Interaction | Focus/hover/disabled/loading states, keyboard/responsive/accessibility. |

Default ship rule:

```text
each pillar >= 3/4, unless explicit waiver
```

#### `/pi-dx-review`

Developer-experience audit:

```text
/pi-dx-review [target]
```

Expected output artifact:

```text
.pi-factory/DX-REVIEW.md
```

Review dimensions:

- First-run setup.
- Docs clarity.
- CLI/API ergonomics.
- Error messages.
- Local dev loop.
- Onboarding time-to-hello-world.
- Upgrade/deploy path.

#### `/pi-ship-review`

Final multi-role release gate:

```text
/pi-ship-review [target]
```

Checks:

- Requirements coverage.
- Roadmap/phase status.
- Verification evidence.
- UI/DX review evidence.
- Security/safety risk.
- Docs/release notes readiness.

Expected output is `PASS` or `BLOCK` with exact must-fix list.

---

## 7. Tool Reference

Extension juga mendaftarkan tools yang bisa dipanggil agent di dalam turn.

### 7.1 `pi_factory_status`

Inspect status phase.

Input:

```json
{}
```

Output:

- Markdown status.
- Detail phases di `details`.

---

### 7.2 `pi_decision_record`

Menyimpan decision record ke:

```text
.pi-factory/decisions/*.md
```

Input:

```json
{
  "title": "Decision title",
  "content": "# Decision markdown..."
}
```

---

### 7.3 `pi_build_loop`

Tool untuk queue build-loop dari dalam agent turn.

Input:

```json
{
  "phase": "1",
  "maxPhases": 1,
  "verify": "npm test",
  "dryRun": false,
  "retries": 0
}
```

Catatan: untuk long-running automation, agent sebaiknya minta izin user dulu.

---

## 8. Verification Model

Pi Factory memakai prinsip:

> Parent-side verification is authoritative, with DONE.json veto.

Artinya:

- Child Pi boleh menulis kode, test, summary, verification file.
- Status final phase terutama ditentukan oleh parent process yang menjalankan verification command.
- Jika verification command exit `0`, phase dapat ditandai `verified` walaupun child Pi sempat timeout setelah perubahan valid.
- Namun `DONE.json` bisa veto status: `status: blocked`, `status: failed`, atau `readyForParentVerification: false` akan menahan phase sebagai `blocked/failed` walaupun command generic pass.
- Jika tidak ada verification command, status sukses bergantung pada child exit code, tapi ini tidak direkomendasikan untuk code behavior changes.

### Cara Pi Factory menemukan verification command

Urutan:

1. Jika user memberi `--verify "<cmd>"`, command itu dipakai.
2. Jika tidak, Pi Factory membaca section verification di `PLAN.md`.
3. Command dalam backtick akan diekstrak, contoh:

```md
## Verification commands

- `npm test`
- `npm run lint`
```

4. Command `TBD` diabaikan.

### Rekomendasi

Selalu isi `PLAN.md` dengan command eksplisit:

```md
## Verification commands

- `npm test`
- `npm run lint`
```

Atau override saat run:

```text
/build-loop --verify "npm test"
```

---

## 9. TDD Gate

Untuk behavior/code changes, child executor diberi instruksi wajib:

1. Baca project artifacts dan phase plan.
2. Review plan.
3. Jika behavior berubah, tulis failing test dulu.
4. Jalankan test dan observasi fail.
5. Implement minimum code.
6. Jalankan test sampai pass.
7. Refactor bila perlu.
8. Tulis summary dan verification evidence.

Jangan mengklaim selesai tanpa fresh verification evidence.

---

## 10. Git Checkpoint

Jika project adalah git repository, setelah phase verified Pi Factory akan mencoba:

```bash
git add -A
git commit -m "pi-factory: phase NN slug"
```

Jika repo tidak menggunakan git, checkpoint dilewati aman.

Untuk mematikan checkpoint:

```text
/build-loop --no-checkpoint
```

Saran sebelum menjalankan automation besar:

```bash
git status
git commit -am "checkpoint before pi factory" || true
```

Atau jalankan di branch baru.

---

## 11. `config.json`

Pi Factory membaca `.pi-factory/config.json` pada runtime. Precedence:

```text
CLI flags > .pi-factory/config.json > extension defaults
```

Default MVP 3:

```json
{
  "version": 3,
  "verifyCommand": "",
  "childTimeoutMs": 1200000,
  "childIdleTimeoutMs": 300000,
  "verifyTimeoutMs": 600000,
  "maxRetries": 0,
  "maxAgentTurns": 20,
  "requireCheck": true,
  "checkpoint": true,
  "stopOnFailure": true,
  "allowDirtyStart": true,
  "defaultChildTools": "read,bash,edit,write",
  "protectedPaths": [".env", ".env.*", ".git/**", "node_modules/**", "dist/**", "build/**"],
  "maxChangedFiles": 40,
  "maxDiffLines": 2000
}
```

Rekomendasi project config aman:

```json
{
  "version": 3,
  "verifyCommand": "",
  "childTimeoutMs": 1200000,
  "childIdleTimeoutMs": 300000,
  "verifyTimeoutMs": 600000,
  "maxRetries": 0,
  "maxAgentTurns": 20,
  "requireCheck": true,
  "checkpoint": true,
  "stopOnFailure": true,
  "allowDirtyStart": true
}
```

Jika config invalid JSON, `/build-loop` berhenti dengan pesan jelas.

---

## 12. Recommended Workflow

### Workflow aman untuk feature baru

```text
/pi-autoplan <feature idea>
/pi-status
/pi-review .pi-factory/ROADMAP.md
/build-loop --dry-run
/build-loop
/pi-status
```

Jika phase 1 verified:

```text
/build-loop
```

Ulangi sampai semua phase verified.

---

### Workflow manual dengan planning gate ketat

```text
/pi-new-project <idea>
/pi-create-phase foundation
/pi-plan-phase 1
/pi-review .pi-factory/phases/01-foundation/PLAN.md
/build-loop 1 --dry-run
/build-loop 1
```

---

### Workflow UI/UX feature

```text
/pi-autoplan <UI improvement goal>
/pi-design-system <product feel and visual direction>
/pi-create-phase <small UI phase>
/pi-ui-phase 1
/pi-sketch <screen or flow idea>
/pi-plan-phase 1
/build-loop 1 --dry-run
/build-loop 1
/pi-frontend-review 1
/pi-design-review 1 --url http://localhost:5173
# atau auto-iterate visual fixes
/pi-design-loop 1 --url http://localhost:5173 --max-iterations 2
/pi-ship-review
```

Gunakan `/pi-next` atau `/pi-dashboard` jika bingung next action.

---

### Workflow decision saat stuck

```text
/pi-decide "Should this use a queue table or direct SMTP send?"
```

Lalu simpan keputusan penting ke `.pi-factory/decisions/` jika agent memakai tool `pi_decision_record`, atau copy manual hasilnya.

---

## 13. Cara Menulis `PLAN.md` yang Bagus

Template minimal:

```md
# Phase 01: Foundation

## Objective

Implement minimal foundation for X.

## Files to read first

- `.pi-factory/PROJECT.md`
- `.pi-factory/REQUIREMENTS.md`
- `src/lib/server/...`

## Assumptions / locked decisions

- Use existing auth/session pattern.
- Do not change public API outside this phase.

## Tasks

1. Add failing test for expected behavior.
2. Implement minimal schema/helper/service.
3. Wire route/action/API.
4. Add error handling.
5. Update docs if needed.

## TDD requirements

- For behavior changes, create or update test first.
- Observe failing test before implementation.

## Verification commands

- `npm test`
- `npm run lint`

## Done criteria

- Tests pass.
- Feature behavior matches acceptance criteria.
- No unrelated refactor.

## Failure handling

- If verification fails, write failure details in SUMMARY.md and stop.
```

Tips:

- Jangan biarkan verification command `TBD`.
- Hindari phase terlalu besar.
- Satu phase sebaiknya punya objective tunggal.
- Masukkan file yang wajib dibaca.
- Masukkan non-goals supaya child Pi tidak melebar.

---

## 14. Best Practices

1. **Selalu mulai dengan `/build-loop --dry-run`.**
2. **Jangan run terlalu banyak phase sekaligus di awal.** Default `maxPhases=1`; untuk all phases pakai `--max-phases N` setelah dry-run.
3. **Gunakan verification command eksplisit/structured di PLAN.md.**
4. **Gunakan git branch/checkpoint.** Commit baseline agar safety audit tidak menghitung semua file sebagai changed/untracked.
5. **Review plan sebelum execution:**

```text
/pi-review .pi-factory/phases/01-name/PLAN.md
```

6. **Pakailah `/pi-decide` untuk tradeoff besar.**
7. **Jaga phase kecil.** Jika phase terasa besar, pecah lagi.
8. **Jangan percaya klaim agent tanpa verification output.** Lihat `VERIFICATION.md`.
9. **Jika child timeout tapi verification pass, itu acceptable** selama `DONE.json` tidak veto.
10. **Kalau verification tidak ada, tambahkan dulu.**
11. **Jika child menulis `DONE.json` blocked/failed, jangan override dengan build generic.** Perbaiki phase penyebabnya.

---

## 15. Troubleshooting

### Command tidak ditemukan

Jalankan:

```text
/reload
```

Pastikan file ada:

```text
~/.pi/agent/extensions/pi-factory/index.ts
```

### `/pi-status` bilang belum ada `.pi-factory`

Normal untuk project baru. Jalankan:

```text
/pi-new-project <idea>
```

atau:

```text
/pi-autoplan <idea>
```

### `/build-loop --dry-run` bilang tidak ada executable phases

Kemungkinan:

- Belum ada folder `.pi-factory/phases/*`.
- Belum ada `PLAN.md`.
- Semua phase sudah `verified`/`done`.

Solusi:

```text
/pi-create-phase <name>
/pi-plan-phase <phase>
```

### Verification status `no-command`

`PLAN.md` belum punya command valid.

Tambahkan:

```md
## Verification commands

- `npm test`
```

Atau run:

```text
/build-loop --verify "npm test"
```

### Child exit code `124`

`124` berarti child process timeout. Jika parent verification command pass, phase tetap dapat dianggap verified. Cek:

```text
.pi-factory/phases/*/VERIFICATION.md
.pi-factory/phases/*/CHILD-*.json
```

### Git checkpoint gagal

Cek:

```bash
git status
git log --oneline -5
```

Jika tidak mau auto commit:

```text
/build-loop --no-checkpoint
```

### Agent mengerjakan terlalu banyak

Perketat `PLAN.md`:

- Tambahkan non-goals.
- Batasi file yang boleh diubah.
- Pecah phase.
- Jalankan satu phase saja:

```text
/build-loop 1 --max-phases 1
```

### Test lama

Naikkan timeout:

```text
/build-loop --verify "npm test" --verify-timeout-ms 1800000
```

### Phase failed/blocked karena `Changed files ... exceeds maxChangedFiles`

Ini berasal dari safety audit. Penyebab umum:

- Repo baru belum pernah commit, sehingga semua file muncul `?? untracked`.
- Child mengubah terlalu banyak file untuk satu phase.
- Generated output tidak di-ignore.

Solusi terbaik untuk repo baru:

```bash
git add -A
git commit -m "baseline before pi factory run"
```

Lalu ulangi:

```text
/build-loop <phase>
```

Jika kamu sudah review diff dan yakin aman, override manual:

```text
/build-loop <phase> --allow-large-diff
```

### `rg` exit `1` pada negative search

`rg` exit `1` berarti no matches. Untuk verification yang berharap tidak ada match, wrap command:

```bash
if rg "\\$lib/server|@prisma/client|PrismaClient" src --glob "*.svelte"; then exit 1; else exit 0; fi
```

### `No executable phase found for N`

Artinya phase N dianggap `verified`/`done` atau tidak ditemukan. Cek:

```text
/reload
/pi-status
```

Jika status salah karena artifact lama, cek `DONE.json`, `SUMMARY.md`, `VERIFICATION.md`, `STATE.md`, dan `ROADMAP.md` pada phase terkait.

---

## 16. Limitasi MVP Saat Ini

Yang sudah ada:

- Project artifacts.
- Phase planning.
- Sequential build-loop.
- Fresh child Pi process.
- Parent verification.
- Config loader dengan precedence CLI > config > defaults.
- Readiness checker dan default `requireCheck=true`.
- Structured verification extraction.
- Child timeout, idle timeout, dan max-turn guard.
- `DONE.json` done protocol + veto blocked/failed.
- Safety audit protected paths, max changed files, max diff lines.
- Dangerous verification command detector.
- Retry configurable, default `0`.
- Run logs.
- Git checkpoint.
- GStack-style review/decision.
- Design source of truth `.pi-factory/DESIGN.md`.
- Phase UI contract `UI-SPEC.md`.
- Throwaway HTML sketch workflow.
- Screenshot/code 6-pillar UI review.
- DX and ship-review prompts.
- Pi-native dashboard overlay and next-action router.

Yang belum masuk / masih future:

- Parallel phase execution.
- Git worktree per phase.
- Auto merge/conflict resolution.
- Wave scheduling.
- Persistent taste/design memory beyond Markdown artifacts.
- True before/after pixel visual diff engine.
- Browser-driven accessibility audit beyond screenshot/code heuristic.
- Deep persona subagent orchestration.

Itu masuk kandidat setelah MVP 3 baseline.

---

## 17. Quick Cheat Sheet

```text
# Start project
/pi-autoplan Build X

# Show status / cockpit
/pi-status
/pi-next
/pi-dashboard

# Create/plan manually
/pi-create-phase foundation
/pi-plan-phase 1

# UI/design workflow
/pi-design-system Product should feel calm, fast, and trustworthy
/pi-ui-phase 1
/pi-sketch dashboard layout alternatives
/pi-frontend-review 1
/pi-design-review 1 --url http://localhost:5173

# Review before execution
/pi-review .pi-factory/phases/01-foundation/PLAN.md

# Preview automation
/build-loop --dry-run

# Execute one next phase with safe defaults
/build-loop

# Execute phase 2 only
/build-loop 2

# Continue from phase 2, max 3 phases
/build-loop --from 2 --max-phases 3

# Execute all remaining phases sequentially, stopping on first blocked/failed
/build-loop --max-phases 6

# Retry more aggressively; default retries is 0
/build-loop --max-phases 1 --retries 2

# Override verification when needed
/build-loop --verify "npm test"

# No git commit
/build-loop --no-checkpoint

# Decision
/pi-decide "Should we use SQLite or Postgres for MVP?"

# Review
/pi-review current git diff
/pi-dx-review
/pi-ship-review
```

---

## 18. Baca Juga

Contoh use case detail tersedia di:

```text
~/.pi/agent/extensions/pi-factory/USECASES.md
```

Rekomendasi next enhancements tersedia di:

```text
~/.pi/agent/extensions/pi-factory/NEXT_ENHANCEMENTS.md
```
