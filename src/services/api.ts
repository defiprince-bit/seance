/**
 * src/services/api.ts
 * Thin fetch wrappers for the three Vercel Functions.
 * All calls go through our own /api/* routes — no LLM keys in the browser.
 */
import { SummonResSchema, RunSchema, NarrateResSchema } from '../lib/schemas.ts'
import type { SummonRes, Run, NarrateRes } from '../lib/schemas.ts'

/** Thrown when the server returns 429 or 5xx — triggers the busy state. */
export class BusyError extends Error {
  constructor(status: number) {
    super(`Server returned ${status}`)
    this.name = 'BusyError'
  }
}

async function apiPost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (res.status === 429 || res.status >= 500) {
    throw new BusyError(res.status)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${path} returned ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export async function apiSummon(
  task: string,
  csvHeader: string | undefined,
  signal?: AbortSignal,
): Promise<SummonRes> {
  const raw = await apiPost('/api/summon', { task, language: 'cobol', csvHeader }, signal)
  return SummonResSchema.parse(raw)
}

export async function apiRun(
  source: string,
  stdin: string,
  signal?: AbortSignal,
): Promise<Run> {
  const raw = await apiPost('/api/run', { language: 'cobol', source, stdin }, signal)
  return RunSchema.parse(raw)
}

export async function apiNarrate(
  task: string,
  numberedSource: string,
  lineCount: number,
  signal?: AbortSignal,
): Promise<NarrateRes> {
  const raw = await apiPost('/api/narrate', { task, numberedSource, lineCount }, signal)
  return NarrateResSchema.parse(raw)
}
