---
inclusion: always
---

# Tech stack and constraints

**Budget is $0.** Every service must have a free tier that needs no credit card. If a change would need a paid plan, stop and ask.

## Stack
| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | `"strict": true`, no `any` in `src/` except at JSON boundaries before zod parsing. |
| UI | React + Vite | Plain React function components + CSS custom properties from `src/styles/tokens.css` (see `seance-design.md`). No UI kit, no animation library. |
| Hosting | Vercel (Hobby, free) | Static Vite build + Vercel Functions in `/api` (Node runtime). |
| LLM | Provider adapter, default **Groq** free tier (OpenAI-compatible chat completions) | Model id comes from env `LLM_MODEL`; never hard-code. Keys only in Vercel env vars, never in the client bundle. |
| COBOL runner | Adapter, default **OnlineCompiler.io** free tier (`gnucobol-3.2`, GnuCOBOL 3.2) via `/api/run` proxy | Key server-side only. Fallback adapter: self-hosted GnuCOBOL Docker service (Render free web service). Third fallback: golden fixtures. |
| Python runner | **Pyodide** in a Web Worker | Runs the translation in the user's browser. Standard library only (`decimal`, `csv`, `io`). |
| Validation | zod | Every LLM response and every runner response is parsed with zod before use. |
| Tests | Vitest + **fast-check** (property-based) | Property tests are first-class: see the Correctness Properties in each spec's design.md. |
| E2E (stretch) | Playwright | One smoke test of the golden "Sales total" séance. |

## Environment variables (server only)
- `LLM_API_KEY`, `LLM_BASE_URL` (default `https://api.groq.com/openai/v1`), `LLM_MODEL`
- `LLM_NARRATE_MODEL` (optional; narration model, falls back to `LLM_MODEL`. On Groq, `openai/gpt-oss-20b` has its own tokens-per-minute bucket)
- `RUNNER_KIND` = `onlinecompiler` | `selfhost` | `fixtures`
- `ONLINECOMPILER_API_KEY` (when `RUNNER_KIND=onlinecompiler`)
- `SELFHOST_RUNNER_URL`, `SELFHOST_RUNNER_TOKEN` (when `RUNNER_KIND=selfhost`)

Commit a `.env.example` with names only. Never commit values.

## Runner facts to respect
- OnlineCompiler.io compiles COBOL with `cobc -x -free ...`. Fixed-format source needs `>>SOURCE FORMAT IS FIXED` as the first line. The server adds that line, so it must **subtract 1 from every line number** in compiler messages before returning them. The UI never shows the directive line.
- Programs get no network and no files. Data reaches COBOL through **stdin only** (see the stdin protocol in `specs/proof-runner/design.md`).
- Every run has a time limit. Show the timeout state from the design when it is hit.

## Rules
- Pure logic (protocol encoding, output parsing, range math, line-offset fixes, prompt building) lives in `src/lib/` with **no React and no fetch**, so it can be property-tested.
- Network calls only in `api/` (server) and `src/services/` (client → our own `/api`).
- No secrets in steering, specs, hooks or tests. Use obviously fake values in tests.
- Prefer small files (under 200 lines). One component per file.
- Accessibility rules in `seance-design.md` are requirements, not suggestions.
