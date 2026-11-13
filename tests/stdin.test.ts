/**
 * tests/stdin.test.ts
 * Example tests for the stdin protocol, including a regression test on the
 * golden sales.csv (the encoder once sent rows with no count line, so the
 * model could not write a program that matched the steering protocol).
 * Validates: proof-runner Requirements 2.1–2.4, seance-core Requirement 4.1
 */
import { describe, it, expect } from 'vitest'
import { encodeStdin, decodeStdin } from '../src/lib/stdin.ts'
// the real golden fixture, read verbatim (Vite ?raw import)
import SALES_CSV from '../src/fixtures/golden/sales.csv?raw'

describe('encodeStdin – golden sales.csv (regression)', () => {
  it('produces the count line first, then the four data rows', () => {
    expect(encodeStdin(SALES_CSV)).toBe(
      '4\nNorth,1520.25\nSouth,980.00\nEast,2105.75\nWest,1265.50\n',
    )
  })

  it('never sends the header row', () => {
    expect(encodeStdin(SALES_CSV)).not.toContain('region')
  })

  it('round-trips back to exactly the data rows', () => {
    expect(decodeStdin(encodeStdin(SALES_CSV))).toEqual([
      'North,1520.25', 'South,980.00', 'East,2105.75', 'West,1265.50',
    ])
  })

  it('carries amounts that sum to the checkpoint 5871.50', () => {
    const cents = decodeStdin(encodeStdin(SALES_CSV))
      .map(row => Math.round(Number(row.split(',')[1]) * 100))
      .reduce((a, b) => a + b, 0)
    expect(cents).toBe(587150)
  })
})

describe('encodeStdin – protocol edge cases', () => {
  it('no CSV → "0\\n"', () => {
    expect(encodeStdin(undefined)).toBe('0\n')
    expect(encodeStdin('')).toBe('0\n')
    expect(encodeStdin('   \n ')).toBe('0\n')
  })

  it('header only → "0\\n"', () => {
    expect(encodeStdin('region,amount')).toBe('0\n')
    expect(encodeStdin('region,amount\n\n')).toBe('0\n')
  })

  it('normalises CRLF and lone CR to LF', () => {
    expect(encodeStdin('h\r\na,1\r\nb,2\r\n')).toBe('2\na,1\nb,2\n')
    expect(encodeStdin('h\ra,1\rb,2')).toBe('2\na,1\nb,2\n')
  })

  it('trims trailing empty lines but keeps blank rows in the middle', () => {
    expect(encodeStdin('h\na,1\n\nb,2\n\n\n')).toBe('3\na,1\n\nb,2\n')
  })
})

describe('decodeStdin – malformed input', () => {
  it('returns [] for empty input', () => {
    expect(decodeStdin('')).toEqual([])
  })

  it('throws when the first line is not a row count', () => {
    expect(() => decodeStdin('North,1520.25\n')).toThrow('row count')
  })

  it('throws when fewer rows follow than promised', () => {
    expect(() => decodeStdin('3\na\nb\n')).toThrow('promised 3')
  })
})
