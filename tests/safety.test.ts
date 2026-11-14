/**
 * tests/safety.test.ts  (task 15)
 * Per-IP limit on /api/summon, /api/run and /api/narrate (10 per minute, 429 +
 * Retry-After), and the per-instance response cache for summon and narrate.
 * fetch is mocked; no network. Validates: Requirements 12.3, 12.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clientIp, requestHash, RATE_LIMIT } from '../server/safety.ts'

const LINES = ['       IDENTIFICATION DIVISION.', '       PROGRAM-ID. T.', '       PROCEDURE DIVISION.', '           STOP RUN.']
const PROGRAM = JSON.stringify({ program: { language: 'cobol', dialect: 'cobol85-fixed', filename: 't.cob', title: 'T', lines: LINES } })
const NARRATION = JSON.stringify({
  steps: [{ range: [1, 2], text: 'Names the program.' }, { range: [3, 4], text: 'Stops.' }],
  python: [{ text: 'pass', maps: [4, 4] }],
})
const llmOk = (content: string) => ({
  ok: true, status: 200, headers: { get: () => null },
  json: () => Promise.resolve({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }),
})

type Endpoint = 'summon' | 'run' | 'narrate'
async function call(name: Endpoint, body: unknown, ip?: string) {
  const { default: handler } = await import(`../api/${name}.ts`)
  let status = 0
  let json: Record<string, unknown> = {}
  const headers: Record<string, string> = {}
  const res = {
    status(c: number) { status = c; return res },
    json(d: Record<string, unknown>) { json = d; return res },
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; return res },
  }
  const reqHeaders = ip ? { 'x-forwarded-for': `${ip}, 10.0.0.1` } : {}
  await handler({ method: 'POST', headers: reqHeaders, body } as never, res as never)
  return { status, json, headers }
}

// every test uses its own IPs and tasks so module-level limiter and cache state never leak between tests
let seq = 0
const freshIp = () => `203.0.113.${++seq}`
const summonBody = (task = `Total the sales in a CSV #${++seq}`) => ({ task, language: 'cobol' })
const narrateBody = (task = `Total the sales in a CSV #${++seq}`) => ({
  task,
  numberedSource: LINES.map((l, i) => `${String(i + 1).padStart(4, '0')}  ${l}`).join('\n'),
  lineCount: LINES.length,
})

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('LLM_API_KEY', 'fake-key')
  vi.stubEnv('LLM_MODEL', 'fake-model')
  vi.stubEnv('LLM_BASE_URL', 'https://fake.llm/v1')
  vi.stubEnv('ONLINECOMPILER_API_KEY', 'fake-runner-key')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('clientIp', () => {
  it('prefers x-real-ip, then the first x-forwarded-for entry, then the socket', () => {
    expect(clientIp({ headers: { 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' } })).toBe('1.1.1.1')
    expect(clientIp({ headers: { 'x-forwarded-for': ' 2.2.2.2 , 3.3.3.3' } })).toBe('2.2.2.2')
    expect(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1')
    expect(clientIp({ headers: {} })).toBeUndefined()
  })
})

describe.each(['summon', 'run', 'narrate'] as const)('per-IP limit on /api/%s (Req 12.3)', name => {
  // an invalid body is answered 400 without any upstream call, but still counts against the limit
  const invalid = { nope: true }

  it(`the ${RATE_LIMIT + 1}th call in a minute gets 429 with Retry-After; a different IP is unaffected`, async () => {
    const ip = freshIp()
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await call(name, invalid, ip)).status).toBe(400)
    }
    const limited = await call(name, invalid, ip)
    expect(limited.status).toBe(429)
    const retry = Number(limited.headers['retry-after'])
    expect(retry).toBeGreaterThanOrEqual(1)
    expect(retry).toBeLessThanOrEqual(60)
    expect(String(limited.json.error)).toMatch(/Wait \d+ seconds/)

    expect((await call(name, invalid, freshIp())).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lets the same IP back in once the minute has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'))
    const ip = freshIp()
    for (let i = 0; i < RATE_LIMIT; i++) await call(name, invalid, ip)
    expect((await call(name, invalid, ip)).status).toBe(429)
    vi.setSystemTime(new Date('2026-11-09T12:01:00.001Z'))
    expect((await call(name, invalid, ip)).status).toBe(400)
  })
})

describe('the limit on a real summon', () => {
  it('serves 10 summons from one IP, refuses the 11th, and still serves another IP', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(llmOk(PROGRAM)))
    const ip = freshIp()
    for (let i = 0; i < RATE_LIMIT; i++) expect((await call('summon', summonBody(), ip)).status).toBe(200)
    expect((await call('summon', summonBody(), ip)).status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(RATE_LIMIT) // the refused call never reached the LLM
    expect((await call('summon', summonBody(), freshIp())).status).toBe(200)
  })
})

describe('per-instance response cache (Req 12.4)', () => {
  it('a second identical summon makes no upstream fetch', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(llmOk(PROGRAM)))
    const body = summonBody()
    const first = await call('summon', body, freshIp())
    const second = await call('summon', { ...body }, freshIp())
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.json).toEqual(first.json)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a second identical narrate makes no upstream fetch', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(llmOk(NARRATION)))
    const body = narrateBody()
    const first = await call('narrate', body, freshIp())
    const second = await call('narrate', body, freshIp())
    expect(second.status).toBe(200)
    expect(second.json).toEqual(first.json)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a different request is not served from the cache', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(llmOk(PROGRAM)))
    await call('summon', summonBody(), freshIp())
    await call('summon', summonBody(), freshIp())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('failed answers are not cached', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(llmOk('not json at all')))
    const body = summonBody()
    expect((await call('summon', body, freshIp())).status).toBe(502)
    fetchMock.mockImplementation(() => Promise.resolve(llmOk(PROGRAM)))
    expect((await call('summon', body, freshIp())).status).toBe(200)
  })

  it('keys by a stable hash of the request', () => {
    expect(requestHash({ a: 1 })).toBe(requestHash({ a: 1 }))
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }))
    expect(requestHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/)
  })
})
