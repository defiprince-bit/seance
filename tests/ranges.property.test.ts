/**
 * tests/ranges.property.test.ts
 * Property-based tests for src/lib/ranges.ts.
 * Covers Correctness Properties 1, 2 and 3 (≥200 fast-check runs each).
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { intersects, validateSteps, firstLine, clampIndex } from '../src/lib/ranges.ts'
import type { Range } from '../src/lib/ranges.ts'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A valid 1-based range [a, b] where 1 ≤ a ≤ b ≤ max. */
const rangeArb = (max: number) =>
  fc
    .tuple(fc.integer({ min: 1, max }), fc.integer({ min: 1, max }))
    .map(([a, b]): Range => (a <= b ? [a, b] : [b, a]))

/** lineCount in [1, 200]. */
const lineCountArb = fc.integer({ min: 1, max: 200 })

/**
 * Generates a valid (non-overlapping, ascending, in-bounds) step list for a
 * given lineCount. May be empty.
 */
const validStepsArb = (lineCount: number) =>
  fc.array(fc.integer({ min: 1, max: lineCount }), { minLength: 0, maxLength: 20 }).chain(
    (starts) => {
      // Sort starts, deduplicate, build non-overlapping ranges
      const sorted = [...new Set(starts)].sort((a, b) => a - b)
      const steps: Array<{ range: Range }> = []
      let cursor = 0 // next available start
      for (const s of sorted) {
        const start = Math.max(s, cursor)
        if (start > lineCount) break
        const end = fc.sample(fc.integer({ min: start, max: lineCount }), 1)[0]
        steps.push({ range: [start, end] })
        cursor = end + 1
        if (cursor > lineCount) break
      }
      return fc.constant(steps)
    },
  )

// ---------------------------------------------------------------------------
// Property 1: Highlight follows intersection
// "A PyLine is highlighted iff its maps range intersects the active range.
//  Lines with maps = null are never highlighted."
// ---------------------------------------------------------------------------
describe('Property 1 – Highlight follows intersection', () => {
  it('intersects(a, b) is true iff b[0] ≤ a[1] AND b[1] ≥ a[0]', () => {
    fc.assert(
      fc.property(rangeArb(100), rangeArb(100), (a, b) => {
        const [a0, a1] = a
        const [b0, b1] = b
        const expected = b0 <= a1 && b1 >= a0
        expect(intersects(a, b)).toBe(expected)
      }),
      { numRuns: 500 },
    )
  })

  it('intersects is symmetric: intersects(a,b) === intersects(b,a)', () => {
    fc.assert(
      fc.property(rangeArb(100), rangeArb(100), (a, b) => {
        expect(intersects(a, b)).toBe(intersects(b, a))
      }),
      { numRuns: 500 },
    )
  })

  it('a range always intersects itself', () => {
    fc.assert(
      fc.property(rangeArb(100), (r) => {
        expect(intersects(r, r)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('non-overlapping ranges do not intersect: [1,a] vs [a+1, b]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 98 }),
        fc.integer({ min: 1, max: 50 }),
        (a, extra) => {
          const left: Range = [1, a]
          const right: Range = [a + 1, a + 1 + extra]
          expect(intersects(left, right)).toBe(false)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Valid steps stay inside the program
// ---------------------------------------------------------------------------
describe('Property 2 – Valid steps stay inside the program', () => {
  it('validateSteps returns no errors for well-formed step lists', () => {
    fc.assert(
      fc.property(
        lineCountArb.chain((lineCount) =>
          validStepsArb(lineCount).map((steps) => ({ lineCount, steps })),
        ),
        ({ lineCount, steps }) => {
          const errors = validateSteps(steps, lineCount)
          expect(errors).toHaveLength(0)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('out-of-bounds range (b > lineCount) always produces an error', () => {
    fc.assert(
      fc.property(
        lineCountArb,
        fc.integer({ min: 1, max: 50 }),
        (lineCount, extra) => {
          const badStep = { range: [1, lineCount + extra] as Range }
          const errors = validateSteps([badStep], lineCount)
          expect(errors.length).toBeGreaterThan(0)
          expect(errors[0].kind).toBe('out-of-bounds')
        },
      ),
      { numRuns: 200 },
    )
  })

  it('overlapping consecutive ranges always produce an error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 49 }),
        (lineCount, a) => {
          // step1 ends at a+1, step2 starts at a (overlap)
          const end1 = Math.min(a + 1, lineCount)
          const start2 = a // ≤ end1 → overlap
          if (start2 < 1 || end1 > lineCount || start2 > end1) return
          const steps = [
            { range: [1, end1] as Range },
            { range: [start2, end1] as Range },
          ]
          const errors = validateSteps(steps, lineCount)
          expect(errors.length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: Planchette target and navigation bounds
// ---------------------------------------------------------------------------
describe('Property 3 – Planchette target is firstLine; clampIndex stays in bounds', () => {
  it('firstLine(range) === range[0] for all valid ranges', () => {
    fc.assert(
      fc.property(rangeArb(200), (r) => {
        expect(firstLine(r)).toBe(r[0])
      }),
      { numRuns: 200 },
    )
  })

  it('clampIndex(i, n) is always in [0, n-1] for n ≥ 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 300 }),
        fc.integer({ min: 1, max: 50 }),
        (index, length) => {
          const clamped = clampIndex(index, length)
          expect(clamped).toBeGreaterThanOrEqual(0)
          expect(clamped).toBeLessThanOrEqual(length - 1)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('clampIndex(i±1, n) never leaves [0, n-1] when i is already valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 49 }),
        (length, rawIndex) => {
          const i = rawIndex % length // guaranteed in bounds
          expect(clampIndex(i - 1, length)).toBeGreaterThanOrEqual(0)
          expect(clampIndex(i + 1, length)).toBeLessThanOrEqual(length - 1)
        },
      ),
      { numRuns: 200 },
    )
  })
})
