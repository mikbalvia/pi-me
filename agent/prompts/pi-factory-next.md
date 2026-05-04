# Pi Factory Next Enhancements

Tampilkan ringkasan rekomendasi next enhancements Pi Factory dan arahkan user ke file lengkap:

- `~/.pi/agent/extensions/pi-factory/NEXT_ENHANCEMENTS.md`

Rekomendasi urutan implementasi:

1. MVP 2.1 Hardening
   - config loader dari `.pi-factory/config.json`
   - `/pi-factory-check`
   - `/pi-factory-docs`
   - `/pi-factory-next`
   - better verification extraction
   - dirty start warning
   - protected path diff audit

2. Resume & Report
   - `.pi-factory/RUNNING.lock`
   - `/pi-factory-resume`
   - `/pi-factory-unlock`
   - `/pi-factory-report`
   - JSONL event log

3. Worktree Sequential
   - `/build-loop --worktree`
   - worktree cleanup
   - merge policy
   - keep worktree on failure

4. Persona Subagents
   - `/pi-decide --subagents`
   - `/pi-review --subagents`

5. Parallel Waves
   - `/build-loop --parallel --worktree --max-concurrency N`
   - dependency graph
   - conflict prediction
   - deterministic merge

Tekankan: jangan langsung parallel tanpa worktree dan readiness checks.
