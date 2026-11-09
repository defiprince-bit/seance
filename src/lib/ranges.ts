/**
 * src/lib/ranges.ts
 * Pure functions for 1-based inclusive line ranges.
 * No React, no fetch — safe to property-test in Node.
 */
import type { Step } from './schemas.ts'

/** A 1-based inclusive line range [first, last]. */
export type Range = [number, number]

// ---------------------------------------------------------------------------
// intersects
// ---------------------------------------------------------------------------

/**
 * Returns true when ranges [a0,a1] and [b0,b1] share at least one line.
 * Both ranges are 1-based and inclusive.
 *
 * Property 1: a PyLine whose maps=[c,d] is highlighted iff
 *   intersects(activeRange, [c,d]) is true.
 */
export function intersects(a: Range, b: Range): boolean {
  const [a0, a1] = a
  const [b0, b1] = b
  return b0 <= a1 && b1 >= a0
}

// ---------------------------------------------------------------------------
// validateSteps
// ---------------------------------------------------------------------------

export type StepValidationError =
  | { kind: 'out-of-bounds'; index: number; range: Range; lineCount: number }
  | { kind: 'not-ascending'; index: number; prev: Range; curr: Range }
  | { kind: 'overlap'; index: number; prev: Range; curr: Range }

/**
 * Validates a step list against the program's line count.
 *
 * Invariants enforced (Property 2):
 *   - Every range satisfies 1 ≤ first ≤ last ≤ lineCount.
 *   - Ranges are in strictly ascending order (next.first > prev.last is NOT
 *     required — adjacent is allowed — but next.first must be ≥ prev.first).
 *   - Ranges do not overlap (next.first > prev.last).
 *
 * Returns an array of errors; empty array means the list is valid.
 */
export function validateSteps(
  steps: ReadonlyArray<Pick<Step, 'range'>>,
  lineCount: number,
): StepValidationError[] {
  const errors: StepValidationError[] = []

  for (let i = 0; i < steps.length; i++) {
    const [a, b] = steps[i].range as Range

    // bounds check
    if (a < 1 || b < a || b > lineCount) {
      errors.push({ kind: 'out-of-bounds', index: i, range: [a, b], lineCount })
      continue // skip order checks for this step; range is already invalid
    }

    if (i === 0) continue

    const [prevA, prevB] = steps[i - 1].range as Range

    // ascending: current start must be after previous start (non-overlapping
    // windows may share a boundary, but can't regress)
    if (a < prevA) {
      errors.push({ kind: 'not-ascending', index: i, prev: [prevA, prevB], curr: [a, b] })
      continue
    }

    // no overlap: current start must be strictly after previous end
    if (a <= prevB) {
      errors.push({ kind: 'overlap', index: i, prev: [prevA, prevB], curr: [a, b] })
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// firstLine
// ---------------------------------------------------------------------------

/**
 * Returns the first (top) line of a range.
 * The Planchette glides to this line when the active step changes.
 *
 * Property 3: firstLine(range) === range[0] for all valid ranges.
 */
export function firstLine(range: Range): number {
  return range[0]
}

// ---------------------------------------------------------------------------
// clampIndex
// ---------------------------------------------------------------------------

/**
 * Clamps an index to [0, length-1].
 * Used for j/k navigation so activeIndex never escapes the steps array.
 *
 * Property 3 (navigation part): moving by ±1 from any valid index stays in bounds.
 */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.max(0, Math.min(length - 1, index))
}
