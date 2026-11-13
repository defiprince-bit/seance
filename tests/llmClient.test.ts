/**
 * tests/llmClient.test.ts
 * chatComplete error kinds, the 429 retry-after wait, and per-purpose models.
 * fetch is mocked; fake timers stand in for the wait.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chatComplete, getLlmConfig, parseRetryAfter, LlmError, MAX_RETRY_AFTER_SEC } from '../server/llm/client.ts'

const CONFIG = { baseUrl: 'https://fake.llm/v1', model: 'fake-model', apiKey: 'fake-key' }
const MSG = [{ role: 'user' as const, content: 'hi' }]

/** Response stand-in with headers, a JSON body and a text body. */
function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }
}
const ok = (content: string) => reply(200, { choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] })
// shape of Groq's answer when json_object mode rejects the model's output
const groqBadJson = (message = "Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.") =>
  reply(400, { error: { message, type: 'invalid_request_error', code: 'json_validate_failed', failed_generation: '{"steps": [' } })

async function caught(p: Promise<unknown>): Promise<LlmError> {
  try { await p } catch (e) { return e as LlmError }
  throw new Error('expected the call to fail')
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => { vi.useFakeTimers(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Groq 400 "Failed to validate JSON"', () => {
  it('is a bad-json LlmError, not a generic failure', async () => {
    fetchMock.mockResolvedValue(groqBadJson())
    const err = await caught(chatComplete(MSG, CONFIG))
    expect(err).toBeInstanceOf(LlmError)
    expect(err).toMatchObject({ kind: 'bad-json', status: 400 })
    expect(fetchMock).toHaveBeenCalledTimes(1) // the handler owns that retry
  })

  it('also recognises the "Failed to generate JSON" wording', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: { message: 'Failed to generate JSON. Please adjust your prompt.' } }))
    expect((await caught(chatComplete(MSG, CONFIG))).kind).toBe('bad-json')
  })

  it('any other 400 is a plain http error', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: { message: 'model not found' } }))
    expect((await caught(chatComplete(MSG, CONFIG))).kind).toBe('http')
  })
})

describe('429 with retry-after', () => {
  it('waits a short retry-after once, then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(reply(429, 'slow down', { 'retry-after': '3' })).mockResolvedValueOnce(ok('{"a":1}'))
    const p = chatComplete(MSG, CONFIG)
    await vi.advanceTimersByTimeAsync(2999)
    expect(fetchMock).toHaveBeenCalledTimes(1) // still waiting
    await vi.advanceTimersByTimeAsync(1)
    await expect(p).resolves.toBe('{"a":1}')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it(`waits exactly ${MAX_RETRY_AFTER_SEC}s at the limit`, async () => {
    fetchMock.mockResolvedValueOnce(reply(429, '', { 'retry-after': String(MAX_RETRY_AFTER_SEC) })).mockResolvedValueOnce(ok('x'))
    const p = chatComplete(MSG, CONFIG)
    await vi.advanceTimersByTimeAsync(MAX_RETRY_AFTER_SEC * 1000)
    await expect(p).resolves.toBe('x')
  })

  it('a long retry-after goes straight to rate-limited, without waiting', async () => {
    fetchMock.mockResolvedValue(reply(429, 'slow down', { 'retry-after': '30' }))
    const err = await caught(chatComplete(MSG, CONFIG))
    expect(err).toMatchObject({ kind: 'rate-limited', status: 429, retryAfterSec: 30 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('no retry-after header → rate-limited, one call', async () => {
    fetchMock.mockResolvedValue(reply(429, 'slow down'))
    expect((await caught(chatComplete(MSG, CONFIG))).kind).toBe('rate-limited')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a second 429 after the wait is rate-limited (only one wait)', async () => {
    fetchMock.mockResolvedValue(reply(429, 'slow down', { 'retry-after': '2' }))
    const p = caught(chatComplete(MSG, CONFIG))
    await vi.advanceTimersByTimeAsync(2000)
    expect((await p).kind).toBe('rate-limited')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('503 is rate-limited too', async () => {
    fetchMock.mockResolvedValue(reply(503, 'over capacity'))
    expect((await caught(chatComplete(MSG, CONFIG))).kind).toBe('rate-limited')
  })
})

describe('parseRetryAfter', () => {
  it('reads delay-seconds, fractional seconds and HTTP dates', () => {
    expect(parseRetryAfter('7')).toBe(7)
    expect(parseRetryAfter('2.5')).toBe(2.5)
    const now = Date.parse('2026-11-09T12:00:00Z')
    expect(parseRetryAfter('Mon, 09 Nov 2026 12:00:05 GMT', now)).toBe(5)
    expect(parseRetryAfter('Mon, 09 Nov 2026 11:59:00 GMT', now)).toBe(0)
  })

  it('returns undefined for missing or unreadable values', () => {
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter('soon')).toBeUndefined()
  })
})

describe('getLlmConfig: LLM_NARRATE_MODEL', () => {
  beforeEach(() => {
    vi.stubEnv('LLM_API_KEY', 'fake-key')
    vi.stubEnv('LLM_MODEL', 'openai/gpt-oss-120b')
  })

  it('narration uses LLM_NARRATE_MODEL when set', () => {
    vi.stubEnv('LLM_NARRATE_MODEL', 'openai/gpt-oss-20b')
    expect(getLlmConfig('narrate').model).toBe('openai/gpt-oss-20b')
  })

  it('summon ignores it', () => {
    vi.stubEnv('LLM_NARRATE_MODEL', 'openai/gpt-oss-20b')
    expect(getLlmConfig('summon').model).toBe('openai/gpt-oss-120b')
    expect(getLlmConfig().model).toBe('openai/gpt-oss-120b')
  })

  it('narration falls back to LLM_MODEL when it is unset or empty', () => {
    vi.stubEnv('LLM_NARRATE_MODEL', '')
    expect(getLlmConfig('narrate').model).toBe('openai/gpt-oss-120b')
  })

  // regression: at default effort gpt-oss-20b returned empty output (Groq 400 json_validate_failed)
  it('narration on a gpt-oss model asks for low reasoning effort; summon does not', () => {
    vi.stubEnv('LLM_NARRATE_MODEL', 'openai/gpt-oss-20b')
    expect(getLlmConfig('narrate').reasoningEffort).toBe('low')
    expect(getLlmConfig('summon').reasoningEffort).toBeUndefined()
  })

  it('a non-gpt-oss narration model gets no reasoning_effort', () => {
    vi.stubEnv('LLM_NARRATE_MODEL', 'llama-3.3-70b-versatile')
    expect(getLlmConfig('narrate').reasoningEffort).toBeUndefined()
  })
})

describe('reasoning_effort in the request', () => {
  it('is sent when the config has it, and only then', async () => {
    fetchMock.mockResolvedValue(ok('{}'))
    await chatComplete(MSG, { ...CONFIG, reasoningEffort: 'low' })
    await chatComplete(MSG, CONFIG)
    const sent = fetchMock.mock.calls.map(c => JSON.parse(c[1].body as string))
    expect(sent[0].reasoning_effort).toBe('low')
    expect('reasoning_effort' in sent[1]).toBe(false)
  })
})
