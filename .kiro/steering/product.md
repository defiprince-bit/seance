---
inclusion: always
---

# Product: Séance

*Ask in plain English. A programmer from 1959 answers.*

## What it is
Séance is a web app that turns a plain-English task (for example "parse this CSV and total the sales") into a real program in a dead language, runs it on a real compiler, and has a "ghost programmer" explain it line by line. It then brings the program back to modern Python, runs that too, and shows whether both runs agree ("✓ Python agrees. Both runs print 5871.50.").

Kiroween 2026 category: **Resurrection** (bring dead technology back to life).

## Why it matters
Banks, insurers and governments still run large COBOL systems, and the people who can read them are retiring. Séance is a trainer and a translator for that skill:
- **Learners** see real COBOL for a task they already understand, with a patient explanation of each line.
- **Modernizers** see a line-mapped Python translation and a proof that both programs produce the same answer.

Never invent numbers about the COBOL workforce or legacy code in the product, README or video. If a statistic appears, it must have a source shown next to it.

## Who it is for
1. Developers and students curious about mainframe-era languages.
2. Engineers asked to read or migrate legacy COBOL.
3. Hackathon judges: they must reach the "aha" (planchette glide + agreement bar) within 30 seconds of opening the live link, with no sign-up.

## Core flow (MVP)
1. Type a task (or pick a suggestion chip). Optionally attach a small CSV.
2. **Summon:** the model writes COBOL (fixed-format COBOL-85 style, GnuCOBOL-compatible).
3. **Run:** the COBOL compiles and runs in a GnuCOBOL sandbox; the output streams into the CRT pane.
4. **Narrate:** the ghost explains the program in steps; each step lights a line range. The planchette glides to it, and the mapped Python lines light up too (linked highlighting).
5. **Bring back:** the Python translation runs in the browser (Pyodide). The agreement bar compares results.
6. If compile fails: "Let the ghost fix it" sends the compiler error back once and retries.

## Stretch (only after the MVP is green)
- Fortran and BASIC spirits (same runner, different compiler ids).
- "Ask about these lines" follow-up question.
- Cols 1–7 toggle (fixed-format teaching moment).
- Share a séance by URL.

## Non-goals
- Not a production migration tool. Footnote everywhere: "Generated code is for learning, not production."
- No accounts, no payments, no database in the MVP.
- No user-uploaded files larger than 64 KB.

## Success criteria for judging
- Live link works with no login; the 4 suggestion chips always work (cached golden séances) even if the LLM is rate-limited.
- Video under 3 minutes shows task → COBOL → planchette glide → Python → agreement bar.
- Repo shows heavy, deliberate Kiro use: specs, steering (all four inclusion modes), hooks, a custom agent, MCP, and property-based tests.

## Copy correction for the design mocks
The mocks say "Runs in your browser." That is only true for Python. COBOL compiles and runs in a remote GnuCOBOL sandbox. Use: **"Python runs in your browser. COBOL runs on a real GnuCOBOL compiler. Generated code is for learning, not production."** Never claim COBOL runs in the browser unless the WASM stretch path ships.
