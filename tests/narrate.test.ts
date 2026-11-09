/**
 * tests/narrate.test.ts
 * Example tests for the Narrate API layer.
 * fetch is mocked — no network calls are made.
 *
 * Requirements: 5.1, 6.1, 6.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NarrateResSchema, NarrateReqSchema } from '../src/lib/schemas.ts'
import { validateSteps } from '../src/lib/ranges.ts'
import {
  NARRATE_SYSTEM_PROMPT,
  buildNarrateUserPrompt,
  buildRepairPrompt,
} from '../server/llm/prompts/narrate.ts'
import type { StepValidationError } from '../src/lib/ranges.ts'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('LLM_API_KEY', 'fake-key')
  vi.stubEnv('LLM_MODEL', 'fake-model')
  vi.stubEnv('LLM_BASE_URL', 'https://fake.llm/v1')
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_NARRATE_RES = {
  steps: [
    { range: [1, 3] as [number, number], quote: 'First things first.', text: 'The IDENTIFICATION DIVISION names the program.' },
    { range: [4, 10] as [number, number], text: 'DATA DIVISION declares every variable with a PIC clause, like a typed struct.' },
    { range: [11, 20] as [number, number], text: 'PROCEDURE DIVISION runs the logic: ACCEPT reads stdin, COMPUTE calculates, DISPLAY prints.' },
  ],
  python: [
    { text: 'import sys', maps: null },
    { text: 'from decimal import Decimal', maps: null },
    { text: 'total = Decimal("0")', maps: [11, 12] as [number, number] },
    { text: 'print(f"TOTAL: {total}")', maps: [18, 20] as [number, number] },
  ],
  note: 'Uses decimal.Decimal instead of COBOL fixed-point PIC V99.',
}

// ---------------------------------------------------------------------------
// NarrateResSchema
// ---------------------------------------------------------------------------

describe('NarrateResSchema', () => {
  it('accepts a well-formed response', () => {
    const result = NarrateResSchema.safeParse(VALID_NARRATE_RES)
    expect(result.success).toBe(true)
  })

  it('rejects a response with no steps', () => {
    const result = NarrateResSchema.safeParse({ ...VALID_NARRATE_RES, steps: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a response with no python lines', () => {
    const result = NarrateResSchema.safeParse({ ...VALID_NARRATE_RES, python: [] })
    expect(result.success).toBe(false)
  })

  it('accepts a response without a note', () => {
    const { note: _note, ...withoutNote } = VALID_NARRATE_RES
    const result = NarrateResSchema.safeParse(withoutNote)
    expect(result.success).toBe(true)
  })

  it('rejects a step with range end < start', () => {
    const bad = {
      ...VALID_NARRATE_RES,
      steps: [{ range: [5, 3], text: 'Bad range' }],
    }
    const result = NarrateResSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects a PyLine with non-null maps where end < start', () => {
    const bad = {
      ...VALID_NARRATE_RES,
      python: [{ text: 'x = 1', maps: [5, 3] }],
    }
    const result = NarrateResSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('accepts a PyLine with maps: null', () => {
    const result = NarrateResSchema.safeParse({
      ...VALID_NARRATE_RES,
      python: [{ text: 'import sys', maps: null }],
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// NarrateReqSchema
// ---------------------------------------------------------------------------

describe('NarrateReqSchema', () => {
  it('accepts a valid request', () => {
    const result = NarrateReqSchema.safeParse({
      task: 'Total sales',
      numberedSource: '0001  IDENTIFICATION DIVISION.',
      lineCount: 20,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty task', () => {
    const result = NarrateReqSchema.safeParse({
      task: '',
      numberedSource: '0001  x',
      lineCount: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects task longer than 500 chars', () => {
    const result = NarrateReqSchema.safeParse({
      task: 'x'.repeat(501),
      numberedSource: '0001  x',
      lineCount: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects lineCount of 0', () => {
    const result = NarrateReqSchema.safeParse({
      task: 'test',
      numberedSource: '0001  x',
      lineCount: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateSteps (integrated with NarrateRes)
// ---------------------------------------------------------------------------

describe('validateSteps with narrate steps', () => {
  it('passes for VALID_NARRATE_RES steps against lineCount 20', () => {
    const errors = validateSteps(VALID_NARRATE_RES.steps, 20)
    expect(errors).toHaveLength(0)
  })

  it('catches out-of-bounds when step range exceeds lineCount', () => {
    const steps = [{ range: [1, 25] as [number, number] }]
    const errors = validateSteps(steps, 20)
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('out-of-bounds')
  })

  it('catches overlap between consecutive steps', () => {
    const steps = [
      { range: [1, 10] as [number, number] },
      { range: [8, 15] as [number, number] },
    ]
    const errors = validateSteps(steps, 20)
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('overlap')
  })

  it('catches non-ascending order', () => {
    const steps = [
      { range: [5, 10] as [number, number] },
      { range: [2, 4] as [number, number] },
    ]
    const errors = validateSteps(steps, 20)
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('not-ascending')
  })
})

// ---------------------------------------------------------------------------
// buildNarrateUserPrompt
// ---------------------------------------------------------------------------

describe('buildNarrateUserPrompt', () => {
  it('includes the task text', () => {
    const prompt = buildNarrateUserPrompt({
      task: 'Compound interest',
      numberedSource: '0001  IDENTIFICATION DIVISION.',
      lineCount: 1,
    })
    expect(prompt).toContain('Compound interest')
  })

  it('includes the numbered source verbatim', () => {
    const numberedSource = '0001  IDENTIFICATION DIVISION.\n0002  PROGRAM-ID. TEST.'
    const prompt = buildNarrateUserPrompt({
      task: 'test',
      numberedSource,
      lineCount: 2,
    })
    expect(prompt).toContain(numberedSource)
  })

  it('includes the total line count', () => {
    const prompt = buildNarrateUserPrompt({
      task: 'test',
      numberedSource: '0001  x',
      lineCount: 42,
    })
    expect(prompt).toContain('42')
  })
})

// ---------------------------------------------------------------------------
// buildRepairPrompt
// ---------------------------------------------------------------------------

describe('buildRepairPrompt', () => {
  it('includes out-of-bounds error details', () => {
    const errors: StepValidationError[] = [
      { kind: 'out-of-bounds', index: 0, range: [1, 25], lineCount: 20 },
    ]
    const prompt = buildRepairPrompt(errors)
    expect(prompt).toContain('out of bounds')
    expect(prompt).toContain('25')
    expect(prompt).toContain('20')
  })

  it('includes overlap error details', () => {
    const errors: StepValidationError[] = [
      { kind: 'overlap', index: 1, prev: [1, 10], curr: [8, 15] },
    ]
    const prompt = buildRepairPrompt(errors)
    expect(prompt).toContain('overlap')
    expect(prompt).toContain('[8, 15]')
    expect(prompt).toContain('[1, 10]')
  })

  it('includes not-ascending error details', () => {
    const errors: StepValidationError[] = [
      { kind: 'not-ascending', index: 2, prev: [5, 10], curr: [2, 4] },
    ]
    const prompt = buildRepairPrompt(errors)
    expect(prompt).toContain('ascending')
    expect(prompt).toContain('[2, 4]')
  })

  it('lists multiple errors', () => {
    const errors: StepValidationError[] = [
      { kind: 'out-of-bounds', index: 0, range: [1, 99], lineCount: 20 },
      { kind: 'overlap', index: 1, prev: [1, 5], curr: [3, 8] },
    ]
    const prompt = buildRepairPrompt(errors)
    expect(prompt).toContain('1.')
    expect(prompt).toContain('2.')
  })
})

// ---------------------------------------------------------------------------
// System prompt sanity checks
// ---------------------------------------------------------------------------

describe('NARRATE_SYSTEM_PROMPT', () => {
  it('mentions the required output fields', () => {
    expect(NARRATE_SYSTEM_PROMPT).toContain('"steps"')
    expect(NARRATE_SYSTEM_PROMPT).toContain('"python"')
    expect(NARRATE_SYSTEM_PROMPT).toContain('"note"')
  })

  it('specifies 4–10 steps', () => {
    expect(NARRATE_SYSTEM_PROMPT).toContain('4–10')
  })

  it('mentions Decimal for fixed-point values', () => {
    expect(NARRATE_SYSTEM_PROMPT).toContain('Decimal')
  })

  it('does not contain banned words', () => {
    const banned = ['Ouija', 'boo', 'spooky', 'mwahaha', 'AI magic']
    for (const word of banned) {
      expect(NARRATE_SYSTEM_PROMPT).not.toContain(word)
    }
  })
})
