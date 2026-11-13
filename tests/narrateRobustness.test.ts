/**
 * tests/narrateRobustness.test.ts
 * Single-number ranges at the JSON boundary, retries that name the failing
 * field, the missing-import repair, the 15 s retry-after cap and maxDuration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StepSchema, PyLineSchema, NarrateResSchema, describeIssue, describeIssues } from '../src/lib/schemas.ts'
import { validateSteps } from '../src/lib/ranges.ts'
import { chatComplete, MAX_RETRY_AFTER_SEC } from '../server/llm/client.ts'

describe('single-number ranges', () => {
  it('[5] is read as [5, 5] for step ranges and maps', () => {
    expect(StepSchema.parse({ range: [5], text: 'x' }).range).toEqual([5, 5])
    expect(PyLineSchema.parse({ text: 'pass', maps: [7] }).maps).toEqual([7, 7])
  })

  it('valid pairs and null maps are unchanged', () => {
    expect(StepSchema.parse({ range: [2, 4], text: 'x' }).range).toEqual([2, 4])
    expect(PyLineSchema.parse({ text: 'import sys', maps: null }).maps).toBeNull()
  })

  it('other bad shapes are still rejected', () => {
    for (const range of [[], [1, 2, 3], [0], ['5'], [4, 2]]) {
      expect(StepSchema.safeParse({ range, text: 'x' }).success).toBe(false)
    }
  })

  it('a narration that uses one-number ranges parses and passes validateSteps', () => {
    const res = NarrateResSchema.parse({
      steps: [{ range: [1, 3], text: 'a' }, { range: [4], text: 'b' }, { range: [5, 6], text: 'c' }],
      python: [{ text: 'import sys', maps: null }, { text: 'n = 1', maps: [4] }],
    })
    expect(res.steps[1].range).toEqual([4, 4])
    expect(validateSteps(res.steps, 6)).toEqual([])
  })
})

describe('describeIssue names the failing field', () => {
  it('uses dotted paths with [index]', () => {
    const r = NarrateResSchema.safeParse({ steps: [{ range: [1, 2], text: 'a' }, { range: [1, 2, 3], text: 'b' }], python: [{ text: 'x', maps: null }] })
    expect(r.success).toBe(false)
    if (!r.success) expect(describeIssue(r.error.issues[0])).toMatch(/^steps\[1\]\.range: /)
  })

  it('lists several issues and says when there are more', () => {
    const r = NarrateResSchema.safeParse({ steps: Array.from({ length: 7 }, () => ({ range: [], text: '' })), python: [] })
    expect(r.success).toBe(false)
    if (!r.success) {
      const text = describeIssues(r.error, 3)
      expect(text.split('\n')).toHaveLength(4)
      expect(text).toMatch(/…and \d+ more$/)
    }
  })
})

// ---------------------------------------------------------------------------
// handlers, with mocked LLM fetch
// ---------------------------------------------------------------------------

const LINES = ['       IDENTIFICATION DIVISION.', '       PROGRAM-ID. T.', '       PROCEDURE DIVISION.', '           STOP RUN.']
const headers = { get: () => null }
const ok = (content: string) => ({
  ok: true, status: 200, headers,
  json: () => Promise.resolve({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }),
})
const narration = (python: string[], range: number[] = [3, 4]) => JSON.stringify({
  steps: [{ range: [1, 2], text: 'Names the program.' }, { range, text: 'Stops.' }],
  python: python.map(text => ({ text, maps: null })),
})
const GOOD_PY = ['from decimal import Decimal, getcontext', 'getcontext().prec = 50', 'print("TOTAL: 1.00")']
const NO_IMPORT_PY = ['from decimal import Decimal', 'getcontext().prec = 50', 'print("TOTAL: 1.00")']

let seq = 0
async function narrate() {
  const { default: handler } = await import('../api/narrate.ts')
  let status = 0
  let body: Record<string, unknown> = {}
  const res = { status(c: number) { status = c; return res }, json(d: Record<string, unknown>) { body = d; return res } }
  const req = {
    method: 'POST', headers: {},
    body: { task: `robustness #${++seq}`, numberedSource: LINES.map((l, i) => `${String(i + 1).padStart(4, '0')}  ${l}`).join('\n'), lineCount: LINES.length },
  }
  await handler(req as never, res as never)
  return { status, body }
}
const lastUserMessage = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
  (JSON.parse(fetchMock.mock.calls[call][1].body as string) as { messages: { role: string; content: string }[] }).messages.at(-1)!

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('LLM_API_KEY', 'fake-key')
  vi.stubEnv('LLM_MODEL', 'fake-model')
  vi.stubEnv('LLM_BASE_URL', 'https://fake.llm/v1')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('api/narrate repairs', () => {
  it('a one-number range is accepted without a retry', async () => {
    fetchMock.mockResolvedValue(ok(narration(GOOD_PY, [3])))
    const { status, body } = await narrate()
    expect(status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((body.steps as { range: number[] }[])[1].range).toEqual([3, 3])
  })

  it('a schema failure retries with a message naming the exact field', async () => {
    fetchMock.mockResolvedValueOnce(ok(narration(GOOD_PY, [3, 4, 5]))).mockResolvedValueOnce(ok(narration(GOOD_PY)))
    const { status } = await narrate()
    expect(status).toBe(200)
    expect(lastUserMessage(fetchMock, 1).content).toContain('steps[1].range')
  })

  it('a missing import gets one repair turn listing the import line', async () => {
    fetchMock.mockResolvedValueOnce(ok(narration(NO_IMPORT_PY))).mockResolvedValueOnce(ok(narration(GOOD_PY)))
    const { status, body } = await narrate()
    expect(status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const repair = lastUserMessage(fetchMock, 1)
    expect(repair.role).toBe('user')
    expect(repair.content).toContain('from decimal import getcontext')
    expect((body.python as { text: string }[])[0].text).toBe(GOOD_PY[0])
  })

  it('if the repair still misses it, the narration is returned (uncached) so the NameError shows', async () => {
    fetchMock.mockResolvedValue(ok(narration(NO_IMPORT_PY)))
    const { status, body } = await narrate()
    expect(status).toBe(200)
    expect(body.code).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('429 cap and Vercel maxDuration', () => {
  it(`the cap is ${MAX_RETRY_AFTER_SEC} s: the live 11–12 s retry-afters are now waited out`, async () => {
    expect(MAX_RETRY_AFTER_SEC).toBe(15)
    vi.useFakeTimers()
    const tooMany = { ok: false, status: 429, headers: { get: (k: string) => (k === 'retry-after' ? '12' : null) }, text: () => Promise.resolve('') }
    fetchMock.mockResolvedValueOnce(tooMany).mockResolvedValueOnce(ok('done'))
    const p = chatComplete([{ role: 'user', content: 'x' }], { baseUrl: 'https://fake.llm/v1', model: 'm', apiKey: 'k' })
    await vi.advanceTimersByTimeAsync(12_000)
    await expect(p).resolves.toBe('done')
  })

  it('a 16 s retry-after is not waited out', async () => {
    const tooMany = { ok: false, status: 429, headers: { get: (k: string) => (k === 'retry-after' ? '16' : null) }, text: () => Promise.resolve('') }
    fetchMock.mockResolvedValue(tooMany)
    await expect(chatComplete([{ role: 'user', content: 'x' }], { baseUrl: 'https://fake.llm/v1', model: 'm', apiKey: 'k' })).rejects.toMatchObject({ kind: 'rate-limited' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['summon', 'run', 'narrate'])('api/%s exports config.maxDuration = 60', async name => {
    const mod = (await import(`../api/${name}.ts`)) as { config?: { maxDuration?: number } }
    expect(mod.config?.maxDuration).toBe(60)
    // the longest wait plus two LLM calls must fit
    expect(MAX_RETRY_AFTER_SEC).toBeLessThan(mod.config!.maxDuration! / 2)
  })
})
