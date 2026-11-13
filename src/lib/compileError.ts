/**
 * src/lib/compileError.ts
 * Turns a (remapped) GnuCOBOL message into what the compile ErrorState shows:
 * the token to underline, one plain-words sentence, and the raw diagnostic.
 * Also builds the stub "Let the ghost fix it" task. Pure.
 */

export interface CompileSummary {
  /** the word to underline on the error line, if it really appears there */
  token?: string
  /** one sentence a learner can read */
  plain: string
  /** the compiler's own words for the first error */
  technical: string
}

/** Placeholder words GnuCOBOL uses for token classes, not real source text */
const TOKEN_CLASSES = new Set(['identifier', 'word', 'literal', 'end', 'level-number'])

/** The text after "error:" on the first error diagnostic, or the first non-empty line. */
function firstDiagnostic(message: string): string {
  const lines = message.split('\n').map(l => l.trim()).filter(Boolean)
  for (const l of lines) {
    const m = /:\s*error:\s*(.+)$/i.exec(l)
    if (m) return m[1].trim()
  }
  return lines[0] ?? 'The compiler rejected the program.'
}

function findToken(diag: string, sourceLine: string): string | undefined {
  const candidates: string[] = []
  for (const m of diag.matchAll(/'([^']+)'|"([^"]+)"/g)) candidates.push(m[1] ?? m[2])
  const unexpected = /unexpected\s+(\S+?)[,.]?(?:\s|$)/i.exec(diag)
  if (unexpected && !TOKEN_CLASSES.has(unexpected[1].toLowerCase())) candidates.push(unexpected[1])

  const hay = sourceLine.toUpperCase()
  return candidates.find(c => c.trim() !== '' && hay.includes(c.toUpperCase()))
}

function sentence(s: string): string {
  const t = s.trim()
  const capped = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(capped) ? capped : `${capped}.`
}

function plainWords(diag: string, sourceLine: string): string {
  let m: RegExpExecArray | null
  let plain: string
  if ((m = /'([^']+)' is not defined/i.exec(diag))) {
    plain = `${m[1]} isn't declared in the DATA DIVISION.`
  } else if ((m = /syntax error, unexpected (.+)$/i.exec(diag))) {
    plain = `The compiler didn't expect ${m[1].replace(/[.,]$/, '')} here.`
  } else if ((m = /(\S+) statement not terminated by (\S+)/i.exec(diag))) {
    plain = `This ${m[1]} is missing its ${m[2]}.`
  } else if ((m = /(.+?) header missing/i.exec(diag))) {
    plain = `The ${m[1]} header is missing or out of place.`
  } else {
    plain = sentence(diag)
  }
  if (sourceLine.trimEnd().length > 72) {
    plain += ' This line runs past column 72, and the compiler ignores everything after it.'
  }
  return plain
}

/**
 * @param message      compiler message, already remapped to CodePane numbering
 * @param line         1-based error line, if known
 * @param sourceLines  Program.lines
 */
export function summarizeCompileError(
  message: string,
  line: number | undefined,
  sourceLines: readonly string[],
): CompileSummary {
  const technical = firstDiagnostic(message)
  const sourceLine = line !== undefined ? sourceLines[line - 1] ?? '' : ''
  return {
    token: sourceLine ? findToken(technical, sourceLine) : undefined,
    plain: plainWords(technical, sourceLine),
    technical,
  }
}

export const TASK_LIMIT = 500

/**
 * The task sent by the stub "Let the ghost fix it": the original task plus the
 * failure, clipped to the 500-character summon limit. The original task keeps
 * priority; the failure text is shortened first.
 */
export function buildFixTask(task: string, failure: string): string {
  const base = task.trim().length > 340 ? `${task.trim().slice(0, 339)}…` : task.trim()
  const lead = '\n\nYour last program failed: '
  const tail = ' Write a corrected program.'
  const room = TASK_LIMIT - base.length - lead.length - tail.length
  const reason = failure.replace(/\s+/g, ' ').trim()
  const clipped = reason.length > room ? `${reason.slice(0, Math.max(0, room - 1))}…` : reason
  return `${base}${lead}${clipped}${tail}`
}
