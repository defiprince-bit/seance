/**
 * tests/llmRetryHandlers.test.ts
 * api/summon and api/narrate treat Groq's 400 "Failed to validate JSON" like
 * invalid JSON: one silent retry, then the ghost-mumbled 502 (Req 3.4).
 * Narration sends LLM_NARRATE_MODEL. A long 429 is still busy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const LINES = ['       IDENTIFICATION DIVISION.', '       PROGRAM-ID. T.', '       PROCEDURE DIVISION.', '           STOP RUN.']
const PROGRAM = JSON.stringify({ program: { language: 'cobol', dialect: 'cobol85-fixed', filename: 't.cob', title: 'T', lines: LINES } })
const NARRATION = JSON.stringify({
  steps: [{ range: [1, 2], text: 'Names the program.' }, { range: [3, 4], text: 'Stops.' }],
  python: [{ text: 'pass', maps: [4, 4] }],
})

const headersOf = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null })
const ok = (content: string) => ({
  ok: true, status: 200, headers: headersOf({}),
  json: () => Promise.resolve({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }),
})
const badJson = () => {
  const body = { error: { message: "Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.", type: 'invalid_request_error', code: 'json_validate_failed' } }
  return { ok: false, status: 400, headers: headersOf({}), json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) }
}
const tooMany = (retryAfter: string) => ({
  ok: false, status: 429, headers: headersOf({ 'retry-after': retryAfter }),
  json: () => Promise.resolve({}), text: () => Promise.resolve('rate limited'),
})

async function call(name: 'summon' | 'narrate', body: unknown) {
  const { default: handler } = await import(`../api/${name}.ts`)
  let status = 0
  let json: Record<string, unknown> = {}
  const res = { status(c: number) { status = c; return res }, json(d: Record<string, unknown>) { json = d; return res } }
  await handler({ method: 'POST', headers: {}, body } as never, res as never)
  return { status, json }
}

// every test uses its own task so the per-instance response caches never hit
let seq = 0
const summonBody = () => ({ task: `Total the sales in a CSV #${++seq}`, language: 'cobol' })
const narrateBody = () => ({
  task: `Total the sales in a CSV #${++seq}`,
  numberedSource: LINES.map((l, i) => `${String(i + 1).padStart(4, '0')}  ${l}`).join('\n'),
  lineCount: LINES.length,
})
const sentModel = (fetchMock: ReturnType<typeof vi.fn>, i: number) =>
  (JSON.parse(fetchMock.mock.calls[i][1].body as string) as { model: string }).model

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('LLM_API_KEY', 'fake-key')
  vi.stubEnv('LLM_MODEL', 'openai/gpt-oss-120b')
  vi.stubEnv('LLM_NARRATE_MODEL', 'openai/gpt-oss-20b')
  vi.stubEnv('LLM_BASE_URL', 'https://fake.llm/v1')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe.each(['summon', 'narrate'] as const)('api/%s and Groq "Failed to validate JSON"', name => {
  const body = () => (name === 'summon' ? summonBody() : narrateBody())
  const good = name === 'summon' ? PROGRAM : NARRATION

  it('retries once silently and succeeds', async () => {
    fetchMock.mockResolvedValueOnce(badJson()).mockResolvedValueOnce(ok(good))
    const { status } = await call(name, body())
    expect(status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('twice → 502 ghost-mumbled (not busy)', async () => {
    fetchMock.mockResolvedValue(badJson())
    const { status, json } = await call(name, body())
    expect(status).toBe(502)
    expect(json.code).toBe('ghost-mumbled')
    expect(String(json.error)).toContain('The ghost mumbled')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a 429 with a long retry-after is busy (429), not retried', async () => {
    fetchMock.mockResolvedValue(tooMany('45'))
    const { status } = await call(name, body())
    expect(status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('model per purpose', () => {
  it('narrate sends LLM_NARRATE_MODEL with medium effort and a 6000-token cap', async () => {
    fetchMock.mockResolvedValue(ok(NARRATION))
    await call('narrate', narrateBody())
    expect(sentModel(fetchMock, 0)).toBe('openai/gpt-oss-20b')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({ reasoning_effort: 'medium', max_completion_tokens: 6000 })
  })

  it('summon sends LLM_MODEL and leaves reasoning effort at the provider default', async () => {
    fetchMock.mockResolvedValue(ok(PROGRAM))
    await call('summon', summonBody())
    expect(sentModel(fetchMock, 0)).toBe('openai/gpt-oss-120b')
    expect('reasoning_effort' in JSON.parse(fetchMock.mock.calls[0][1].body as string)).toBe(false)
  })

  it('narrate falls back to LLM_MODEL when LLM_NARRATE_MODEL is unset', async () => {
    vi.stubEnv('LLM_NARRATE_MODEL', '')
    fetchMock.mockResolvedValue(ok(NARRATION))
    await call('narrate', narrateBody())
    expect(sentModel(fetchMock, 0)).toBe('openai/gpt-oss-120b')
  })
})
