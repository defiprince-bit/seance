/**
 * tests/results.property.test.ts
 * Property-based tests for src/lib/results.ts.
 * Covers Correctness Properties 4, 5 and 6 (≥200 fast-check runs each).
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { agree, normalizeNumber, parseResultLines } from '../src/lib/results.ts'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A label: one or more non-whitespace characters (no colon). */
const labelArb = fc.stringMatching(/^[A-Z][A-Z0-9\-]{0,19}$/)

/** An integer part: 1–7 digits with no leading zeros after stripping. */
const intPartArb = fc.integer({ min: 0, max: 9_999_999 })

/** A fractional part: 0 or 2 digits (COBOL PIC 9(n)V99 style). */
const fracArb = fc.oneof(
  fc.constant(''),
  fc
    .integer({ min: 0, max: 99 })
    .map((n) => String(n).padStart(2, '0')),
)

/**
 * Builds a stdout string containing exactly one Result_Line:
 *   "LABEL: <value>\n"
 */
const singleResultLineArb = fc
  .tuple(labelArb, intPartArb, fracArb)
  .map(([label, intPart, frac]) => {
    const value = frac === '' ? String(intPart) : `${intPart}.${frac}`
    return `${label}: ${value}\n`
  })

/**
 * COBOL edited form: leading spaces + optional leading zeros + value + optional ".00"
 * e.g. "     5871.50", "0000100.00"
 */
const cobolEditedArb = fc
  .tuple(intPartArb, fracArb)
  .map(([intPart, frac]) => {
    const leadSpaces = ' '.repeat(Math.floor(Math.random() * 6))
    const valueStr = frac === '' ? String(intPart) : `${intPart}.${frac}`
    return leadSpaces + valueStr
  })


// ---------------------------------------------------------------------------
// Property 4: Agreement is symmetric and reflexive
// ---------------------------------------------------------------------------
describe('Property 4 – Agreement is symmetric and reflexive', () => {
  it('agree(s, s).status === "match" when s has ≥1 Result_Line', () => {
    fc.assert(
      fc.property(singleResultLineArb, (s) => {
        const result = agree(s, s)
        expect(result.status).toBe('match')
      }),
      { numRuns: 300 },
    )
  })

  it('agree(s1, s2).status === agree(s2, s1).status (symmetric)', () => {
    fc.assert(
      fc.property(
        fc.oneof(singleResultLineArb, fc.constant('')),
        fc.oneof(singleResultLineArb, fc.constant('')),
        (s1, s2) => {
          expect(agree(s1, s2).status).toBe(agree(s2, s1).status)
        },
      ),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 5: Number formatting does not break agreement
// ---------------------------------------------------------------------------
describe('Property 5 – Number formatting does not break agreement', () => {
  it('COBOL edited form and Python Decimal form of the same value normalize equally', () => {
    fc.assert(
      fc.property(
        labelArb,
        intPartArb,
        fracArb,
        (label, intPart, frac) => {
          const numericValue = frac === '' ? intPart : parseFloat(`${intPart}.${frac}`)

          // Construct COBOL edited: leading spaces, trailing .00 if needed
          const cobolFrac = frac === '' ? '00' : frac
          const cobolStr = `     ${intPart}.${cobolFrac}`

          // Construct Python Decimal str: no leading spaces, stripped trailing zeros
          const stripped = frac === '' ? '' : frac.replace(/0+$/, '')
          const pythonStr =
            stripped === '' ? String(intPart) : `${intPart}.${stripped}`

          expect(normalizeNumber(cobolStr)).toBe(normalizeNumber(pythonStr))

          // Also verify they agree when placed in a Result_Line
          const cobolStdout = `${label}: ${cobolStr}\n`
          const pythonStdout = `${label}: ${pythonStr}\n`
          const result = agree(cobolStdout, pythonStdout)
          expect(result.status).toBe('match')

          // suppress unused warning
          void numericValue
        },
      ),
      { numRuns: 300 },
    )
  })

  it('normalizeNumber is idempotent: normalizeNumber(normalizeNumber(x)) === normalizeNumber(x)', () => {
    fc.assert(
      fc.property(cobolEditedArb, (raw) => {
        const once = normalizeNumber(raw)
        expect(normalizeNumber(once)).toBe(once)
      }),
      { numRuns: 200 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: Any real difference is caught
// ---------------------------------------------------------------------------
describe('Property 6 – Any real difference is caught', () => {
  it('different label → mismatch', () => {
    fc.assert(
      fc.property(
        labelArb,
        labelArb,
        intPartArb,
        (label1, label2, value) => {
          fc.pre(label1 !== label2)
          const s1 = `${label1}: ${value}\n`
          const s2 = `${label2}: ${value}\n`
          expect(agree(s1, s2).status).toBe('mismatch')
        },
      ),
      { numRuns: 200 },
    )
  })

  it('different value under the same label → mismatch', () => {
    fc.assert(
      fc.property(
        labelArb,
        intPartArb,
        intPartArb,
        (label, v1, v2) => {
          fc.pre(v1 !== v2)
          const s1 = `${label}: ${v1}\n`
          const s2 = `${label}: ${v2}\n`
          expect(agree(s1, s2).status).toBe('mismatch')
        },
      ),
      { numRuns: 200 },
    )
  })

  it('extra label in one side → mismatch', () => {
    fc.assert(
      fc.property(
        labelArb,
        labelArb,
        intPartArb,
        (label1, label2, value) => {
          fc.pre(label1 !== label2)
          const s1 = `${label1}: ${value}\n${label2}: ${value}\n`
          const s2 = `${label1}: ${value}\n`
          expect(agree(s1, s2).status).toBe('mismatch')
        },
      ),
      { numRuns: 200 },
    )
  })

  it('no Result_Lines in either → no-result', () => {
    expect(agree('', '').status).toBe('no-result')
    expect(agree('just noise\n', 'also noise\n').status).toBe('no-result')
  })
})

// ---------------------------------------------------------------------------
// Example tests for parseResultLines (sanity checks)
// ---------------------------------------------------------------------------
describe('parseResultLines – example tests', () => {
  it('parses a single Result_Line', () => {
    const map = parseResultLines('TOTAL: 5871.50\n')
    expect(map.get('TOTAL')).toBe('5871.50')
  })

  it('parses multiple Result_Lines and ignores other output', () => {
    const stdout = [
      'Reading input...',
      'PRINCIPAL: 1000.00',
      'INTEREST:  120.00',
      'AMOUNT:    1120.00',
      '',
    ].join('\n')
    const map = parseResultLines(stdout)
    expect(map.size).toBe(3)
    expect(map.get('PRINCIPAL')).toBe('1000.00')
    expect(map.get('INTEREST')).toBe('120.00')
    expect(map.get('AMOUNT')).toBe('1120.00')
  })

  // regression: labels with spaces were ignored, so a live sales séance whose
  // runs both printed 5871.50 showed "No result line to compare."
  it('parses labels with spaces, as in the steering example', () => {
    expect(parseResultLines('TOTAL SALES:      5871.50\n').get('TOTAL SALES')).toBe('5871.50')
  })

  it('live sales séance output agrees (COBOL edited vs Python f-string)', () => {
    const a = agree('TOTAL SALES:   5871.50\n', 'TOTAL SALES:   5871.50')
    expect(a.status).toBe('match')
    expect(a.cobolValue?.trim()).toBe('5871.50')
  })

  it('treats repeated spaces inside a label as one', () => {
    expect(agree('TOTAL  SALES: 1.00', 'TOTAL SALES: 1.00').status).toBe('match')
  })

  it('ignores ordinary prose lines that contain a colon', () => {
    expect(parseResultLines('Reading input: 4 rows\n').size).toBe(0)
  })

  it('returns empty map for stdout with no Result_Lines', () => {
    expect(parseResultLines('Hello, World!\n').size).toBe(0)
  })
})
