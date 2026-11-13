/**
 * src/lib/cobolFormat.ts
 * Checks generated COBOL against the fixed-format column rules in
 * .kiro/steering/cobol-generation.md and cobol-primer.md. Pure: it only reports,
 * it never rewrites code. api/summon.ts feeds the issues back to the model
 * for one repair attempt.
 *
 *   cols 1–6  sequence area (blank or digits)
 *   col  7    indicator: space, * comment, / page, D debug
 *             ("-" continuation is valid COBOL but rejected here, see below)
 *   cols 8–72 Areas A and B
 *   cols 73+  ignored by the compiler, so code there is silently lost
 */

export type FormatIssueKind =
  | 'tab' | 'too-long' | 'comment-column' | 'continuation' | 'sequence-area' | 'indicator'

export interface FormatIssue {
  line: number // 1-based
  kind: FormatIssueKind
  detail: string
}

// "-" (continuation) is deliberately absent: Séance never uses continuation
// lines, because the model gets them wrong and GnuCOBOL glues the text on.
const INDICATORS = new Set([' ', '*', '/', 'D', 'd'])

export function lintFixedFormat(lines: readonly string[]): FormatIssue[] {
  const issues: FormatIssue[] = []

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    const n = i + 1
    if (line === '') return

    if (line.includes('\t')) {
      issues.push({ line: n, kind: 'tab', detail: 'contains a tab; use spaces' })
      return
    }

    // a lone * that is not a floating *> comment must sit in column 7
    const firstText = line.search(/\S/)
    if (line[firstText] === '*' && line[firstText + 1] !== '>' && firstText !== 6) {
      issues.push({
        line: n,
        kind: 'comment-column',
        detail: `* is in column ${firstText + 1}; a comment needs exactly 6 spaces then * in column 7`,
      })
      return
    }

    // a "-" continuation marker in column 7, or misplaced anywhere in columns 1–6
    if (line[firstText] === '-' && firstText <= 6) {
      issues.push({
        line: n,
        kind: 'continuation',
        detail: `uses a "-" continuation marker in column ${firstText + 1}. Never use continuation lines: delete the "-" and start this line in Area B (column 12 or later) with no marker`,
      })
      return
    }

    if (line.length > 72) {
      issues.push({
        line: n,
        kind: 'too-long',
        detail: `is ${line.length} columns; text after column 72 is ignored ("${line.slice(72)}" is lost). Split the statement across lines`,
      })
    }

    const seq = line.slice(0, 6)
    if (seq.trim() !== '' && !/^\d{1,6}\s*$/.test(seq.trim())) {
      issues.push({ line: n, kind: 'sequence-area', detail: 'has code in columns 1–6; start code in column 8 or later' })
    } else if (line.length > 6 && !INDICATORS.has(line[6])) {
      issues.push({ line: n, kind: 'indicator', detail: `has "${line[6]}" in column 7; code starts in column 8` })
    }
  })

  return issues
}
