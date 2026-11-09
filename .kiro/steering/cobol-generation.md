---
inclusion: fileMatch
fileMatchPattern: ["server/llm/**/*", "api/summon.ts", "api/narrate.ts", "src/fixtures/golden/**/*"]
---

# Rules for generated dead-language code and the ghost's output

Load this whenever prompts, LLM adapters or golden fixtures are edited.

## COBOL the model must produce
- GnuCOBOL 3.x compatible, COBOL-85 style, **fixed format**: columns 1–6 sequence area (blank or numbers), column 7 indicator (`*` for comments), code in columns 8–72. No tabs.
- Four divisions in order: IDENTIFICATION, ENVIRONMENT, DATA, PROCEDURE. `PROGRAM-ID` in kebab or upper case.
- Read input **only** with `ACCEPT` from stdin, following the stdin protocol (first line = record count N, then N lines). No `SELECT`/`FD` files, no `CALL` to C, no `SYSTEM`.
- Money and decimals use `PIC S9(n)V99` and are displayed through an edited picture (`PIC Z(n)9.99` or `-Z(n)9.99`).
- Output ends with one or more **result lines** in the exact form `LABEL: value` (label in upper case letters, digits and spaces). Example: `TOTAL SALES:      5871.50`. Other DISPLAY lines are allowed before them.
- At most 120 lines. Comment the intent of each paragraph in one `*` line.
- Must end with `STOP RUN.`

## Python translation
- Python 3, standard library only. Use `decimal.Decimal` for any value that was fixed-point in COBOL, and say so in the translator's note.
- Reads the same stdin protocol (`sys.stdin`), prints the same result labels in the same order.
- Every Python line carries `maps: [a,b]` pointing at the COBOL lines it came from, or `null` for pure Python plumbing (imports, `if __name__`).

## Ghost narration
- 4–10 steps that together cover every PROCEDURE DIVISION line at least once; DATA DIVISION may be grouped.
- Each step: `range:[a,b]` with 1 ≤ a ≤ b ≤ line count, ranges in ascending order and non-overlapping; optional `quote` (≤ 1 quip, first person, dry, kind); `text` ≤ 40 words that names the real COBOL concept and its Python equivalent.
- Banned words in any generated text: Ouija, boo, spooky, mwahaha, "AI magic". No emoji.

## Unsupported tasks
If the task needs network, GUI, webcams, threads or anything COBOL can't do, return `{ "unsupported": true, "reason": "..." }` instead of code. The UI shows the unsupported-task card.
