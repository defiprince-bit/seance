/**
 * tests/schemas.property.test.ts
 * Property-based tests for src/lib/schemas.ts.
 * Covers Correctness Property 7: input limits (≥200 fast-check runs each).
 *
 * Requirements validated: 1.5, 1.7, 3.7, 12.2
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  SummonReqSchema,
  RunReqSchema,
  ProgramSchema,
  StepSchema,
  PyLineSchema,
} from '../src/lib/schemas.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a string of exactly `n` characters. */
const strOfLen = (n: number) => 'x'.repeat(n)

// ---------------------------------------------------------------------------
// Property 7: Input limits — oversized strings are rejected
// ---------------------------------------------------------------------------
describe('Property 7 – Input limits', () => {
  // --- SummonReq: task ≤ 500 chars ---
  it('SummonReq rejects task longer than 500 chars', () => {
    fc.assert(
      fc.property(fc.integer({ min: 501, max: 2000 }), (len) => {
        const result = SummonReqSchema.safeParse({
          task: strOfLen(len),
          language: 'cobol',
        })
        expect(result.success).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('SummonReq accepts task of exactly 500 chars', () => {
    const result = SummonReqSchema.safeParse({ task: strOfLen(500), language: 'cobol' })
    expect(result.success).toBe(true)
  })

  it('SummonReq rejects empty task', () => {
    const result = SummonReqSchema.safeParse({ task: '', language: 'cobol' })
    expect(result.success).toBe(false)
  })

  // --- RunReq: source ≤ 20 000 chars, stdin ≤ 70 000 chars ---
  it('RunReq rejects source longer than 20 000 chars', () => {
    fc.assert(
      fc.property(fc.integer({ min: 20_001, max: 25_000 }), (len) => {
        const result = RunReqSchema.safeParse({
          language: 'cobol',
          source: strOfLen(len),
          stdin: '',
        })
        expect(result.success).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('RunReq accepts source of exactly 20 000 chars', () => {
    const result = RunReqSchema.safeParse({
      language: 'cobol',
      source: strOfLen(20_000),
      stdin: '',
    })
    expect(result.success).toBe(true)
  })

  it('RunReq rejects stdin longer than 70 000 chars', () => {
    fc.assert(
      fc.property(fc.integer({ min: 70_001, max: 75_000 }), (len) => {
        const result = RunReqSchema.safeParse({
          language: 'cobol',
          source: '',
          stdin: strOfLen(len),
        })
        expect(result.success).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('RunReq accepts stdin of exactly 70 000 chars', () => {
    const result = RunReqSchema.safeParse({
      language: 'cobol',
      source: '',
      stdin: strOfLen(70_000),
    })
    expect(result.success).toBe(true)
  })

  // --- Program: lines 1..120 ---
  it('ProgramSchema rejects programs with 0 lines', () => {
    const result = ProgramSchema.safeParse({
      language: 'cobol',
      dialect: 'cobol85-fixed',
      filename: 'test.cob',
      title: 'Test',
      lines: [],
    })
    expect(result.success).toBe(false)
  })

  it('ProgramSchema rejects programs with more than 120 lines', () => {
    fc.assert(
      fc.property(fc.integer({ min: 121, max: 200 }), (len) => {
        const result = ProgramSchema.safeParse({
          language: 'cobol',
          dialect: 'cobol85-fixed',
          filename: 'test.cob',
          title: 'Test',
          lines: Array.from({ length: len }, () => 'x'),
        })
        expect(result.success).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('ProgramSchema accepts exactly 120 lines', () => {
    const result = ProgramSchema.safeParse({
      language: 'cobol',
      dialect: 'cobol85-fixed',
      filename: 'test.cob',
      title: 'Test',
      lines: Array.from({ length: 120 }, () => 'x'),
    })
    expect(result.success).toBe(true)
  })

  // --- RunReq: language guard (schema accepts fortran/basic, runtime rejects) ---
  it('RunReq schema accepts fortran and basic (runtime guard is in api/run.ts)', () => {
    for (const lang of ['fortran', 'basic'] as const) {
      const result = RunReqSchema.safeParse({ language: lang, source: '', stdin: '' })
      expect(result.success).toBe(true)
    }
  })

  // --- Step: range end ≥ start ---
  it('StepSchema rejects ranges where end < start', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 99 }),
        (start, offset) => {
          const end = Math.max(1, start - offset)
          if (end >= start) return // skip valid ranges
          const result = StepSchema.safeParse({
            range: [start, end],
            text: 'some text',
          })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 200 },
    )
  })

  // --- PyLine: maps end ≥ start (when non-null) ---
  it('PyLineSchema rejects maps where end < start', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 99 }),
        (start, offset) => {
          const end = Math.max(1, start - offset)
          if (end >= start) return
          const result = PyLineSchema.safeParse({
            text: 'pass',
            maps: [start, end],
          })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('PyLineSchema accepts maps: null', () => {
    const result = PyLineSchema.safeParse({ text: '# comment', maps: null })
    expect(result.success).toBe(true)
  })
})
