# Kiro log

How the `seance-core` spec ([`.kiro/specs/seance-core/tasks.md`](../.kiro/specs/seance-core/tasks.md)) was carried out, task by task, with the commit that landed each one. Dates are commit dates (2026).

The spec pack itself landed in `f61e719` (9 Nov), after the initial commit `c700ff7`. Phase A (tasks 1–9) is the end-to-end MVP. Phase B (tasks 10–15) is polish. Task 16 is optional.

## Tasks

| # | Task | Commit | Date |
|---|---|---|---|
| 1 | Scaffold: Vite, React, strict TypeScript, Vitest, fast-check, zod, tokens, `.env.example` | `e49d278` | 9 Nov |
| 2 | Shared schemas and pure library: schemas, ranges, results, stdin, line offset, numbering, property tests | `2db8711` (with 3 and 4) | 9 Nov |
| 3 | Run API with the OnlineCompiler.io adapter | `2db8711` | 9 Nov |
| 4 | Summon API: LLM client, summon prompt, one JSON retry | `2db8711` | 9 Nov |
| 5 | Narrate API with a repair retry on invalid step ranges | `b498ed1` | 9 Nov |
| 6 | Pyodide worker with a 10 s timeout | `d2023e8` | 13 Nov |
| 7 | Workspace screen, MVP cut: panes, reducer, keyboard, dev API plugin | `8878e08` | 13 Nov |
| 8 | Error, empty and busy states | `12ad09e` | 13 Nov |
| 9 | Deploy to Vercel (env vars set in the dashboard; no repo change of its own) | see `7778ab9` | 13 Nov |
| 10 | Golden séances and demo resilience: capture script, replay, tests | `2ebf017`, then `acb9899`, `c4ec98e` | 13–14 Nov |
| 11 | Language picker (COBOL live, Fortran and BASIC resting) | `f2784a3` | 14 Nov |
| 12 | File attach: 64 KB and 500-row limits, CSV sent through stdin | `06afd58` | 14 Nov |
| 13 | Responsive layouts and reduced motion | `fd851f0` | 14 Nov |
| 14 | Landing page, routes `/` and `/seance`, corrected footnote | `04e19bd`, `1c77a9f` | 14 Nov |
| 15 | Safety pass: per-IP limit, bounded response cache, bundle-secrets test | `e7f8df5` | 14 Nov |
| 16 | Playwright smoke test of the sales golden séance (optional) | `147e35d` | 15 Nov |

Note: in `tasks.md`, the checkboxes for tasks 1–10 are still unchecked, although those tasks shipped. Tasks 11–16 are checked.

## What changed along the way

**Spec decisions (5 questions answered before task 1).** The spec was updated to match them: `/seance` is the workspace route, the runtime copy never claims COBOL runs in the browser, and the language picker shows Fortran and BASIC as resting.

**Making a real séance work (tasks 6–9).**
- `a2b4523` fixed the stdin protocol (record count first), made the Python translation use COBOL-exact arithmetic, and kept result labels with spaces.
- `7778ab9` fixed a Vercel `ERR_MODULE_NOT_FOUND` by using `.js` import specifiers in code reachable from `api/`, with a test that guards it.
- `4c75f3d` made the prompts and a lint reject COBOL continuation lines and a `MOVE` of money into an edited picture instead of an invented `EDITED` keyword.

**Living with free-tier LLM limits.**
- `908b5e4` retries Groq's "Failed to validate JSON" 400s, adds `LLM_NARRATE_MODEL`, and waits out short 429s.
- `99de2a6` moved narration to `openai/gpt-oss-20b` at medium effort, added `[n]` range handling and a Python import check, and capped the 429 wait at 15 s.
- `1307583` capped summon output tokens and added a dev-only log of Groq's `failed_generation`.
- `2ebf017` and `acb9899` added golden séances captured from the deployed APIs, so the suggestion chips work with no LLM call. The sales, compound-interest and payroll chips replay a real capture. The sort-names fixture could not be captured because its COBOL did not compile, so that chip still summons live.

**Polish and safety.**
- Task 13 added the tablet tabs, the mobile segmented control and the ghost caption. `ab4389d` added a badge on the mobile paperclip because the file chip is hidden there.
- Task 14 followed the playful landing design. The mock's claims were changed to match what the app does: COBOL only, no retiring-workforce statistic, and the exact footnote from Req 11.3. `8fb4f73` made the landing preview read its ghost quote from the sales fixture. `1c77a9f` made `/seance/` work on Vercel.
- Task 15 added a 10-per-minute per-IP limit with 429 and `Retry-After`, an LRU response cache (200 entries each for summon and narrate), and a test that builds the app and searches the output for server-only env var names, `gsk_` and the provider hosts. Properties 8 and 9 were added to the design for the limiter and the cache.

## Test counts

The suite grew from 36 tests at task 2 to 419 at task 16. Task 16 adds two Playwright tests, run separately with `npm run smoke`.

## Kiro features in use

- **Specs:** `.kiro/specs/seance-core`, `proof-runner`, `ghost-narrator`.
- **Steering:** always (`product`, `tech`, `structure`, `seance-design`), fileMatch (`cobol-generation`), auto (`cobol-primer`), manual (`demo-day`).
- **Hooks:** `block-secrets`, `guard-kiro-folder`, `kiro-log-after-task`, `test-on-save`.
- **Custom agent:** `cobol-elder`, a read-only reviewer.
- **MCP:** `fetch` is enabled; `git` is configured but disabled.

## Full git log

```
147e35d 2026-11-15 Task 16: Playwright smoke test
e7f8df5 2026-11-14 Task 15: safety pass
8fb4f73 2026-11-14 Landing preview: real ghost quote
1c77a9f 2026-11-14 Serve /seance/ on Vercel
04e19bd 2026-11-14 Task 14: landing page
ab4389d 2026-11-14 Mobile attach indicator
fd851f0 2026-11-14 Task 13: responsive layouts and reduced motion
06afd58 2026-11-14 Task 12: file attach
c4ec98e 2026-11-14 Fix golden capture test
acb9899 2026-11-14 Golden fixtures: real captures (sales, compound-interest, payroll)
f2784a3 2026-11-14 Task 11: language picker
2ebf017 2026-11-13 Task 10: golden séances and demo resilience
1307583 2026-11-13 Summon output cap on gpt-oss; dev-only failed_generation log
99de2a6 2026-11-13 Narrate on gpt-oss-20b at medium effort; [n] ranges; import check; 15 s 429 cap
908b5e4 2026-11-13 Retry Groq JSON-validation 400s; narrate model; wait out short 429s
4c75f3d 2026-11-13 Reject COBOL continuation lines; MOVE money to edited PIC, never EDITED
7778ab9 2026-11-13 Use .js import specifiers in code reachable from api/
12ad09e 2026-11-13 Task 8: error, empty and busy states
8878e08 2026-11-13 Task 7: workspace screen, MVP cut
a2b4523 2026-11-13 Fix stdin protocol, COBOL-exact Python, result labels
d2023e8 2026-11-13 Task 6: Pyodide worker
b498ed1 2026-11-09 Task 5: narrate API
2db8711 2026-11-09 Task 4: summon API
e49d278 2026-11-09 Task 1: scaffold
f61e719 2026-11-09 Kiro spec pack
c700ff7 2026-11-09 Initial commit
```
