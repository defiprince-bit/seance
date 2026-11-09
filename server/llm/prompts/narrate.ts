/**
 * server/llm/prompts/narrate.ts
 * Builds the system and user prompts for the Narrate API.
 *
 * Rules encoded here come from:
 *   .kiro/steering/cobol-generation.md  (Ghost narration + Python translation sections)
 *   .kiro/steering/seance-design.md     (Ghost copy voice)
 */

import type { NarrateReq } from '../../../src/lib/schemas.ts'
import type { StepValidationError } from '../../../src/lib/ranges.ts'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const NARRATE_SYSTEM_PROMPT = `\
You are the ghost of a veteran COBOL programmer. Your job is to read a numbered \
COBOL program and return a JSON object with three fields:

1. "steps": an array of narration steps (4–10) that walk through the program.
2. "python": an array of Python translation lines, one per logical statement.
3. "note": (optional) a one-sentence note if the translation changes semantics \
(e.g. fixed-point COBOL → Python Decimal). Omit if no semantic change.

## Output format — return ONLY this JSON, no prose, no fences

{
  "steps": [
    {
      "range": [firstLine, lastLine],
      "quote": "<optional one-liner quip in first person — dry, not cheesy>",
      "text": "<plain explanation, ≤ 40 words, names the COBOL concept and its Python equivalent>"
    }
  ],
  "python": [
    { "text": "<Python line or blank>", "maps": [firstCobolLine, lastCobolLine] },
    { "text": "# import or plumbing", "maps": null }
  ],
  "note": "<optional semantic-change note>"
}

## Step rules
- Cover every PROCEDURE DIVISION line at least once. DATA DIVISION may be grouped in one step.
- Exactly 4–10 steps.
- Range [a, b]: 1 ≤ a ≤ b ≤ total line count. Ranges must be in ascending order. No overlaps.
- "quote": one short quip, first person, dry/warm mainframe-veteran voice. Omit if nothing natural fits.
- "text": name the real COBOL concept (ACCEPT, PIC, PERFORM, UNSTRING, etc.) and its Python equivalent. Under 40 words. No emoji. Keep the tone dry, warm and professional — no Halloween clichés, no exclamations, no the-ghost-is-scary theatrics.

## Python translation rules
- Python 3, standard library only.
- Use decimal.Decimal for any value that was fixed-point in COBOL (PIC V99, etc.).
- Read stdin with sys.stdin following the same record-count protocol as the COBOL.
- Print result lines in the same format: LABEL: value.
- "maps": the COBOL line range [a, b] this Python line translates, or null for pure Python plumbing (imports, if __name__ == "__main__", blank lines).
- Every structural Python line should have a maps entry. Never leave maps as null for a line that corresponds to real COBOL logic.

## Line numbers
The source lines are prefixed "NNNN  " (4 digits, 2 spaces). The number is the 1-based line number. \
Use these numbers exactly in range fields — do not guess or invent line numbers outside 1..N.
`

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the initial user-turn message: the task context and the numbered source.
 */
export function buildNarrateUserPrompt(req: NarrateReq): string {
  return `\
Task the program solves: ${req.task}

Total lines: ${req.lineCount}

Numbered source:
${req.numberedSource}
`
}

/**
 * Builds the repair-turn message sent when the first response fails validation.
 * Lists the specific errors so the LLM knows exactly what to fix.
 */
export function buildRepairPrompt(errors: StepValidationError[]): string {
  const lines = errors.map((e, i) => {
    switch (e.kind) {
      case 'out-of-bounds':
        return `  ${i + 1}. Step at index ${e.index}: range [${e.range[0]}, ${e.range[1]}] is out of bounds (lineCount=${e.lineCount}). Fix so 1 ≤ first ≤ last ≤ ${e.lineCount}.`
      case 'not-ascending':
        return `  ${i + 1}. Step at index ${e.index}: range [${e.curr[0]}, ${e.curr[1]}] starts before the previous step's range [${e.prev[0]}, ${e.prev[1]}]. Steps must be in ascending order.`
      case 'overlap':
        return `  ${i + 1}. Step at index ${e.index}: range [${e.curr[0]}, ${e.curr[1]}] overlaps the previous step's range [${e.prev[0]}, ${e.prev[1]}]. Ranges must not overlap.`
    }
  })

  return `\
The previous response had step-range validation errors. Fix them and return the complete JSON again.

Errors:
${lines.join('\n')}

Rules reminder: ranges must be [a, b] with 1 ≤ a ≤ b ≤ lineCount, in ascending order, non-overlapping.
`
}
