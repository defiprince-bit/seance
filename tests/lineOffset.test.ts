/**
 * tests/lineOffset.test.ts
 * remapCompilerMessage / firstErrorLine against real GnuCOBOL 3.2 output.
 * Validates: Requirement 4.2 (line numbers refer to the lines the user sees)
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { remapCompilerMessage, firstErrorLine } from '../src/lib/lineOffset.ts'

// Shape of a live run (directive is compiler line 1, so user line N = compiler N+1)
const LIVE = [
  "code.cob: in paragraph 'MAIN-PARA':",
  "code.cob:22: error: 'WS-LINE' is not defined",
  '   21 |            ACCEPT WS-COUNT',
  '   22 >            ACCEPT WS-LINE',
  '   23 |            UNSTRING WS-LINE DELIMITED BY "," INTO WS-REGION',
].join('\n')

describe('remapCompilerMessage – regression: identifiers ending in LINE', () => {
  it('does not shift the snippet row after a line ending in WS-LINE twice', () => {
    const out = remapCompilerMessage(LIVE, 1).split('\n')
    expect(out[1]).toBe("code.cob:21: error: 'WS-LINE' is not defined")
    expect(out[2]).toBe('   20 |            ACCEPT WS-COUNT')
    expect(out[3]).toBe('   21 >            ACCEPT WS-LINE')
    expect(out[4]).toBe('   22 |            UNSTRING WS-LINE DELIMITED BY "," INTO WS-REGION')
  })

  it('leaves identifiers and their text untouched', () => {
    expect(remapCompilerMessage('MOVE 5 TO WS-LINE 7', 1)).toBe('MOVE 5 TO WS-LINE 7')
    expect(remapCompilerMessage("'SALES-LINE' is not defined", 1)).toBe("'SALES-LINE' is not defined")
  })
})

describe('remapCompilerMessage – snippet numbers match CodePane', () => {
  it('keeps the gutter width when the number gets shorter', () => {
    expect(remapCompilerMessage('   10 |        DATA DIVISION.', 1)).toBe('    9 |        DATA DIVISION.')
  })

  it('every snippet row names the source line CodePane shows with that number', () => {
    const source = ['       IDENTIFICATION DIVISION.', '       PROGRAM-ID. X.', '       PROCEDURE DIVISION.']
    // what the compiler saw: the directive on line 1, then the user's source
    const compiled = ['>>SOURCE FORMAT IS FIXED', ...source]
    const msg = ['code.cob:3: error: oops', ...compiled.map((l, i) => `${String(i + 1).padStart(5)} | ${l}`)].join('\n')
    const rows = remapCompilerMessage(msg, 1).split('\n').slice(1)
    for (const row of rows) {
      const m = /^\s*(\d+) \| (.*)$/.exec(row)!
      expect(m[2]).toBe(source[Number(m[1]) - 1])
    }
  })

  it('drops the snippet row that shows the injected directive', () => {
    const msg = 'code.cob:2: error: x\n    1 | >>SOURCE FORMAT IS FIXED\n    2 >        IDENTIFICATON DIVISION.'
    expect(remapCompilerMessage(msg, 1)).toBe('code.cob:1: error: x\n    1 >        IDENTIFICATON DIVISION.')
  })
})

describe('remapCompilerMessage – diagnostics and prose', () => {
  it('remaps file:N: and file:N:C: locations', () => {
    expect(remapCompilerMessage('prog.cbl:5:12: error: bad', 1)).toBe('prog.cbl:4:12: error: bad')
  })

  it('remaps a standalone "line N" but never below 1', () => {
    expect(remapCompilerMessage('expected END-IF at line 9', 1)).toBe('expected END-IF at line 8')
    expect(remapCompilerMessage('code.cob:1: error: x', 1)).toBe('code.cob:1: error: x')
  })

  it('offset 0 is the identity', () => {
    expect(remapCompilerMessage(LIVE, 0)).toBe(LIVE)
  })

  it('property: text with no diagnostics, snippets or "line N" is unchanged', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z][A-Z0-9 '-]{0,40}$/), s => {
        fc.pre(!/(?<![\w-])line\s+\d/i.test(s))
        expect(remapCompilerMessage(s, 1)).toBe(s)
      }),
      { numRuns: 200 },
    )
  })
})

describe('firstErrorLine', () => {
  it('skips the "in paragraph" header and notes, and returns the first error', () => {
    const msg = "code.cob: in paragraph 'MAIN':\ncode.cob:13: note: unknown statement '01'\ncode.cob:14: error: syntax error"
    expect(firstErrorLine(msg)).toBe(14)
  })

  it('falls back to the first diagnostic of any kind, or undefined', () => {
    expect(firstErrorLine('code.cob:7: warning: x')).toBe(7)
    expect(firstErrorLine('internal error: link phase failed')).toBeUndefined()
  })
})
