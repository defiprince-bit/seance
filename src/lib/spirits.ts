/**
 * src/lib/spirits.ts
 * The dead languages Séance knows about (Req 9) and the roving-selection rule
 * the picker uses. Only COBOL is enabled; Fortran and BASIC are "Resting" and
 * can never be selected. Pure.
 */

export interface Spirit {
  id: string
  name: string
  born: number
  epithet: string
  blurb: string
  /** a few lines of the language, shown on enabled cards */
  snippet?: string
  traits: string[]
  dialect?: string
  enabled: boolean
}

export const SPIRITS: readonly Spirit[] = [
  {
    id: 'cobol',
    name: 'COBOL',
    born: 1959,
    epithet: 'The ledger keeper',
    blurb: 'Records, money and files. Wordy on purpose, so a manager could read it.',
    snippet: 'UNSTRING SALES-LINE\n  DELIMITED BY ","\n  INTO WS-REGION WS-AMOUNT-TXT\nADD WS-AMOUNT TO WS-TOTAL',
    traits: ['Reads like English', 'Exact decimals', 'Fixed columns'],
    dialect: 'COBOL-85, fixed format',
    enabled: true,
  },
  {
    id: 'fortran',
    name: 'Fortran',
    born: 1957,
    epithet: 'The calculator',
    blurb: "Numbers, arrays and formulas. Made so scientists didn't have to write machine code.",
    traits: ['Fast maths', 'Arrays first', 'Terse'],
    enabled: false,
  },
  {
    id: 'basic',
    name: 'BASIC',
    born: 1964,
    epithet: 'The first teacher',
    blurb: 'Line numbers, GOTO and instant answers. Built for students at a shared terminal.',
    traits: ['Beginner friendly', 'Line numbers', 'GOTO'],
    enabled: false,
  },
]

/** Index of the spirit with this id if it is enabled, else the first enabled one (or 0). */
export function initialIndex(spirits: readonly Spirit[], id: string): number {
  const exact = spirits.findIndex(s => s.id === id && s.enabled)
  if (exact >= 0) return exact
  const first = spirits.findIndex(s => s.enabled)
  return first >= 0 ? first : 0
}

/**
 * The next enabled spirit from `from`, moving `step` (+1 / -1) and wrapping.
 * Resting spirits are skipped; with no other enabled spirit, stays on `from`.
 */
export function nextEnabledIndex(spirits: readonly Spirit[], from: number, step: 1 | -1): number {
  const n = spirits.length
  for (let i = 1; i < n; i++) {
    const idx = (((from + step * i) % n) + n) % n
    if (spirits[idx].enabled) return idx
  }
  return from
}
