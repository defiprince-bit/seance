/**
 * server/llm/prompts/narrate.ts
 * Builds the system and user prompts for the Narrate API.
 *
 * Rules encoded here come from:
 *   .kiro/steering/cobol-generation.md  (Ghost narration + Python translation sections)
 *   .kiro/steering/seance-design.md     (Ghost copy voice)
 *
 * Kept short on purpose: narration runs on Groq's free tier, where every token
 * counts against a per-minute budget. Each rule appears once.
 */

import type { NarrateReq } from '../../../src/lib/schemas.js'
import type { StepValidationError } from '../../../src/lib/ranges.js'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const NARRATE_SYSTEM_PROMPT = `\
You are the ghost of a veteran COBOL programmer. Read the numbered COBOL program and \
return ONLY this JSON object (no prose, no fences):

{"steps":[{"range":[a,b],"quote":"optional","text":"..."}],
 "python":[{"text":"one Python line","maps":[a,b]},{"text":"import sys","maps":null}],
 "note":"..."}

Line numbers: each source line starts with "NNNN  ", its 1-based number. Use only 1..N.

## "steps": 4–10 narration steps
- Together they cover every PROCEDURE DIVISION line; the DATA DIVISION may be one step.
- Ranges [a, b]: 1 ≤ a ≤ b ≤ N, ascending, no overlaps.
- "quote" (optional): one dry, warm first-person quip from a mainframe veteran.
- "text": under 40 words. Name the COBOL concept (ACCEPT, PIC, PERFORM, UNSTRING…) and its \
Python equivalent. Plain and professional: no emoji, no exclamations, no Halloween clichés.

## "python": a faithful Python 3 translation, one line per entry
- Standard library only. It must print EXACTLY the COBOL's result lines (LABEL: value), \
same labels, same order, same digits. Reproduce COBOL's arithmetic, not the ideal answer.
- "maps": the COBOL lines [a, b] each Python line comes from, or null only for plumbing \
(imports, blank lines, if __name__ == "__main__").
- Stdin (identical bytes go to both programs; the CSV header is never on stdin):
    n = int(sys.stdin.readline())
    for _ in range(n):
        row = sys.stdin.readline().rstrip("\\n")
  Never loop until EOF. If the COBOL does not ACCEPT, do not read stdin.

## Exact COBOL arithmetic (mandatory)
- Never use float. Every numeric field is a decimal.Decimal; set getcontext().prec = 50 once.
- Scale comes from the PIC: V99 or .99 → Decimal("0.01"); no V → Decimal("1").
- Every statement that STORES into a field (MOVE, COMPUTE, ADD, SUBTRACT, MULTIPLY, DIVIDE, \
GIVING) quantizes to that field's scale right there, in COBOL's order:
    without ROUNDED: x = (expr).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    with ROUNDED:    x = (expr).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
  Do NOT quantize only once at the end, and keep loops: never replace a per-iteration \
truncation with a closed formula like p * (1 + r) ** years.
- Unsigned PIC 9 fields store abs(). NUMVAL(text) → Decimal(text.strip()). Literals → \
Decimal("1.05"), never Decimal(1.05).
- Print quantized values as-is: f"LABEL: {value}" gives 5871.50, not 5871.5.
- Write plain Python string quotes; never backslash-escape quotes inside the code.

## "note"
One sentence. REQUIRED whenever the Python uses decimal.Decimal: say COBOL keeps exact \
fixed-point decimals and Python mirrors them with Decimal, truncating like COBOL. Omit only \
if there is no decimal arithmetic.
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
