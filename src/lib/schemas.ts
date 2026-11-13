/**
 * src/lib/schemas.ts
 * Zod schemas for every API boundary in the séance pipeline.
 * Import these in API handlers (server) and service callers (client) to parse
 * untrusted data before use. No React, no fetch here — pure validation.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared leaf types
// ---------------------------------------------------------------------------

/**
 * Models often write a one-line range as [5]. At the JSON boundary that means
 * [5, 5]; every other shape passes through unchanged for the tuple to judge.
 */
export function widenSingleLine(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 && typeof value[0] === 'number'
    ? [value[0], value[0]]
    : value
}

const LinePair = z.tuple([z.number().int().min(1), z.number().int().min(1)])

/** A contiguous range of 1-based inclusive line numbers [first, last]. [n] is read as [n, n]. */
export const RangeSchema = z.preprocess(
  widenSingleLine,
  LinePair.refine(([a, b]) => b >= a, { message: 'Range end must be ≥ start' }),
)

/** One narration step: the COBOL lines it covers, an optional ghost quote, and the explanation. */
export const StepSchema = z.object({
  range: RangeSchema,
  quote: z.string().optional(),
  text: z.string().min(1),
})

export type Step = z.infer<typeof StepSchema>

/** One Python line and the COBOL range it came from (or null if it has no mapping). */
export const PyLineSchema = z.object({
  text: z.string(),
  /** [a, b], or [n] read as [n, n], or null for plumbing */
  maps: z.preprocess(
    widenSingleLine,
    LinePair.refine(([a, b]) => b >= a, { message: 'maps end must be ≥ start' }).nullable(),
  ),
})

export type PyLine = z.infer<typeof PyLineSchema>

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export const ProgramSchema = z.object({
  language: z.literal('cobol'),
  dialect: z.literal('cobol85-fixed'),
  filename: z.string().min(1),
  title: z.string().min(1),
  /** Source lines, without the >>SOURCE FORMAT IS FIXED directive (runner adds it). */
  lines: z.array(z.string()).min(1).max(120),
})

export type Program = z.infer<typeof ProgramSchema>

// ---------------------------------------------------------------------------
// Summon API  (/api/summon)
// ---------------------------------------------------------------------------

export const SummonReqSchema = z.object({
  /** Plain-English task description. */
  task: z.string().min(1).max(500),
  /** First (header) row of the attached CSV, if any. */
  csvHeader: z.string().optional(),
  /** Always 'cobol' for the MVP; present for forward-compatibility. */
  language: z.literal('cobol'),
})

export type SummonReq = z.infer<typeof SummonReqSchema>

export const SummonResSchema = z.union([
  z.object({ program: ProgramSchema }),
  z.object({ unsupported: z.literal(true), reason: z.string().min(1) }),
])

export type SummonRes = z.infer<typeof SummonResSchema>

/** Type guard: narrows SummonRes to the success branch. */
export function isSummonSuccess(r: SummonRes): r is { program: Program } {
  return 'program' in r
}

// ---------------------------------------------------------------------------
// Run API  (/api/run)
// ---------------------------------------------------------------------------

export const RunReqSchema = z.object({
  /** 'fortran' and 'basic' are accepted by the schema (forward-compat) but
   *  api/run.ts rejects them at runtime with HTTP 400 "This spirit is resting." */
  language: z.enum(['cobol', 'fortran', 'basic']),
  /** COBOL source, max 20 000 characters (Req 12.2). */
  source: z.string().max(20_000),
  /** Encoded stdin, max 70 000 characters (Req 12.2). */
  stdin: z.string().max(70_000),
})

export type RunReq = z.infer<typeof RunReqSchema>

export const RunSchema = z.object({
  stdout: z.string(),
  stderr: z.string().optional(),
  exitCode: z.number().int(),
  timedOut: z.boolean().optional(),
  /** the time limit the run had, in seconds, when the runner reports it */
  timeLimitSec: z.number().positive().optional(),
  compileError: z
    .object({
      line: z.number().int().min(1).optional(),
      message: z.string(),
    })
    .optional(),
  runner: z.enum(['onlinecompiler', 'selfhost', 'fixtures', 'pyodide']),
})

export type Run = z.infer<typeof RunSchema>

// ---------------------------------------------------------------------------
// Narrate API  (/api/narrate)
// ---------------------------------------------------------------------------

export const NarrateReqSchema = z.object({
  task: z.string().min(1).max(500),
  numberedSource: z.string().min(1),
  lineCount: z.number().int().min(1),
})

export type NarrateReq = z.infer<typeof NarrateReqSchema>

export const NarrateResSchema = z.object({
  steps: z.array(StepSchema).min(1),
  python: z.array(PyLineSchema).min(1),
  note: z.string().optional(),
})

export type NarrateRes = z.infer<typeof NarrateResSchema>

// ---------------------------------------------------------------------------
// Naming the failing field in a retry message
// ---------------------------------------------------------------------------

/** "steps[2].range: Array must contain at least 2 element(s)" */
export function describeIssue(issue: z.ZodIssue): string {
  const path = issue.path.reduce<string>(
    (acc, part) => (typeof part === 'number' ? `${acc}[${part}]` : acc ? `${acc}.${part}` : String(part)),
    '',
  )
  return path ? `${path}: ${issue.message}` : issue.message
}

/** Up to `max` issues, one per line, each naming its field. */
export function describeIssues(error: z.ZodError, max = 5): string {
  const lines = error.issues.slice(0, max).map(i => `- ${describeIssue(i)}`)
  if (error.issues.length > max) lines.push(`- …and ${error.issues.length - max} more`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

export const AgreementSchema = z.object({
  status: z.enum(['match', 'mismatch', 'no-result']),
  cobolValue: z.string().optional(),
  pythonValue: z.string().optional(),
  label: z.string().optional(),
})

export type Agreement = z.infer<typeof AgreementSchema>
