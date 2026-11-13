/**
 * src/lib/golden.ts
 * Golden séances: the four suggestion chips, the fixture schema, and the rule
 * for which fixtures the capture script may (re)write. Pure; shared by the app
 * (src/services/golden.ts) and scripts/golden-capture.ts.
 *
 * Req 8.1: a golden séance is captured from real runs. A fixture marked
 * provenance "hand-made" is a placeholder for offline work only; the capture
 * script always replaces it.
 */
import { z } from 'zod'
import { ProgramSchema, RunSchema, NarrateResSchema } from './schemas.js'

// ---------------------------------------------------------------------------
// The four chips (Req 2.1). `label` is what the chip shows; `task` is what the
// ghost is asked; `csv` is the sample input fed through the stdin protocol.
// ---------------------------------------------------------------------------

export interface ChipCsv { name: string; text: string }
export interface Chip { slug: string; label: string; task: string; csv?: ChipCsv }

export const SALES_CSV = 'region,amount\nNorth,1520.25\nSouth,980.00\nEast,2105.75\nWest,1265.50\n'

export const CHIPS: readonly Chip[] = [
  {
    slug: 'sales',
    label: 'Total the sales in a CSV',
    task: 'Total the amount column of the attached sales CSV and print the result as TOTAL SALES.',
    csv: { name: 'sales.csv', text: SALES_CSV },
  },
  {
    slug: 'compound-interest',
    label: 'Compound interest for 10 years',
    task: 'Compound interest on 1000.00 at 5 percent a year for 10 years, compounded yearly. Print the result as FINAL AMOUNT.',
  },
  {
    slug: 'sort-names',
    label: 'Sort a list of names',
    task: 'Sort the names in the attached CSV alphabetically, print one per line, then print how many there were as COUNT.',
    csv: { name: 'names.csv', text: 'name\nGrace\nAda\nLinus\nBarbara\nAlan\n' },
  },
  {
    slug: 'payroll',
    label: 'Payroll with overtime',
    task: 'Work out gross pay for each employee in the attached CSV. Hours over 40 are paid at 1.5 times the hourly rate. Print each name with their pay, then TOTAL PAYROLL.',
    csv: { name: 'payroll.csv', text: 'name,hours,rate\nAda,38,25.00\nGrace,45,30.00\nAlan,50,22.50\n' },
  },
]

export const CHIP_LABELS = CHIPS.map(c => c.label)

export function chipBySlug(slug: string): Chip | undefined {
  return CHIPS.find(c => c.slug === slug)
}
export function chipByLabel(label: string): Chip | undefined {
  return CHIPS.find(c => c.label === label)
}

/** The header row sent to summon so the ghost knows the columns. */
export function csvHeader(csv: ChipCsv | undefined): string | undefined {
  return csv?.text.split(/\r?\n/)[0]
}

// ---------------------------------------------------------------------------
// Fixture schema: src/fixtures/golden/<slug>.json
// ---------------------------------------------------------------------------

export const GoldenSeanceSchema = z.object({
  version: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  task: z.string().min(1).max(500),
  csv: z.object({ name: z.string().min(1), text: z.string() }).optional(),
  /** "captured" by scripts/golden-capture.ts; "hand-made" only as an offline placeholder */
  provenance: z.enum(['captured', 'hand-made']),
  capturedAt: z.string().min(1),
  /** base URL the APIs were called at, or a note for hand-made fixtures */
  source: z.string().min(1),
  program: ProgramSchema,
  cobolRun: RunSchema,
  narration: NarrateResSchema,
  pythonRun: RunSchema,
})

export type GoldenSeance = z.infer<typeof GoldenSeanceSchema>

/** What golden-capture should do with one chip, given what is on disk. */
export type CaptureDecision = 'capture' | 'skip' | 'replace-hand-made'

export function captureDecision(existing: unknown | undefined, force: boolean): CaptureDecision {
  if (existing === undefined) return 'capture'
  const parsed = GoldenSeanceSchema.safeParse(existing)
  // a broken file is as good as missing
  if (!parsed.success) return 'capture'
  if (parsed.data.provenance === 'hand-made') return 'replace-hand-made'
  return force ? 'capture' : 'skip'
}
