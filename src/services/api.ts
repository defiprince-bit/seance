/**
 * src/services/api.ts
 * The one fetch wrapper for our three Vercel Functions. Every failure becomes
 * an ApiError that says which pipeline step failed and how:
 *
 *   network failure ("Failed to fetch")  → one retry with short backoff, then 'busy'
 *   HTTP 429 or any 5xx                   → 'busy' straight away (no retry)
 *   HTTP 502 + code "ghost-mumbled"       → 'invalid' (LLM JSON bad twice, Req 3.4)
 *   other non-2xx (400, 413, …)           → 'invalid' with the server's message
 *   2xx body that is not valid JSON/schema → 'invalid'
 *
 * Aborts (Esc) are rethrown untouched. No LLM or runner keys live in the browser.
 */
import type { ZodType, ZodTypeDef } from 'zod'
import { SummonResSchema, RunSchema, NarrateResSchema } from '../lib/schemas.ts'
import type { SummonRes, Run, NarrateRes } from '../lib/schemas.ts'
import { withNetworkRetry, isNetworkError } from '../lib/retry.ts'
import type { PipelineStep } from '../state/seance.ts'

export type { PipelineStep }
export type ApiErrorKind = 'busy' | 'invalid'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly step: PipelineStep
  readonly status?: number
  constructor(kind: ApiErrorKind, step: PipelineStep, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.step = step
    this.status = status
  }
}

/** Backoff before the single network retry. */
export const NETWORK_RETRY_DELAY_MS = 300

const isAbort = (err: unknown) => err instanceof Error && err.name === 'AbortError'

async function readError(res: Response): Promise<{ code?: string; error?: string }> {
  try {
    const body: unknown = await res.json()
    return typeof body === 'object' && body !== null ? (body as { code?: string; error?: string }) : {}
  } catch {
    return {}
  }
}

export async function apiPost<T>(
  path: string,
  step: PipelineStep,
  body: unknown,
  // output type T; any input type (schemas with z.preprocess take unknown)
  schema: ZodType<T, ZodTypeDef, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response
  try {
    res = await withNetworkRetry(
      () => fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
      { retries: 1, delayMs: NETWORK_RETRY_DELAY_MS, signal },
    )
  } catch (err) {
    if (isAbort(err)) throw err
    if (isNetworkError(err)) throw new ApiError('busy', step, 'The network dropped the request twice.')
    throw err
  }

  if (!res.ok) {
    const info = await readError(res)
    if (info.code === 'ghost-mumbled') {
      throw new ApiError('invalid', step, info.error ?? 'The ghost mumbled.', res.status)
    }
    if (res.status === 429 || res.status >= 500) {
      throw new ApiError('busy', step, info.error ?? `Server returned ${res.status}`, res.status)
    }
    throw new ApiError('invalid', step, info.error ?? `${path} returned ${res.status}`, res.status)
  }

  let raw: unknown
  try {
    raw = await res.json()
  } catch (err) {
    if (isAbort(err)) throw err
    throw new ApiError('invalid', step, `${path} sent back something that is not JSON.`, res.status)
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError('invalid', step, `${path} sent back an unexpected shape: ${parsed.error.issues[0]?.message}`, res.status)
  }
  return parsed.data
}

export function apiSummon(task: string, csvHeader: string | undefined, signal?: AbortSignal): Promise<SummonRes> {
  return apiPost('/api/summon', 'summon', { task, language: 'cobol', csvHeader }, SummonResSchema, signal)
}

export function apiRun(source: string, stdin: string, signal?: AbortSignal): Promise<Run> {
  return apiPost('/api/run', 'run', { language: 'cobol', source, stdin }, RunSchema, signal)
}

export function apiNarrate(task: string, numberedSource: string, lineCount: number, signal?: AbortSignal): Promise<NarrateRes> {
  return apiPost('/api/narrate', 'narrate', { task, numberedSource, lineCount }, NarrateResSchema, signal)
}
