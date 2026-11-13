/**
 * tests/summon.test.ts
 * Example tests for the Summon API layer.
 * fetch is mocked — no network calls are made.
 * Tests cover: chatComplete, extractJson, SummonRes validation, retry logic.
 *
 * Requirements: 3.1, 3.4, 3.5, 3.7, 12.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatComplete, extractJson, getLlmConfig } from '../server/llm/client.ts'
import { buildSummonUserPrompt } from '../server/llm/prompts/summon.ts'
import { SummonResSchema, isSummonSuccess } from '../src/lib/schemas.ts'

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockLlmFetch(content: string, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
        }),
      text: () => Promise.resolve(content),
    }),
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  // Provide fake env vars so getLlmConfig doesn't throw
  vi.stubEnv('LLM_API_KEY', 'fake-key')
  vi.stubEnv('LLM_MODEL', 'fake-model')
  vi.stubEnv('LLM_BASE_URL', 'https://fake.llm/v1')
})

// ---------------------------------------------------------------------------
// chatComplete
// ---------------------------------------------------------------------------

describe('chatComplete', () => {
  it('returns the assistant message content', async () => {
    mockLlmFetch('{"hello":"world"}')
    const config = getLlmConfig()
    const result = await chatComplete([{ role: 'user', content: 'hi' }], config)
    expect(result).toBe('{"hello":"world"}')
  })

  it('sends Bearer auth header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const config = getLlmConfig()
    await chatComplete([{ role: 'user', content: 'test' }], config)
    const headers = fetchSpy.mock.calls[0][1].headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer fake-key')
  })

  it('requests json_object response_format by default', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const config = getLlmConfig()
    await chatComplete([{ role: 'user', content: 'test' }], config)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.response_format).toEqual({ type: 'json_object' })
  })

  it('omits response_format when jsonMode is false', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const config = getLlmConfig()
    await chatComplete([{ role: 'user', content: 'test' }], config, false)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.response_format).toBeUndefined()
  })

  it('throws on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('rate limited'),
      }),
    )
    const config = getLlmConfig()
    await expect(chatComplete([{ role: 'user', content: 'x' }], config)).rejects.toThrow('429')
  })

  it('throws when choices array is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ choices: [] }),
      }),
    )
    const config = getLlmConfig()
    await expect(chatComplete([{ role: 'user', content: 'x' }], config)).rejects.toThrow('empty')
  })
})

// ---------------------------------------------------------------------------
// extractJson
// ---------------------------------------------------------------------------

describe('extractJson', () => {
  it('strips ```json fences', () => {
    const raw = '```json\n{"a":1}\n```'
    expect(extractJson(raw)).toBe('{"a":1}')
  })

  it('strips plain ``` fences', () => {
    const raw = '```\n{"a":1}\n```'
    expect(extractJson(raw)).toBe('{"a":1}')
  })

  it('returns trimmed raw string when no fences', () => {
    expect(extractJson('  {"a":1}  ')).toBe('{"a":1}')
  })

  it('handles multi-line JSON in fences', () => {
    const raw = '```json\n{\n  "a": 1\n}\n```'
    const out = extractJson(raw)
    expect(() => JSON.parse(out)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// SummonResSchema validation
// ---------------------------------------------------------------------------

describe('SummonResSchema', () => {
  const validProgram = {
    language: 'cobol' as const,
    dialect: 'cobol85-fixed' as const,
    filename: 'hello.cob',
    title: 'Hello World',
    lines: ['       IDENTIFICATION DIVISION.', '       PROGRAM-ID. HELLO.'],
  }

  it('accepts a well-formed program response', () => {
    const result = SummonResSchema.safeParse({ program: validProgram })
    expect(result.success).toBe(true)
    if (result.success) expect(isSummonSuccess(result.data)).toBe(true)
  })

  it('accepts an unsupported response', () => {
    const result = SummonResSchema.safeParse({
      unsupported: true,
      reason: 'COBOL cannot open a web browser.',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(isSummonSuccess(result.data)).toBe(false)
  })

  it('rejects a program with more than 120 lines', () => {
    const result = SummonResSchema.safeParse({
      program: { ...validProgram, lines: Array.from({ length: 121 }, () => '       x') },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a response with neither program nor unsupported', () => {
    const result = SummonResSchema.safeParse({ something: 'random' })
    expect(result.success).toBe(false)
  })

  it('rejects unsupported:true with no reason', () => {
    const result = SummonResSchema.safeParse({ unsupported: true })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Prompt ↔ schema contract (regression: the prompt once showed a bare program,
// which SummonResSchema rejects, so every live summon returned 502)
// ---------------------------------------------------------------------------

describe('SUMMON_SYSTEM_PROMPT matches SummonResSchema', () => {
  it('the success example in the prompt nests the program under "program"', async () => {
    const { SUMMON_SYSTEM_PROMPT } = await import('../server/llm/prompts/summon.ts')
    expect(SUMMON_SYSTEM_PROMPT).toMatch(/"program"\s*:\s*\{/)
  })

  it('a response shaped like the prompt example validates', () => {
    const example = {
      program: {
        language: 'cobol',
        dialect: 'cobol85-fixed',
        filename: 'compound-interest.cob',
        title: 'Compound interest',
        lines: ['       IDENTIFICATION DIVISION.'],
      },
    }
    expect(SummonResSchema.safeParse(example).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// buildSummonUserPrompt
// ---------------------------------------------------------------------------

describe('buildSummonUserPrompt', () => {
  it('includes the task text', () => {
    const prompt = buildSummonUserPrompt({ task: 'Sum two numbers', language: 'cobol' })
    expect(prompt).toContain('Sum two numbers')
  })

  it('includes csvHeader when provided', () => {
    const prompt = buildSummonUserPrompt({
      task: 'Total sales',
      language: 'cobol',
      csvHeader: 'region,amount',
    })
    expect(prompt).toContain('region,amount')
    expect(prompt).toContain('stdin')
  })

  // regression: the model refused CSV tasks because the header/count rules were unclear
  it('tells the model the header is not on stdin and the count comes first', () => {
    const prompt = buildSummonUserPrompt({ task: 'Total sales', language: 'cobol', csvHeader: 'region,amount' })
    expect(prompt).toMatch(/not on stdin/)
    expect(prompt).toMatch(/row count N first/)
  })

  it('repair prompt lists each bad line', async () => {
    const { buildSummonRepairPrompt } = await import('../server/llm/prompts/summon.ts')
    const prompt = buildSummonRepairPrompt([
      { line: 5, kind: 'comment-column', detail: '* is in column 8' },
      { line: 21, kind: 'too-long', detail: 'is 73 columns' },
    ])
    expect(prompt).toContain('line 5 * is in column 8')
    expect(prompt).toContain('line 21 is 73 columns')
  })

  // regression: the model put * in column 8, which GnuCOBOL rejects in fixed format
  it('system prompt shows the comment template with * in column 7', async () => {
    const { SUMMON_SYSTEM_PROMPT } = await import('../server/llm/prompts/summon.ts')
    expect(SUMMON_SYSTEM_PROMPT).toContain('......* ')
    expect(SUMMON_SYSTEM_PROMPT).toMatch(/A \* in column 8 or later is NOT a comment/)
  })

  it('system prompt spells out the count-first read pattern', async () => {
    const { SUMMON_SYSTEM_PROMPT } = await import('../server/llm/prompts/summon.ts')
    expect(SUMMON_SYSTEM_PROMPT).toContain('ACCEPT WS-COUNT')
    expect(SUMMON_SYSTEM_PROMPT).toContain('PERFORM WS-COUNT TIMES')
    expect(SUMMON_SYSTEM_PROMPT).toMatch(/header row is NEVER sent on stdin/)
  })

  it('does not mention CSV when csvHeader is absent', () => {
    const prompt = buildSummonUserPrompt({ task: 'Sort names', language: 'cobol' })
    expect(prompt).not.toContain('CSV')
  })
})

// ---------------------------------------------------------------------------
// getLlmConfig
// ---------------------------------------------------------------------------

describe('getLlmConfig', () => {
  it('throws when LLM_MODEL is missing', () => {
    vi.stubEnv('LLM_MODEL', '')
    expect(() => getLlmConfig()).toThrow('LLM_MODEL')
  })

  it('throws when LLM_API_KEY is missing', () => {
    vi.stubEnv('LLM_MODEL', 'some-model')
    vi.stubEnv('LLM_API_KEY', '')
    expect(() => getLlmConfig()).toThrow('LLM_API_KEY')
  })

  it('uses default base URL when LLM_BASE_URL is not set', () => {
    vi.stubEnv('LLM_BASE_URL', '')
    const config = getLlmConfig()
    expect(config.baseUrl).toContain('groq.com')
  })

  it('returns all three fields when env is set', () => {
    const config = getLlmConfig()
    expect(config.apiKey).toBe('fake-key')
    expect(config.model).toBe('fake-model')
    expect(config.baseUrl).toBe('https://fake.llm/v1')
  })
})
