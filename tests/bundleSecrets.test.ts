// @vitest-environment node
/**
 * tests/bundleSecrets.test.ts  (task 15)
 * Builds the client with Vite into a temp folder and greps every emitted file
 * for server-only env var names, a Groq key prefix, the provider endpoints the
 * client must never call directly, and the real secret values from a local
 * .env (if one exists). Any hit fails. Validates: Requirements 12.1
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { build } from 'vite'

/** Every server-only env var name from .env.example and tech.md. */
const SERVER_ENV_NAMES = [
  'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL', 'LLM_NARRATE_MODEL',
  'RUNNER_KIND', 'ONLINECOMPILER_API_KEY', 'SELFHOST_RUNNER_URL', 'SELFHOST_RUNNER_TOKEN',
]
/** Credential shapes and server-side endpoints. */
const FORBIDDEN = ['gsk_', 'api.groq.com', 'api.onlinecompiler.io', 'Bearer ']

/** Values from a local .env for keys that hold secrets or private URLs. */
function localSecretValues(): string[] {
  if (!existsSync('.env')) return []
  return readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map(l => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .filter(([, name]) => /KEY|TOKEN|SECRET|URL/.test(name))
    .map(([, , value]) => value.replace(/^["']|["']$/g, ''))
    .filter(v => v.length >= 8)
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? filesUnder(p) : [p]
  })
}

let outDir = ''
let files: { path: string; text: string }[] = []

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'seance-dist-'))
  await build({
    configFile: 'vite.config.ts',
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  })
  files = filesUnder(outDir).map(p => ({ path: relative(outDir, p), text: readFileSync(p, 'latin1') }))
}, 120_000)

afterAll(() => { if (outDir) rmSync(outDir, { recursive: true, force: true }) })

describe('client bundle holds no secrets (Req 12.1)', () => {
  it('emitted a real build', () => {
    expect(files.some(f => f.path.endsWith('index.html'))).toBe(true)
    expect(files.some(f => f.path.endsWith('.js'))).toBe(true)
  })

  it.each([...SERVER_ENV_NAMES, ...FORBIDDEN])('no file contains %s', needle => {
    const hits = files.filter(f => f.text.includes(needle)).map(f => f.path)
    expect(hits).toEqual([])
  })

  it('no file contains a secret value from the local .env', () => {
    const values = localSecretValues()
    for (const value of values) {
      const hits = files.filter(f => f.text.includes(value)).map(f => f.path)
      // report the key position, never the value itself
      expect(hits, `a .env secret value (length ${value.length}) leaked`).toEqual([])
    }
  })
})
