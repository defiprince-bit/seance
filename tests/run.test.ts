/**
 * tests/run.test.ts
 * Example tests for the OnlineCompiler.io runner adapter.
 * fetch is mocked — no network calls are made.
 *
 * Requirements: 4.1, 4.2, 4.2a, 4.6, 12.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runCobol } from '../server/runners/onlinecompiler.ts'

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Successful run
// ---------------------------------------------------------------------------

describe('runCobol – successful run', () => {
  it('returns stdout, exitCode 0 and runner: onlinecompiler', async () => {
    mockFetch({
      output: 'TOTAL: 5871.50\n',
      error: '',
      status: 'success',
      exit_code: 0,
      signal: null,
      truncated: false,
      time: '0.12',
      total: '0.34',
      memory: '8192',
      time_limit: 30,
      memory_limit: 512,
    })

    const run = await runCobol('IDENTIFICATION DIVISION.', '', 'FAKE_KEY')

    expect(run.stdout).toBe('TOTAL: 5871.50\n')
    expect(run.exitCode).toBe(0)
    expect(run.runner).toBe('onlinecompiler')
    expect(run.timedOut).toBeUndefined()
    expect(run.compileError).toBeUndefined()
  })

  it('prepends >>SOURCE FORMAT IS FIXED to the code sent to the API', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          output: '',
          error: '',
          status: 'success',
          exit_code: 0,
          signal: null,
          truncated: false,
          time: '0.1',
          total: '0.2',
          memory: '8192',
          time_limit: 30,
          memory_limit: 512,
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await runCobol('IDENTIFICATION DIVISION.', 'some-stdin', 'FAKE_KEY')

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.code).toMatch(/^>>SOURCE FORMAT IS FIXED\n/)
    expect(body.input).toBe('some-stdin')
    expect(body.compiler).toBe('gnucobol-3.2')
  })

  it('sends the Authorization header without a Bearer prefix', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          output: '',
          error: '',
          status: 'success',
          exit_code: 0,
          signal: null,
          truncated: false,
          time: '0.1',
          total: '0.2',
          memory: '8192',
          time_limit: 30,
          memory_limit: 512,
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await runCobol('', '', 'MY_SECRET_KEY')

    const headers = fetchSpy.mock.calls[0][1].headers as Record<string, string>
    expect(headers['Authorization']).toBe('MY_SECRET_KEY')
    expect(headers['Authorization']).not.toMatch(/^Bearer /)
  })
})

// ---------------------------------------------------------------------------
// Compile error — line on user source
// ---------------------------------------------------------------------------

describe('runCobol – compile error', () => {
  it('returns a compileError with line remapped by −1 (directive offset)', async () => {
    // GnuCOBOL sees the directive as line 1, so user line 1 is compiler line 2.
    mockFetch({
      output: '',
      error: 'program.cob:2: Error: syntax error, unexpected WORD\n',
      status: 'error',
      exit_code: 1,
      signal: null,
      truncated: false,
      time: '0.05',
      total: '0.10',
      memory: '4096',
      time_limit: 30,
      memory_limit: 512,
    })

    const run = await runCobol('BAD COBOL', '', 'FAKE_KEY')

    expect(run.exitCode).toBe(1)
    expect(run.compileError).toBeDefined()
    // Compiler said line 2; after subtracting 1 for the directive, user sees line 1
    expect(run.compileError?.line).toBe(1)
    expect(run.compileError?.message).toContain('syntax error')
    // The remapped message should also show line 1, not line 2
    expect(run.compileError?.message).not.toMatch(/:2:/)
  })

  it('compile error on user line 1: line 2 in compiler output → line 1 returned', async () => {
    mockFetch({
      output: '',
      error: 'program.cob:2:10: Error: IDENTIFICATION DIVISION required\n',
      status: 'error',
      exit_code: 1,
      signal: null,
      truncated: false,
      time: '0.04',
      total: '0.08',
      memory: '4096',
      time_limit: 30,
      memory_limit: 512,
    })

    const run = await runCobol('JUNK', '', 'FAKE_KEY')

    expect(run.compileError?.line).toBe(1)
  })

  it('compile error with no recognisable line number returns a message but no line', async () => {
    mockFetch({
      output: '',
      error: 'internal error: link phase failed',
      status: 'error',
      exit_code: 1,
      signal: null,
      truncated: false,
      time: '0.03',
      total: '0.07',
      memory: '4096',
      time_limit: 30,
      memory_limit: 512,
    })

    const run = await runCobol('IDENTIFICATION DIVISION.', '', 'FAKE_KEY')

    expect(run.compileError).toBeDefined()
    expect(run.compileError?.line).toBeUndefined()
    expect(run.compileError?.message).toContain('internal error')
  })
})

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('runCobol – timeout', () => {
  it('sets timedOut: true when exit_code is 124', async () => {
    mockFetch({
      output: '',
      error: '',
      status: 'error',
      exit_code: 124,
      signal: null,
      truncated: false,
      time: '30.0',
      total: '30.1',
      memory: '8192',
      time_limit: 30,
      memory_limit: 512,
    })

    const run = await runCobol('IDENTIFICATION DIVISION.', '', 'FAKE_KEY')

    expect(run.timedOut).toBe(true)
    expect(run.exitCode).toBe(124)
    expect(run.compileError).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Runtime error (non-zero exit, has output)
// ---------------------------------------------------------------------------

describe('runCobol – runtime error', () => {
  it('returns exitCode ≠ 0 with stderr but no compileError when output is present', async () => {
    mockFetch({
      output: 'partial output\n',
      error: 'runtime: divide by zero\n',
      status: 'error',
      exit_code: 1,
      signal: null,
      truncated: false,
      time: '0.20',
      total: '0.30',
      memory: '8192',
      time_limit: 30,
      memory_limit: 512,
    })

    const run = await runCobol('IDENTIFICATION DIVISION.', '', 'FAKE_KEY')

    expect(run.exitCode).toBe(1)
    expect(run.stdout).toBe('partial output\n')
    expect(run.stderr).toContain('divide by zero')
    expect(run.compileError).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Network / HTTP errors — should throw so the caller can fall back
// ---------------------------------------------------------------------------

describe('runCobol – network errors', () => {
  it('throws on non-2xx HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'rate limit' }),
        text: () => Promise.resolve('rate limit exceeded'),
      }),
    )

    await expect(runCobol('', '', 'FAKE_KEY')).rejects.toThrow('429')
  })

  it('throws on fetch network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unreachable')))

    await expect(runCobol('', '', 'FAKE_KEY')).rejects.toThrow('network unreachable')
  })
})

// ---------------------------------------------------------------------------
// api/run.ts handler — schema and guard tests
// ---------------------------------------------------------------------------

describe('RunReq schema + resting-spirit guard', () => {
  // These test the zod schema directly (the handler delegates to it)
  it('RunReqSchema accepts cobol', async () => {
    const { RunReqSchema } = await import('../src/lib/schemas.ts')
    const result = RunReqSchema.safeParse({ language: 'cobol', source: 'X', stdin: '' })
    expect(result.success).toBe(true)
  })

  it('RunReqSchema accepts fortran and basic (guard is in the handler, not the schema)', async () => {
    const { RunReqSchema } = await import('../src/lib/schemas.ts')
    for (const lang of ['fortran', 'basic'] as const) {
      const result = RunReqSchema.safeParse({ language: lang, source: '', stdin: '' })
      expect(result.success).toBe(true)
    }
  })

  it('RunReqSchema rejects source longer than 20 000 chars', async () => {
    const { RunReqSchema } = await import('../src/lib/schemas.ts')
    const result = RunReqSchema.safeParse({
      language: 'cobol',
      source: 'x'.repeat(20_001),
      stdin: '',
    })
    expect(result.success).toBe(false)
  })

  it('RunReqSchema rejects stdin longer than 70 000 chars', async () => {
    const { RunReqSchema } = await import('../src/lib/schemas.ts')
    const result = RunReqSchema.safeParse({
      language: 'cobol',
      source: '',
      stdin: 'x'.repeat(70_001),
    })
    expect(result.success).toBe(false)
  })
})
