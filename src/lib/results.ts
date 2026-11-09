/**
 * src/lib/results.ts
 * Parse COBOL/Python stdout for Result_Lines and compare them.
 * No React, no fetch — pure, deterministic, property-testable.
 *
 * Result_Line format: "LABEL: value"
 *   - LABEL: one or more non-whitespace characters before the colon
 *   - value: everything after ": " trimmed
 */
import type { Agreement } from './schemas.ts'

// ---------------------------------------------------------------------------
// parseResultLines
// ---------------------------------------------------------------------------

/**
 * Scans stdout line-by-line and returns a Map of label → raw value string
 * for every line that matches the Result_Line pattern.
 *
 * Lines that do not match are ignored (COBOL programs print labels and noise).
 */
export function parseResultLines(stdout: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const line of stdout.split('\n')) {
    const match = /^(\S+):\s+(.+)$/.exec(line.trimEnd())
    if (match) {
      result.set(match[1], match[2].trim())
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// normalizeNumber
// ---------------------------------------------------------------------------

/**
 * Normalises a raw value string so that COBOL's edited numeric forms and
 * Python's Decimal string representation compare as equal.
 *
 * Rules (Property 5):
 *   1. Strip leading spaces and leading zeros (but keep a leading minus sign).
 *   2. Strip a trailing ".00" style fractional part that is all zeros, unless
 *      the value has *meaningful* fractional digits — i.e. keep "1.50" as
 *      "1.5" but strip "1.00" to "1".
 *   3. If the result is empty after stripping, return "0".
 *   4. Non-numeric strings are returned unchanged (label comparison still works).
 *
 * Examples:
 *   "     5871.50"  → "5871.5"   (COBOL PIC Z(7).99 edited)
 *   "5871.5"        → "5871.5"   (Python Decimal str)
 *   "5871.50"       → "5871.5"
 *   "00000100"      → "100"
 *   "  100.00"      → "100"
 *   "-0012.30"      → "-12.3"
 */
export function normalizeNumber(raw: string): string {
  const trimmed = raw.trim()

  // Try to parse as a number; if it fails, return the trimmed string as-is
  // so that label/string values still compare correctly.
  const num = Number(trimmed)
  if (!Number.isFinite(num) && trimmed !== 'Infinity' && trimmed !== '-Infinity') {
    return trimmed
  }

  // Use the decimal string representation that drops trailing zeros after
  // the decimal point, matching Python's str(Decimal('5871.50')) → '5871.5'.
  // We avoid floating-point drift by working on the string form.
  const sign = trimmed.startsWith('-') ? '-' : ''
  const abs = trimmed.replace(/^[+\-\s0]*/, '') // strip sign, spaces, leading zeros

  if (abs === '' || abs === '.') return '0'

  const dotPos = abs.indexOf('.')
  if (dotPos === -1) {
    // Integer — already stripped leading zeros, just reattach sign
    return sign + (abs || '0')
  }

  const intPart = abs.slice(0, dotPos) || '0'
  const fracPart = abs.slice(dotPos + 1).replace(/0+$/, '') // strip trailing zeros

  if (fracPart === '') {
    return sign + intPart
  }
  return sign + intPart + '.' + fracPart
}

// ---------------------------------------------------------------------------
// agree
// ---------------------------------------------------------------------------

/**
 * Compares two stdout strings by their Result_Lines and returns an Agreement.
 *
 * Properties 4, 5, 6:
 *   - Reflexive: agree(s, s).status === 'match' when s has ≥1 Result_Line.
 *   - Symmetric: agree(s1,s2).status === agree(s2,s1).status.
 *   - Catches all differences: any label or value difference → 'mismatch'.
 *
 * Requirement 7.4: if either run has no Result_Lines → 'no-result'.
 */
export function agree(cobolStdout: string, pythonStdout: string): Agreement {
  const cobolMap = parseResultLines(cobolStdout)
  const pythonMap = parseResultLines(pythonStdout)

  if (cobolMap.size === 0 || pythonMap.size === 0) {
    return { status: 'no-result' }
  }

  // Check every label present in either map
  const allLabels = new Set([...cobolMap.keys(), ...pythonMap.keys()])

  for (const label of allLabels) {
    const cRaw = cobolMap.get(label)
    const pRaw = pythonMap.get(label)

    // Label missing in one side → mismatch
    if (cRaw === undefined || pRaw === undefined) {
      return {
        status: 'mismatch',
        label,
        cobolValue: cRaw,
        pythonValue: pRaw,
      }
    }

    const cNorm = normalizeNumber(cRaw)
    const pNorm = normalizeNumber(pRaw)

    if (cNorm !== pNorm) {
      return {
        status: 'mismatch',
        label,
        cobolValue: cRaw,
        pythonValue: pRaw,
      }
    }
  }

  // All labels present and all values equal — pick the last label as the
  // display label (matches Req 7.2: "last Result_Line value").
  const labels = [...cobolMap.keys()]
  const lastLabel = labels[labels.length - 1]
  return {
    status: 'match',
    label: lastLabel,
    cobolValue: cobolMap.get(lastLabel),
    pythonValue: pythonMap.get(lastLabel),
  }
}
