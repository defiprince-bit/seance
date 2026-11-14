/**
 * tests/goldenCapture.test.ts  (task 10.1)
 * scripts/golden-capture.ts, fully offline: fetch, Pyodide, the clock and the
 * sleeps are all fakes. main() is never called, so nothing is written.
 */
import { describe, it, expect, vi } from 'vitest'
import { parseArgs, Pacer, retryAfterMs, postJson, captureChip } from '../scripts/golden-capture.ts'
import type { CaptureDeps } from '../scripts/golden-capture.ts'
import { chipBySlug, captureDecision, GoldenSeanceSchema } from '../src/lib/golden.ts'
import { goldenFor } from '../src/services/golden.ts'

const sales = chipBySlug('sales')!
const known = goldenFor('sales')!

describe('parseArgs', () => {
  it('defaults: no force, every chip, 60 s gap', () => {
    expect(parseArgs([])).toEqual({ force: false, gapMs: 60_000 })
  })
  it('reads --force, --only and --gap', () => {
    expect(parseArgs(['--force', '--only=sales,payroll', '--gap=90'])).toEqual({ force: true, only: ['sales', 'payroll'], gapMs: 90_000 })
  })
  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--fast'])).toThrow('Unknown flag')
  })
})

describe('captureDecision (skip existing unless --force)', () => {
  const captured = { ...known, provenance: 'captured' }
  it('missing or broken → capture', () => {
    expect(captureDecision(undefined, false)).toBe('capture')
    expect(captureDecision({ nope: true }, false)).toBe('capture')
  })
  it('a captured fixture → skip, or capture with --force', () => {
    expect(captureDecision(captured, false)).toBe('skip')
    expect(captureDecision(captured, true)).toBe('capture')
  })
  it('a hand-made placeholder is always replaced', () => {
    // built inline: the shipped fixtures are real captures now
    const handMade = { ...known, provenance: 'hand-made', source: 'inline test placeholder' }
    expect(GoldenSeanceSchema.safeParse(handMade).success).toBe(true)
    expect(captureDecision(handMade, false)).toBe('replace-hand-made')
    expect(captureDecision(handMade, true)).toBe('replace-hand-made')
  })
})

describe('pacing and 429 retries', () => {
  it('Pacer keeps calls at least the gap apart', async () => {
    let now = 0
    const sleeps: number[] = []
    const pacer = new Pacer(60_000, async ms => { sleeps.push(ms); now += ms }, () => now)
    await pacer.wait()          // first call: no wait
    now += 5_000                // the call took 5 s
    await pacer.wait()          // waits the remaining 55 s
    now += 70_000               // a long call
    await pacer.wait()          // already past the gap: no wait
    expect(sleeps).toEqual([55_000])
  })

  it('retryAfterMs reads seconds and HTTP dates', () => {
    expect(retryAfterMs('7')).toBe(7000)
    expect(retryAfterMs('Mon, 09 Nov 2026 12:00:05 GMT', Date.parse('2026-11-09T12:00:00Z'))).toBe(5000)
    expect(retryAfterMs(null)).toBeUndefined()
  })

  const reply = (status: number, body: unknown, retryAfter?: string) => ({
    status, json: () => Promise.resolve(body), headers: { get: (k: string) => (k === 'retry-after' ? retryAfter ?? null : null) },
  })

  it('on 429 waits retry-after, then succeeds', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(reply(429, {}, '12')).mockResolvedValueOnce(reply(200, { ok: 1 }))
    const sleep = vi.fn().mockResolvedValue(undefined)
    const r = await postJson(fetchFn as unknown as typeof fetch, 'https://x/api/summon', {}, { sleep, defaultWaitMs: 60_000 })
    expect(r).toEqual({ status: 200, json: { ok: 1 } })
    expect(sleep).toHaveBeenCalledWith(12_000)
  })

  it('without retry-after it waits the default gap; it gives up after maxAttempts', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(429, { error: 'busy' }))
    const sleep = vi.fn().mockResolvedValue(undefined)
    const r = await postJson(fetchFn as unknown as typeof fetch, 'https://x/api/run', {}, { sleep, defaultWaitMs: 60_000, maxAttempts: 3 })
    expect(r.status).toBe(429)
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[60_000], [60_000]])
  })

  it('caps very long waits', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(reply(429, {}, '99999')).mockResolvedValueOnce(reply(200, {}))
    const sleep = vi.fn().mockResolvedValue(undefined)
    await postJson(fetchFn as unknown as typeof fetch, 'https://x', {}, { sleep, defaultWaitMs: 1, maxWaitMs: 1_800_000 })
    expect(sleep).toHaveBeenCalledWith(1_800_000)
  })

  it('other errors are not retried', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(502, { code: 'ghost-mumbled' }))
    const r = await postJson(fetchFn as unknown as typeof fetch, 'https://x', {}, { sleep: vi.fn(), defaultWaitMs: 1 })
    expect(r.status).toBe(502)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})

describe('captureChip (mocked deployed APIs and Pyodide)', () => {
  /** Fake APIs that answer with the known-good sales séance. */
  function deps(overrides: Partial<Record<'summon' | 'run' | 'narrate', { status: number; json: unknown }>> = {}, python = known.pythonRun): CaptureDeps & { calls: string[]; bodies: Record<string, unknown>[] } {
    const calls: string[] = []
    const bodies: Record<string, unknown>[] = []
    const answers = {
      '/api/summon': overrides.summon ?? { status: 200, json: { program: known.program } },
      '/api/run': overrides.run ?? { status: 200, json: { ...known.cobolRun, runner: 'onlinecompiler' } },
      '/api/narrate': overrides.narrate ?? { status: 200, json: known.narration },
    }
    return {
      calls,
      bodies,
      baseUrl: 'https://seance-psi.vercel.app',
      post: async (path: string, body: unknown) => {
        calls.push(path)
        bodies.push(body as Record<string, unknown>)
        return answers[path as keyof typeof answers]
      },
      runPython: vi.fn().mockResolvedValue(python),
      now: () => new Date('2026-11-10T09:00:00Z'),
    }
  }

  it('agreeing runs → a valid captured golden séance', async () => {
    const d = deps()
    const r = await captureChip(sales, d)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(GoldenSeanceSchema.safeParse(r.golden).success).toBe(true)
    expect(r.golden).toMatchObject({ slug: 'sales', provenance: 'captured', capturedAt: '2026-11-10T09:00:00.000Z', source: 'https://seance-psi.vercel.app' })
    expect(d.calls).toEqual(['/api/summon', '/api/run', '/api/narrate'])
    expect(d.bodies[0]).toMatchObject({ task: sales.task, language: 'cobol', csvHeader: 'region,amount' })
    expect(d.runPython).toHaveBeenCalledWith(expect.stringContaining('from decimal import'), '4\nNorth,1520.25\nSouth,980.00\nEast,2105.75\nWest,1265.50\n')
  })

  it('disagreeing runs → not saved', async () => {
    const r = await captureChip(sales, deps({}, { ...known.pythonRun, stdout: 'TOTAL SALES: 5871.49' }))
    expect(r).toMatchObject({ ok: false, reason: expect.stringContaining('runs disagree') })
  })

  it('a compile error, a Python exception, an unsupported task or a busy API → not saved', async () => {
    const cases = [
      deps({ run: { status: 200, json: { stdout: '', exitCode: 1, runner: 'onlinecompiler', compileError: { line: 3, message: 'x' } } } }),
      deps({}, { stdout: '', stderr: "NameError: name 'getcontext' is not defined", exitCode: 1, runner: 'pyodide' }),
      deps({ summon: { status: 200, json: { unsupported: true, reason: 'needs a webcam' } } }),
      deps({ narrate: { status: 429, json: { error: 'LLM provider is busy.' } } }),
    ]
    const reasons = []
    for (const d of cases) {
      const r = await captureChip(sales, d)
      expect(r.ok).toBe(false)
      if (!r.ok) reasons.push(r.reason)
    }
    expect(reasons).toEqual([
      expect.stringContaining('did not compile'),
      expect.stringContaining('NameError'),
      expect.stringContaining('unsupported'),
      expect.stringContaining('narrate 429'),
    ])
  })

  it('a chip without a CSV sends the empty stdin "0\\n"', async () => {
    const d = deps()
    await captureChip(chipBySlug('compound-interest')!, d)
    expect(d.bodies[1]).toMatchObject({ stdin: '0\n' })
  })
})
