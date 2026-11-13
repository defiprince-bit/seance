/**
 * src/lib/stdin.ts
 * The stdin protocol shared by COBOL (runner) and Python (Pyodide).
 * Spec: .kiro/specs/proof-runner/design.md, steering cobol-generation.md
 *
 *   <N>\n          number of data rows, on its own line
 *   <row 1>\n
 *   ...
 *   <row N>\n
 *
 * COBOL reads N with ACCEPT, then PERFORM N TIMES with ACCEPT of one row.
 * Python reads int(sys.stdin.readline()) then N lines. No EOF handling needed.
 *
 * Encoder rules (proof-runner Req 2):
 *   - line endings normalised to \n
 *   - CSV header row dropped
 *   - trailing empty lines trimmed (blank rows in the middle are kept, so the
 *     count always equals the rows actually sent)
 *   - no CSV (or header only) → "0\n"
 */

/** Splits text into lines with \r\n and lone \r normalised to \n. */
function toLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n')
}

/**
 * Encodes a CSV (header row included) into protocol stdin.
 *
 * @param csvText  Full CSV text including the header row, or undefined.
 * @returns        "N\n" followed by the N data rows, each newline-terminated.
 */
export function encodeStdin(csvText?: string): string {
  if (csvText === undefined || csvText.trim() === '') return '0\n'

  const rows = toLines(csvText).slice(1) // drop header
  while (rows.length > 0 && rows[rows.length - 1].trim() === '') rows.pop()

  if (rows.length === 0) return '0\n'
  return `${rows.length}\n${rows.join('\n')}\n`
}

/**
 * Decodes protocol stdin back into the data rows (count line removed).
 * Returns [] for empty input. Throws if the first line is not a row count
 * or fewer rows follow than the count promises.
 */
export function decodeStdin(encoded: string): string[] {
  if (encoded.trim() === '') return []

  const lines = toLines(encoded)
  // the '' after the final newline is a terminator, not a row
  if (lines[lines.length - 1] === '') lines.pop()
  const head = lines[0].trim()
  if (!/^\d+$/.test(head)) {
    throw new Error(`stdin must start with a row count, got "${lines[0]}"`)
  }

  const count = Number(head)
  const rows = lines.slice(1, 1 + count)
  if (rows.length < count) {
    throw new Error(`stdin promised ${count} rows but carried ${rows.length}`)
  }
  return rows
}
