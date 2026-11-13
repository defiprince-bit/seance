/**
 * tests/compileError.test.ts
 * The compile ErrorState summary and the "Let the ghost fix it" stub task.
 * Messages are real GnuCOBOL 3.2 output from live runs. Validates: Requirement 4.4
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { summarizeCompileError, buildFixTask, TASK_LIMIT } from '../src/lib/compileError.ts'

const LONG = '           PERFORM VARYING WS-INDEX FROM 1 BY 1 UNTIL WS-INDEX > WS-COUNT'

describe('summarizeCompileError', () => {
  it('"is not defined": underlines the name and explains the column-72 cut', () => {
    const msg = "code.cob: in paragraph 'MAIN-PARA':\ncode.cob:1: error: 'WS-COUN' is not defined\n    1 >" + LONG
    const sum = summarizeCompileError(msg, 1, [LONG])
    expect(sum.token).toBe('WS-COUN')
    expect(sum.plain).toBe("WS-COUN isn't declared in the DATA DIVISION. This line runs past column 72, and the compiler ignores everything after it.")
    expect(sum.technical).toBe("'WS-COUN' is not defined")
  })

  it('"syntax error, unexpected *": underlines the stray *', () => {
    const line = '       * Main processing'
    const sum = summarizeCompileError('code.cob:3: error: syntax error, unexpected *', 3, ['', '', line])
    expect(sum.token).toBe('*')
    expect(sum.plain).toBe("The compiler didn't expect * here.")
  })

  it('does not underline token-class words like Identifier', () => {
    const sum = summarizeCompileError('code.cob:1: error: syntax error, unexpected Identifier', 1, ['       01 WS-X PIC 9.'])
    expect(sum.token).toBeUndefined()
  })

  it('a token that is not on the error line is not underlined', () => {
    const sum = summarizeCompileError("code.cob:1: error: 'WS-Y' is not defined", 1, ['       MOVE 1 TO WS-X'])
    expect(sum.token).toBeUndefined()
  })

  it('falls back to the first line when there is no "error:" diagnostic', () => {
    const sum = summarizeCompileError('internal error: link phase failed', undefined, [])
    expect(sum.plain).toBe('Internal error: link phase failed.')
    expect(sum.token).toBeUndefined()
  })
})

describe('buildFixTask (stub for "Let the ghost fix it")', () => {
  it('keeps the original task and adds the compiler message', () => {
    const t = buildFixTask('Total the sales in a CSV', "GnuCOBOL said, at line 21: 'WS-COUN' is not defined")
    expect(t.startsWith('Total the sales in a CSV')).toBe(true)
    expect(t).toContain("'WS-COUN' is not defined")
    expect(t.endsWith('Write a corrected program.')).toBe(true)
  })

  it('property: always fits the 500-character summon limit and starts with the task', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 500 }), fc.string({ maxLength: 3000 }), (task, failure) => {
        fc.pre(task.trim() !== '')
        const t = buildFixTask(task, failure)
        expect(t.length).toBeLessThanOrEqual(TASK_LIMIT)
        expect(t.startsWith(task.trim().slice(0, 300))).toBe(true)
      }),
      { numRuns: 300 },
    )
  })
})
