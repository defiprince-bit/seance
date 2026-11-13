/**
 * tests/devLog.test.ts
 * The dev-only failed_generation log: written in dev, never on Vercel or when
 * off, never throws, and wired into chatComplete's json_validate_failed path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { logFailedGeneration, parseFailedGeneration, devLogEnabled, DEV_LOG_FILE } from '../server/llm/devLog.ts'
import { chatComplete, LlmError } from '../server/llm/client.ts'

let dir: string
const logPath = () => join(dir, DEV_LOG_FILE)
const readLines = async () => (await readFile(logPath(), 'utf8')).trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'seance-devlog-'))
  vi.stubEnv('SEANCE_DEV_LOG_DIR', dir)
  vi.stubEnv('VERCEL', '')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await rm(dir, { recursive: true, force: true })
})

const entry = { model: 'openai/gpt-oss-120b', purpose: 'summon', status: 400, message: 'Failed to validate JSON.', failedGeneration: '{"program": {"lines": ["       IDENT' }

describe('when it logs', () => {
  it('on in dev: SEANCE_DEV_LOG=1 and no VERCEL', () => {
    vi.stubEnv('SEANCE_DEV_LOG', '1')
    expect(devLogEnabled()).toBe(true)
  })

  it('off unless SEANCE_DEV_LOG=1', async () => {
    vi.stubEnv('SEANCE_DEV_LOG', '')
    await logFailedGeneration(entry)
    expect(existsSync(logPath())).toBe(false)
  })

  it('off on Vercel even if the flag is set', async () => {
    vi.stubEnv('SEANCE_DEV_LOG', '1')
    vi.stubEnv('VERCEL', '1')
    await logFailedGeneration(entry)
    expect(existsSync(logPath())).toBe(false)
  })
})

describe('what it writes', () => {
  beforeEach(() => { vi.stubEnv('SEANCE_DEV_LOG', '1') })

  it('appends one JSON line per failure with the generation and its length', async () => {
    await logFailedGeneration(entry)
    await logFailedGeneration({ ...entry, failedGeneration: '' })
    const lines = await readLines()
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ model: 'openai/gpt-oss-120b', purpose: 'summon', status: 400, failedGeneration: entry.failedGeneration, length: entry.failedGeneration.length })
    expect(lines[1]).toMatchObject({ length: 0, failedGeneration: '' })
    expect(typeof lines[0].time).toBe('string')
  })

  it('cuts very long generations', async () => {
    await logFailedGeneration({ ...entry, failedGeneration: 'x'.repeat(50_000) })
    const [line] = await readLines()
    expect(line.length).toBe(50_000)
    expect(String(line.failedGeneration).endsWith('…[cut]')).toBe(true)
    expect(String(line.failedGeneration).length).toBeLessThan(21_000)
  })

  it('never throws, even when the directory cannot be created', async () => {
    vi.stubEnv('SEANCE_DEV_LOG_DIR', join(logPath(), 'cannot', 'nest', 'under', 'a', 'file'))
    await logFailedGeneration(entry) // creates the file at logPath()
    await expect(logFailedGeneration(entry)).resolves.toBeUndefined()
  })
})

describe('parseFailedGeneration', () => {
  it("reads Groq's error body", () => {
    const body = JSON.stringify({ error: { message: 'Failed to validate JSON.', type: 'invalid_request_error', code: 'json_validate_failed', failed_generation: '{"a":' } })
    expect(parseFailedGeneration(body)).toEqual({ message: 'Failed to validate JSON.', failedGeneration: '{"a":' })
  })

  it('missing failed_generation is an empty string; non-JSON is undefined', () => {
    expect(parseFailedGeneration(JSON.stringify({ error: { message: 'm' } }))).toEqual({ message: 'm', failedGeneration: '' })
    expect(parseFailedGeneration('<html>')).toBeUndefined()
  })
})

describe('chatComplete logs json_validate_failed in dev', () => {
  it('records the failed generation, then still throws bad-json', async () => {
    vi.stubEnv('SEANCE_DEV_LOG', '1')
    const body = { error: { message: 'Failed to validate JSON. Please adjust your prompt.', type: 'invalid_request_error', code: 'json_validate_failed', failed_generation: '{"program": {"title": "Total sales", "lines": [' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify(body)), json: () => Promise.resolve(body),
    }))
    const err = await chatComplete([{ role: 'user', content: 'x' }], { baseUrl: 'https://fake.llm/v1', model: 'openai/gpt-oss-120b', apiKey: 'k', purpose: 'summon' }).catch(e => e as LlmError)
    expect(err).toMatchObject({ kind: 'bad-json' })
    const [line] = await readLines()
    expect(line).toMatchObject({ purpose: 'summon', model: 'openai/gpt-oss-120b', failedGeneration: body.error.failed_generation })
  })
})
