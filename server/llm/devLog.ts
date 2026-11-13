/**
 * server/llm/devLog.ts
 * Dev-only record of what the model actually generated when Groq rejected it
 * as invalid JSON (400 json_validate_failed). Groq returns that text as
 * error.failed_generation; it is the only way to see WHY a summon or narration
 * failed. Each failure appends one JSON line to
 *   <SEANCE_DEV_LOG_DIR or .dev-logs>/llm-failed-generations.jsonl
 * and prints a one-line summary.
 *
 * On only when SEANCE_DEV_LOG=1 (set by the `npm run dev` plugin) AND not on
 * Vercel (VERCEL unset). Best effort: it never throws and never blocks the reply.
 * The log holds model output only; no keys or request headers.
 */
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const DEV_LOG_FILE = 'llm-failed-generations.jsonl'
/** Long generations are cut so one failure cannot fill the disk. */
const MAX_CHARS = 20_000

export function devLogEnabled(): boolean {
  return process.env['SEANCE_DEV_LOG'] === '1' && !process.env['VERCEL']
}

export interface FailedGeneration {
  model: string
  purpose?: string
  status: number
  message: string
  failedGeneration: string
}

/** Pulls error.failed_generation and error.message out of Groq's error body. */
export function parseFailedGeneration(text: string): { message: string; failedGeneration: string } | undefined {
  try {
    const err = (JSON.parse(text) as { error?: { message?: unknown; failed_generation?: unknown } }).error
    if (!err) return undefined
    return {
      message: typeof err.message === 'string' ? err.message : '',
      failedGeneration: typeof err.failed_generation === 'string' ? err.failed_generation : '',
    }
  } catch {
    return undefined
  }
}

export async function logFailedGeneration(entry: FailedGeneration): Promise<void> {
  if (!devLogEnabled()) return
  try {
    const dir = process.env['SEANCE_DEV_LOG_DIR'] || '.dev-logs'
    const gen = entry.failedGeneration
    const line = {
      time: new Date().toISOString(),
      ...entry,
      length: gen.length,
      failedGeneration: gen.length > MAX_CHARS ? `${gen.slice(0, MAX_CHARS)}…[cut]` : gen,
    }
    await mkdir(dir, { recursive: true })
    await appendFile(join(dir, DEV_LOG_FILE), JSON.stringify(line) + '\n', 'utf8')
    const shape = gen.length === 0 ? 'EMPTY generation' : `${gen.length} chars, ends ${JSON.stringify(gen.slice(-40))}`
    console.warn(`[seance dev] ${entry.purpose ?? 'llm'} on ${entry.model}: json_validate_failed, ${shape} → ${join(dir, DEV_LOG_FILE)}`)
  } catch {
    // dev logging must never break a request
  }
}
