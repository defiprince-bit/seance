/**
 * src/lib/lineOffset.ts
 * Maps GnuCOBOL message line numbers onto the lines CodePane shows.
 *
 * The hosted runner prepends ">>SOURCE FORMAT IS FIXED" as line 1, so every
 * compiler line number is `offset` higher than the user's source. GnuCOBOL 3.2
 * prints three kinds of numbers, and only these are remapped:
 *
 *   code.cob:5: error: PROCEDURE DIVISION header missing     diagnostic location
 *       5 >        *                                        snippet gutter
 *       6 |        ENVIRONMENT DIVISION.                    snippet gutter
 *   ... at line 5                                           prose reference
 *
 * Numbers anywhere else are left alone. (Regression: the old pattern matched
 * "LINE" at the end of identifiers such as WS-LINE and then the number on the
 * next snippet row, shifting it twice.)
 */

/** "code.cob:5:" or "prog.cbl:5:12:" at the start of a line */
const DIAG = /^(.*?\.(?:cob|cbl|cpy)):(\d+)(?=:)/i
/** "    5 |" or "   12 >" at the start of a line */
const SNIPPET = /^(\s*)(\d+)(?=\s[|>])/
/** "line 5" as a standalone word, never the tail of WS-LINE, never across a newline */
const PROSE = /(?<![\w-])(line)([ \t]+)(\d+)\b/gi

const shift = (n: string, offset: number) => Math.max(1, Number(n) - offset)

/**
 * Returns the message with every diagnostic, snippet and prose line number
 * moved down by `offset`. Snippet rows that show the injected directive
 * (which is not part of the user's program) are dropped.
 */
export function remapCompilerMessage(message: string, offset: number): string {
  if (offset === 0) return message

  const out: string[] = []
  for (const line of message.split('\n')) {
    const snip = SNIPPET.exec(line)
    if (snip) {
      const n = Number(snip[2]) - offset
      if (n < 1) continue // the directive line, invisible to the user
      const width = snip[1].length + snip[2].length
      out.push(String(n).padStart(width) + line.slice(width))
      continue
    }
    out.push(
      line
        .replace(DIAG, (_m, file: string, n: string) => `${file}:${shift(n, offset)}`)
        .replace(PROSE, (_m, word: string, gap: string, n: string) => `${word}${gap}${shift(n, offset)}`),
    )
  }
  return out.join('\n')
}

/**
 * The line number (in the message's own numbering) of the first diagnostic
 * that is an error, falling back to the first diagnostic of any kind.
 */
export function firstErrorLine(message: string): number | undefined {
  let fallback: number | undefined
  for (const line of message.split('\n')) {
    const m = DIAG.exec(line)
    if (!m) continue
    const n = Number(m[2])
    if (/:\s*error\b/i.test(line.slice(m[0].length))) return n
    fallback ??= n
  }
  return fallback
}
