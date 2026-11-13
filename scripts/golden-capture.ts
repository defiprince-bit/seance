/**
 * scripts/golden-capture.ts  (task 10.1)
 * Captures one golden séance per suggestion chip from the DEPLOYED APIs and
 * saves src/fixtures/golden/<slug>.json only when COBOL and Python agree.
 *
 *   summon → run → narrate (each call paced ~60 s apart) → Python in Pyodide → agree
 *
 * Usage:  SEANCE_BASE_URL=https://seance-psi.vercel.app npm run golden:capture [-- flags]
 *   --force           re-capture chips that already have a captured fixture
 *   --only=a,b        only these slugs (sales, compound-interest, sort-names, payroll)
 *   --gap=SECONDS     spacing between API calls (default 60)
 * A "hand-made" placeholder fixture is always replaced (Req 8.1).
 * 429/503 answers are retried using retry-after, or the gap when there is none.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CHIPS, GoldenSeanceSchema, captureDecision, csvHeader } from '../src/lib/golden.js'
import type { Chip, GoldenSeance } from '../src/lib/golden.js'
import { SummonResSchema, RunSchema, NarrateResSchema, isSummonSuccess } from '../src/lib/schemas.js'
import type { Run } from '../src/lib/schemas.js'
import { encodeStdin } from '../src/lib/stdin.js'
import { numberSource } from '../src/lib/numbering.js'
import { agree } from '../src/lib/results.js'

export const FIXTURE_DIR = join('src', 'fixtures', 'golden')

export interface Args { force: boolean; only?: string[]; gapMs: number }

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = { force: false, gapMs: 60_000 }
  for (const a of argv) {
    if (a === '--force') args.force = true
    else if (a.startsWith('--only=')) args.only = a.slice(7).split(',').map(s => s.trim()).filter(Boolean)
    else if (a.startsWith('--gap=')) args.gapMs = Math.max(0, Number(a.slice(6))) * 1000
    else throw new Error(`Unknown flag ${a}`)
  }
  return args
}

export type Sleep = (ms: number) => Promise<void>
export const realSleep: Sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** Keeps API calls at least `gapMs` apart (measured from the start of the last call). */
export class Pacer {
  private last = -Infinity
  private readonly gapMs: number
  private readonly sleep: Sleep
  private readonly now: () => number
  constructor(gapMs: number, sleep: Sleep, now: () => number = Date.now) {
    this.gapMs = gapMs
    this.sleep = sleep
    this.now = now
  }
  async wait(): Promise<void> {
    const due = this.last + this.gapMs - this.now()
    if (due > 0) await this.sleep(due)
    this.last = this.now()
  }
}

/** retry-after in seconds (number or HTTP date), or undefined. */
export function retryAfterMs(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined
  if (/^\d+(\.\d+)?$/.test(header.trim())) return Number(header.trim()) * 1000
  const at = Date.parse(header)
  return Number.isNaN(at) ? undefined : Math.max(0, at - now)
}

export interface PostOptions { sleep: Sleep; defaultWaitMs: number; maxAttempts?: number; maxWaitMs?: number; log?: (m: string) => void }

/** POSTs JSON; on 429 or 503 waits retry-after (or defaultWaitMs) and tries again. */
export async function postJson(fetchFn: typeof fetch, url: string, body: unknown, o: PostOptions): Promise<{ status: number; json: unknown }> {
  const maxAttempts = o.maxAttempts ?? 4
  const maxWaitMs = o.maxWaitMs ?? 30 * 60_000
  for (let attempt = 1; ; attempt++) {
    const res = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json: unknown = await res.json().catch(() => undefined)
    if ((res.status !== 429 && res.status !== 503) || attempt >= maxAttempts) return { status: res.status, json }
    const wait = Math.min(retryAfterMs(res.headers.get('retry-after')) ?? o.defaultWaitMs, maxWaitMs)
    o.log?.(`  ${res.status} from ${url}; waiting ${Math.round(wait / 1000)} s (attempt ${attempt}/${maxAttempts})`)
    await o.sleep(wait)
  }
}

export interface CaptureDeps {
  baseUrl: string
  post: (path: string, body: unknown) => Promise<{ status: number; json: unknown }>
  runPython: (code: string, stdin: string) => Promise<Run>
  now: () => Date
}

export type CaptureResult = { ok: true; golden: GoldenSeance } | { ok: false; reason: string }

const errorOf = (json: unknown) => String((json as { error?: unknown } | undefined)?.error ?? JSON.stringify(json)).slice(0, 200)

/** One chip, start to finish. Never writes anything; the caller saves on ok. */
export async function captureChip(chip: Chip, deps: CaptureDeps): Promise<CaptureResult> {
  const stdin = encodeStdin(chip.csv?.text)

  const s = await deps.post('/api/summon', { task: chip.task, language: 'cobol', csvHeader: csvHeader(chip.csv) })
  if (s.status !== 200) return { ok: false, reason: `summon ${s.status}: ${errorOf(s.json)}` }
  const summon = SummonResSchema.safeParse(s.json)
  if (!summon.success) return { ok: false, reason: 'summon returned an unexpected shape' }
  if (!isSummonSuccess(summon.data)) return { ok: false, reason: `summon said unsupported: ${summon.data.reason}` }
  const { program } = summon.data

  const r = await deps.post('/api/run', { language: 'cobol', source: program.lines.join('\n'), stdin })
  const run = RunSchema.safeParse(r.json)
  if (r.status !== 200 || !run.success) return { ok: false, reason: `run ${r.status}: ${errorOf(r.json)}` }
  if (run.data.compileError) return { ok: false, reason: `COBOL did not compile (line ${run.data.compileError.line ?? '?'})` }
  if (run.data.timedOut || run.data.exitCode !== 0) return { ok: false, reason: `COBOL run failed (exit ${run.data.exitCode})` }

  const n = await deps.post('/api/narrate', { task: chip.task, numberedSource: numberSource(program.lines), lineCount: program.lines.length })
  const narration = NarrateResSchema.safeParse(n.json)
  if (n.status !== 200 || !narration.success) return { ok: false, reason: `narrate ${n.status}: ${errorOf(n.json)}` }

  const pythonRun = await deps.runPython(narration.data.python.map(l => l.text).join('\n'), stdin)
  if (pythonRun.exitCode !== 0) return { ok: false, reason: `Python failed: ${(pythonRun.stderr ?? '').split('\n').filter(Boolean).at(-1) ?? 'exit ' + pythonRun.exitCode}` }

  const verdict = agree(run.data.stdout, pythonRun.stdout)
  if (verdict.status !== 'match') {
    return { ok: false, reason: `runs disagree (${verdict.status}): COBOL ${verdict.cobolValue ?? '-'}, Python ${verdict.pythonValue ?? '-'}` }
  }

  const golden = GoldenSeanceSchema.parse({
    version: 1, slug: chip.slug, label: chip.label, task: chip.task, ...(chip.csv ? { csv: chip.csv } : {}),
    provenance: 'captured', capturedAt: deps.now().toISOString(), source: deps.baseUrl,
    program, cobolRun: run.data, narration: narration.data, pythonRun,
  })
  return { ok: true, golden }
}

/** Python through Pyodide in Node, fed the protocol stdin line by line. */
export async function runPythonInPyodide(code: string, stdin: string): Promise<Run> {
  const { loadPyodide } = await import('pyodide')
  const py = await loadPyodide()
  let out = ''
  let err = ''
  py.setStdout({ batched: (t: string) => { out += t + '\n' } })
  py.setStderr({ batched: (t: string) => { err += t + '\n' } })
  const feed = stdin.split('\n')
  if (feed.at(-1) === '') feed.pop()
  let i = 0
  py.setStdin({ stdin: () => (i < feed.length ? feed[i++] + '\n' : null) })
  try {
    await py.runPythonAsync(code)
    return { stdout: out.trimEnd(), ...(err.trim() ? { stderr: err.trim() } : {}), exitCode: 0, runner: 'pyodide' }
  } catch (e) {
    return { stdout: out.trimEnd(), stderr: (err + String((e as Error).message ?? e)).trim(), exitCode: 1, runner: 'pyodide' }
  }
}

async function readExisting(path: string): Promise<unknown | undefined> {
  try { return JSON.parse(await readFile(path, 'utf8')) as unknown } catch { return undefined }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv)
  const baseUrl = (process.env['SEANCE_BASE_URL'] ?? '').replace(/\/+$/, '')
  if (!/^https?:\/\//.test(baseUrl)) {
    console.error('Set SEANCE_BASE_URL to the deployed app, e.g. https://seance-psi.vercel.app')
    return 2
  }
  const chips = CHIPS.filter(c => !args.only || args.only.includes(c.slug))
  const pacer = new Pacer(args.gapMs, realSleep)
  const post = async (path: string, body: unknown) => {
    await pacer.wait()
    console.log(`  POST ${path}`)
    return postJson(fetch, baseUrl + path, body, { sleep: realSleep, defaultWaitMs: args.gapMs || 60_000, log: console.log })
  }

  let saved = 0
  let failed = 0
  for (const chip of chips) {
    const file = join(FIXTURE_DIR, `${chip.slug}.json`)
    const decision = captureDecision(await readExisting(file), args.force)
    if (decision === 'skip') { console.log(`${chip.slug}: fixture exists, skipping (use --force)`); continue }
    console.log(`${chip.slug}: ${decision === 'replace-hand-made' ? 'replacing the hand-made placeholder' : 'capturing'}`)
    const result = await captureChip(chip, { baseUrl, post, runPython: runPythonInPyodide, now: () => new Date() })
    if (!result.ok) { failed++; console.log(`${chip.slug}: NOT saved, ${result.reason}`); continue }
    await writeFile(file, JSON.stringify(result.golden, null, 2) + '\n', 'utf8')
    saved++
    console.log(`${chip.slug}: saved ${file} (both runs print ${result.golden.cobolRun.stdout.trim().split('\n').at(-1)})`)
  }
  console.log(`\nDone: ${saved} saved, ${failed} not saved, ${chips.length - saved - failed} skipped.`)
  return failed > 0 ? 1 : 0
}

// run only when executed directly, never when imported (tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code }, err => { console.error(err); process.exitCode = 1 })
}
