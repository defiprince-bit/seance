// Property 1: Stdin round-trip — Validates: proof-runner Requirements 2.1, 2.2, 2.4
/**
 * tests/stdin.property.test.ts
 * For any header and rows without embedded newlines, decodeStdin(encodeStdin(csv))
 * returns the rows, and the first encoded line is the row count.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { encodeStdin, decodeStdin } from '../src/lib/stdin.ts'

// a CSV cell/row with no line breaks
const lineArb = fc.string({ maxLength: 30 }).filter(s => !/[\r\n]/.test(s))
// the encoder trims trailing empty lines, so the last row must be non-blank
const rowsArb = fc
  .array(lineArb, { maxLength: 40 })
  .filter(rows => rows.length === 0 || rows[rows.length - 1].trim() !== '')
const eolArb = fc.constantFrom('\n', '\r\n')

describe('Property 1 – stdin round-trip', () => {
  it('decode(encode(header + rows)) === rows, and line 1 is rows.length', () => {
    fc.assert(
      fc.property(lineArb.filter(h => h.trim() !== ''), rowsArb, eolArb, (header, rows, eol) => {
        const csv = [header, ...rows].join(eol) + eol
        const encoded = encodeStdin(csv)
        expect(encoded.split('\n')[0]).toBe(String(rows.length))
        expect(decodeStdin(encoded)).toEqual(rows)
      }),
      { numRuns: 300 },
    )
  })

  it('the encoded stream always ends with exactly one newline after the last row', () => {
    fc.assert(
      fc.property(lineArb.filter(h => h.trim() !== ''), rowsArb, (header, rows) => {
        const encoded = encodeStdin([header, ...rows].join('\n'))
        expect(encoded.endsWith('\n')).toBe(true)
        expect(encoded.split('\n').length).toBe(rows.length + 2) // count + rows + final ''
      }),
      { numRuns: 200 },
    )
  })
})
