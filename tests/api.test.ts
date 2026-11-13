/**
 * tests/api.test.ts
 * The shared client fetch wrapper (src/services/api.ts) with mocked fetch.
 * Validates: Requirements 3.4, 8.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiSummon, apiRun, apiNarrate, ApiError, NETWORK_RETRY_DELAY_MS } from '../src/services/api.ts'

const PROGRAM = {
  program: { language: 'cobol', dialect: 'cobol85-fixed', filename: 'x.cob', title: 'X', lines: ['       STOP RUN.'] },
}

/** A minimal Response stand-in: status plus a JSON body (or a body that fails to parse). */
function reply(status: number, body?: unknown, { badJson = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (badJson ? Promise.reject(new SyntaxError('Unexpected token <')) : Promise.resolve(body)),
    text: () => Promise.resolve(JSON.stringify(body ?? '')),
  }
}

const networkDown = () => new TypeError('Failed to fetch')

async function caught(p: Promise<unknown>): Promise<ApiError> {
  try { await p } catch (e) { return e as ApiError }
  throw new Error('expected the call to fail')
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('HTTP 429 and 5xx go straight to busy (no retry)', () => {
  it('429 → busy, one call', async () => {
    fetchMock.mockResolvedValue(reply(429, { error: 'LLM provider is busy.' }))
    const err = await caught(apiSummon('t', undefined))
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ kind: 'busy', step: 'summon', status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('500 → busy, one call, tagged with its step', async () => {
    fetchMock.mockResolvedValue(reply(500, { error: 'boom' }))
    const err = await caught(apiRun('src', '0\n'))
    expect(err).toMatchObject({ kind: 'busy', step: 'run', status: 500 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a 5xx with a non-JSON body is still busy', async () => {
    fetchMock.mockResolvedValue(reply(503, undefined, { badJson: true }))
    expect((await caught(apiNarrate('t', '0001  x', 1))).kind).toBe('busy')
  })
})

describe('ghost mumbled and other bad answers → invalid', () => {
  it('502 tagged ghost-mumbled → invalid, not busy', async () => {
    fetchMock.mockResolvedValue(reply(502, { code: 'ghost-mumbled', error: 'The ghost mumbled. Schema validation failed' }))
    const err = await caught(apiNarrate('t', '0001  x', 1))
    expect(err).toMatchObject({ kind: 'invalid', step: 'narrate' })
    expect(err.message).toContain('The ghost mumbled')
  })

  it('a 200 whose body is not JSON → invalid', async () => {
    fetchMock.mockResolvedValue(reply(200, undefined, { badJson: true }))
    expect(await caught(apiSummon('t', undefined))).toMatchObject({ kind: 'invalid', step: 'summon' })
  })

  it('a 200 with the wrong shape → invalid', async () => {
    fetchMock.mockResolvedValue(reply(200, { nope: true }))
    expect((await caught(apiSummon('t', undefined))).kind).toBe('invalid')
  })

  it('400 → invalid with the server message', async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'This spirit is resting.' }))
    const err = await caught(apiRun('src', '0\n'))
    expect(err).toMatchObject({ kind: 'invalid', status: 400, message: 'This spirit is resting.' })
  })
})

describe('network failure: one retry with short backoff', () => {
  it('fails once, then succeeds → returns the parsed body', async () => {
    fetchMock.mockRejectedValueOnce(networkDown()).mockResolvedValueOnce(reply(200, PROGRAM))
    const p = apiSummon('t', undefined)
    await vi.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS)
    await expect(p).resolves.toEqual(PROGRAM)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry before the backoff has passed', async () => {
    fetchMock.mockRejectedValueOnce(networkDown()).mockResolvedValueOnce(reply(200, PROGRAM))
    const p = apiSummon('t', undefined)
    await vi.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails twice → busy, exactly two calls', async () => {
    fetchMock.mockRejectedValue(networkDown())
    const p = caught(apiRun('src', '0\n'))
    await vi.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS)
    expect(await p).toMatchObject({ kind: 'busy', step: 'run' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a 500 after a network retry is busy without a third call', async () => {
    fetchMock.mockRejectedValueOnce(networkDown()).mockResolvedValueOnce(reply(500, {}))
    const p = caught(apiSummon('t', undefined))
    await vi.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS)
    expect((await p).kind).toBe('busy')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('Esc (abort)', () => {
  it('an abort is rethrown as-is and never retried', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    fetchMock.mockRejectedValue(abort)
    const err = await caught(apiSummon('t', undefined, new AbortController().signal))
    expect(err).toBe(abort)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborting during the backoff stops the retry', async () => {
    const ctrl = new AbortController()
    fetchMock.mockRejectedValue(networkDown())
    const p = caught(apiSummon('t', undefined, ctrl.signal))
    await vi.advanceTimersByTimeAsync(NETWORK_RETRY_DELAY_MS / 2)
    ctrl.abort()
    expect((await p).name).toBe('AbortError')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
