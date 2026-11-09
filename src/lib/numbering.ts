/**
 * src/lib/numbering.ts
 * Prepends 4-digit line numbers to source lines for the Narrate API prompt.
 *
 * Format: "0001  <line text>"
 * The two-space gap separates the number from the code without adding syntax.
 * The Narrate prompt sends this so every Step range it returns is grounded in
 * the real source — the LLM cannot hallucinate line numbers outside the file.
 */

/**
 * Numbers each line of source with a zero-padded 4-digit prefix.
 *
 * @param lines  Array of source lines (from Program.lines).
 * @returns  A single string with one numbered line per text line.
 *
 * @example
 * numberSource(['IDENTIFICATION DIVISION.', 'PROGRAM-ID. HELLO.'])
 * // "0001  IDENTIFICATION DIVISION.\n0002  PROGRAM-ID. HELLO."
 */
export function numberSource(lines: readonly string[]): string {
  return lines
    .map((line, i) => {
      const num = String(i + 1).padStart(4, '0')
      return `${num}  ${line}`
    })
    .join('\n')
}
