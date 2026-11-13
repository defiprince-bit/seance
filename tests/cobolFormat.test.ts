/**
 * tests/cobolFormat.test.ts
 * Fixed-format column checks. Both regressions below came from live summons
 * that GnuCOBOL rejected.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { lintFixedFormat } from '../src/lib/cobolFormat.ts'

const good = [
  '      * Read every sale and add it up',
  '       IDENTIFICATION DIVISION.',
  '       PROGRAM-ID. TOTAL-SALES.',
  '       01  WS-TOTAL            PIC S9(7)V99 VALUE ZERO.',
  '           PERFORM VARYING WS-I FROM 1 BY 1',
  '               UNTIL WS-I > WS-COUNT',
  '           DISPLAY "TOTAL SALES: " WS-TOTAL-EDITED *> floating comment',
  '',
  '           STOP RUN.',
]

describe('lintFixedFormat', () => {
  it('accepts well-formed fixed-format lines', () => {
    expect(lintFixedFormat(good)).toEqual([])
  })

  it('regression: * in column 8 is flagged as a misplaced comment', () => {
    const issues = lintFixedFormat(['       IDENTIFICATION DIVISION.', '       * Main processing'])
    expect(issues).toEqual([expect.objectContaining({ line: 2, kind: 'comment-column' })])
  })

  it('regression: a statement past column 72 is flagged and names the lost text', () => {
    const line = '           PERFORM VARYING WS-INDEX FROM 1 BY 1 UNTIL WS-INDEX > WS-COUNT'
    expect(line.length).toBe(73)
    const [issue] = lintFixedFormat([line])
    expect(issue.kind).toBe('too-long')
    expect(issue.detail).toContain('"T" is lost')
  })

  it('trailing spaces past column 72 do not count', () => {
    expect(lintFixedFormat(['       STOP RUN.' + ' '.repeat(80)])).toEqual([])
  })

  it('flags tabs', () => {
    expect(lintFixedFormat(['\tSTOP RUN.'])[0].kind).toBe('tab')
  })

  it('flags code in the sequence area and in column 7', () => {
    expect(lintFixedFormat(['IDENTIFICATION DIVISION.'])[0].kind).toBe('sequence-area')
    expect(lintFixedFormat(['      PROCEDURE DIVISION.'])[0].kind).toBe('indicator')
  })

  it('allows numeric sequence numbers in columns 1–6', () => {
    expect(lintFixedFormat(['000100 IDENTIFICATION DIVISION.'])).toEqual([])
  })

  it('reports 1-based line numbers', () => {
    expect(lintFixedFormat(['', '', '\tX'])[0].line).toBe(3)
  })

  it('property: any Area-B line of ≤61 printable chars passes', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z0-9 .,"()=+\-]{1,61}$/), body => {
        fc.pre(body.trim() !== '' && !body.trimStart().startsWith('*'))
        expect(lintFixedFormat(['           ' + body])).toEqual([])
      }),
      { numRuns: 200 },
    )
  })
})
