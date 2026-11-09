/**
 * src/lib/stdin.ts
 * Stdin encoding/decoding for the COBOL and Python runners.
 *
 * Protocol (mirrors proof-runner spec):
 *   - Each logical "record" is one line of stdin fed to the program.
 *   - When a CSV is attached, each data row (excluding the header) becomes
 *     one line, with fields joined by commas — the program reads them with
 *     ACCEPT … FROM CONSOLE or Python's input().
 *   - The encoded form is the raw lines joined by '\n', terminated with a
 *     final '\n' so the last ACCEPT does not block.
 *   - When there is no CSV, the encoded form is an empty string (programs
 *     that need no input work fine with an empty stdin).
 *
 * Both COBOL (via the runner) and Python (Pyodide) receive the same encoded
 * string so their outputs are deterministically comparable.
 */

/**
 * Encodes a CSV body (all text after the header row) into a stdin string.
 * Pass undefined or an empty string for programs that need no CSV input.
 *
 * @param csvText  The full CSV text including the header row, or undefined.
 * @returns  A newline-terminated string ready to pipe as stdin.
 */
export function encodeStdin(csvText?: string): string {
  if (!csvText || csvText.trim() === '') return ''

  const lines = csvText.split('\n')
  // Drop the header row (index 0), strip carriage returns, skip blank lines
  const dataRows = lines.slice(1).map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== '')

  if (dataRows.length === 0) return ''

  return dataRows.join('\n') + '\n'
}

/**
 * Decodes a stdin string back into the individual record lines.
 * Returns an empty array for empty/whitespace-only input.
 */
export function decodeStdin(encoded: string): string[] {
  if (!encoded || encoded.trim() === '') return []
  return encoded.split('\n').filter((l) => l !== '')
}
