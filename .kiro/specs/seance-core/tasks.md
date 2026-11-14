# Implementation Plan

Phase A (tasks 1–9) is the end-to-end MVP: one live séance from task to agreement bar, deployed. Phase B (tasks 10–15) is polish. Do not start Phase B until task 9 is checked.

- [ ] 1. Scaffold the project
  - Vite + React + TypeScript (strict), Vitest, fast-check, zod
  - Copy `design/src/tokens.css` and the motion block from `seance-design.md` into `src/styles/`; load the four Google Fonts in `index.html`
  - Add `.env.example` with variable names only (see tech.md), npm scripts `dev`, `build`, `test`, `test:watch`
  - _Requirements: 12.1_

- [ ] 2. Shared schemas and pure library
- [ ] 2.1 Write `src/lib/schemas.ts` with the zod schemas from design.md
  - _Requirements: 3.4, 3.7, 12.2_
- [ ] 2.2 Write `src/lib/ranges.ts` (`intersects`, `validateSteps`, `firstLine`, `clampIndex`)
  - _Requirements: 5.2, 5.3, 5.4, 5.5_
- [ ] 2.3 Property tests for ranges (Properties 1, 2, 3)
  - _Requirements: 5.2, 5.3, 5.4, 5.5_
- [ ] 2.4 Write `src/lib/results.ts` (`parseResultLines`, `normalizeNumber`, `agree`)
  - _Requirements: 7.2, 7.3, 7.4_
- [ ] 2.5 Property tests for agreement (Properties 4, 5, 6)
  - _Requirements: 7.2, 7.3_
- [ ] 2.6 Write `src/lib/stdin.ts`, `src/lib/lineOffset.ts`, `src/lib/numbering.ts` (follow proof-runner design for the protocol)
  - _Requirements: 4.1, 4.2_
- [ ]* 2.7 Property test for input limits (Property 7)
  - _Requirements: 1.5, 1.7, 3.7, 12.2_

- [ ] 3. Run API (COBOL) with the OnlineCompiler.io adapter
  - `server/runners/onlinecompiler.ts`: POST `run-code-sync` with compiler `gnucobol-3.2`, prepend `>>SOURCE FORMAT IS FIXED`, remap compiler line numbers by −1, map timeout to `timedOut`
  - `api/run.ts`: zod-validate body, size limits, call adapter, return `Run`
  - Example test with mocked fetch, including a compile error on line 1 of user source
  - _Requirements: 4.1, 4.2, 4.6, 12.1, 12.2_

- [ ] 4. Summon API
  - `server/llm/client.ts`: OpenAI-compatible chat completion using `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`; JSON response mode when supported
  - `server/llm/prompts/summon.ts`: system prompt built from `.kiro/steering/cobol-generation.md` rules
  - `api/summon.ts`: validate, one retry on invalid JSON, return `SummonRes`; 413 above 70 KB
  - _Requirements: 3.1, 3.4, 3.5, 3.7, 12.1_

- [ ] 5. Narrate API
  - `server/llm/prompts/narrate.ts` sends the numbered source and asks for steps + Python lines + note
  - `api/narrate.ts`: validate, run `validateSteps`; if invalid, one repair retry with the validation error
  - _Requirements: 5.1, 6.1, 6.3_

- [ ] 6. Pyodide worker
  - `src/workers/pyodide.worker.ts` loads Pyodide from the jsDelivr CDN (pin the version shown on pyodide.org), redirects stdin/stdout, enforces a 10 s timeout by terminating the worker
  - `src/services/python.ts` returns a `Run` with `runner: 'pyodide'`
  - _Requirements: 6.2, 6.4_

- [ ] 7. Workspace screen, MVP cut
  - AppShell (3 columns), TopBar, TaskInput, SummonButton, StatusPill, CodePane with Planchette, GhostNarration, TranslationPane, RunOutput, AgreementBar
  - `src/state/seance.ts` reducer and orchestration: summon → (run ∥ narrate) → python → agree
  - Keyboard: Ctrl/Cmd+Enter, `/`, `j`/`k`, Esc
  - Match `design/mocks/workspace.html`
  - _Requirements: 1.1, 1.2, 1.3, 1.6, 3.1, 3.2, 3.3, 3.6, 4.3, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 8. Error, empty and busy states
  - EmptyState with the four chips, SummoningSkeleton, ErrorState (compile, runtime, timeout, unsupported), busy state on 429/5xx
  - "Let the ghost fix it" can be a stub that re-summons with the compiler message (full loop in ghost-narrator)
  - _Requirements: 2.1, 3.5, 4.4, 4.5, 6.4, 8.2_

- [ ] 9. Deploy the MVP to Vercel
  - Set env vars in the Vercel dashboard (never in the repo), deploy, run one live séance with the sales CSV, and record the URL in README
  - Checkpoint: ask the user to confirm the live séance shows "✓ Python agrees. Both runs print 5871.50."
  - _Requirements: 4.6, 12.1_

- [ ] 10. Golden séances and demo resilience
- [ ] 10.1 `scripts/golden-capture.ts` calls the deployed APIs for each chip and saves `src/fixtures/golden/<slug>.json`
  - _Requirements: 8.1_
- [ ] 10.2 Chip click replays a golden séance with full animations and the "cached séance" meta
  - _Requirements: 2.2, 2.3_
- [ ] 10.3 Golden replay test: every fixture parses and its runs agree
  - _Requirements: 8.1_

- [x] 11. Language picker
  - LanguagePicker dialog with COBOL enabled and Fortran/BASIC "Resting"; focus trap, arrow keys, Esc
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 12. File attach
  - FileChip, 64 KB / 500-row limits, CSV header passed to summon, body encoded with `encodeStdin`
  - _Requirements: 1.4, 1.5, 1.7_

- [x] 13. Responsive layouts and reduced motion
  - Tablet tabs, mobile segmented control, GhostCaption, bottom-sheet picker, reduced-motion behaviour, focus rings
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 14. Landing page
  - Match `design/mocks/landing.html`; route `/` and `/seance`; corrected footnote copy
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 15. Safety pass
  - Per-IP limit (10/min, in-memory, best effort), per-instance response cache by input hash, confirm no secret reaches the client bundle (`grep` the `dist/` output in a test)
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ]* 16. Playwright smoke test of the sales golden séance
  - _Requirements: 2.2, 7.2_
