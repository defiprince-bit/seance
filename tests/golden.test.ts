/**
 * tests/golden.test.ts  (task 10.3)
 * Every golden séance in src/fixtures/golden/ parses with the schemas, belongs
 * to a chip, and its stored COBOL and Python runs agree (match). Fixtures are
 * read from disk, so a newly captured file is checked the same way.
 * Validates: Requirements 2.1, 2.2, 8.1
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GoldenSeanceSchema, CHIPS, CHIP_LABELS, SALES_CSV, chipBySlug, captureDecision } from '../src/lib/golden.ts'
import { agree } from '../src/lib/results.ts'
import { validateSteps } from '../src/lib/ranges.ts'
import { lintFixedFormat } from '../src/lib/cobolFormat.ts'
import { missingImports } from '../src/lib/pythonImports.ts'
import { goldenFor, goldenSlugs } from '../src/services/golden.ts'

const DIR = join(process.cwd(), 'src', 'fixtures', 'golden')
const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
const fixtures = files.map(f => ({ file: f, data: JSON.parse(readFileSync(join(DIR, f), 'utf8')) as unknown }))

describe('the chips', () => {
  it('are exactly the four from Req 2.1, in order', () => {
    expect(CHIP_LABELS).toEqual(['Total the sales in a CSV', 'Compound interest for 10 years', 'Sort a list of names', 'Payroll with overtime'])
  })

  it('have unique slugs and tasks within the 500-character summon limit', () => {
    expect(new Set(CHIPS.map(c => c.slug)).size).toBe(CHIPS.length)
    for (const c of CHIPS) expect(c.task.length).toBeLessThanOrEqual(500)
  })

  it('the sales chip uses the same CSV as src/fixtures/golden/sales.csv', () => {
    expect(readFileSync(join(DIR, 'sales.csv'), 'utf8').replace(/\r\n/g, '\n')).toBe(SALES_CSV)
  })
})

describe('golden fixtures', () => {
  it('there is at least one', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  describe.each(fixtures)('$file', ({ file, data }) => {
    const parsed = GoldenSeanceSchema.safeParse(data)

    it('parses with the golden schema (program, both runs, narration)', () => {
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true)
    })
    if (!parsed.success) return
    const g = parsed.data

    it("is named after its chip's slug and matches that chip", () => {
      expect(file).toBe(`${g.slug}.json`)
      const chip = chipBySlug(g.slug)
      expect(chip).toBeDefined()
      expect(g.label).toBe(chip!.label)
      expect(g.task).toBe(chip!.task)
      expect(g.csv).toEqual(chip!.csv)
    })

    it('its stored COBOL and Python runs agree (match)', () => {
      expect(g.cobolRun.exitCode).toBe(0)
      expect(g.cobolRun.compileError).toBeUndefined()
      expect(g.pythonRun.exitCode).toBe(0)
      expect(agree(g.cobolRun.stdout, g.pythonRun.stdout).status).toBe('match')
    })

    it('the program passes the fixed-format lint and the narration fits it', () => {
      expect(lintFixedFormat(g.program.lines)).toEqual([])
      expect(validateSteps(g.narration.steps, g.program.lines.length)).toEqual([])
      for (const l of g.narration.python) {
        if (l.maps) expect(l.maps[1]).toBeLessThanOrEqual(g.program.lines.length)
      }
    })

    it('the Python imports everything it uses', () => {
      expect(missingImports(g.narration.python.map(l => l.text).join('\n'))).toEqual([])
    })

    it('the app loads it, so its chip replays instead of summoning live', () => {
      expect(goldenFor(g.slug)?.program.lines).toEqual(g.program.lines)
    })

    it('a hand-made placeholder will be replaced by the capture script (Req 8.1)', () => {
      if (g.provenance === 'hand-made') expect(captureDecision(data, false)).toBe('replace-hand-made')
      else expect(captureDecision(data, false)).toBe('skip')
    })
  })
})

describe('the sales placeholder for offline work', () => {
  it('replays 5871.50 in both runs', () => {
    const g = goldenFor('sales')
    expect(g).toBeDefined()
    const a = agree(g!.cobolRun.stdout, g!.pythonRun.stdout)
    expect(a).toMatchObject({ status: 'match', label: 'TOTAL SALES' })
    expect(a.cobolValue?.trim()).toBe('5871.50')
  })

  it('the loader has exactly the slugs that are on disk', () => {
    expect(goldenSlugs()).toEqual(fixtures.map(f => f.file.replace(/\.json$/, '')).sort())
  })
})
