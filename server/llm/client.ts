/**
 * server/llm/client.ts
 * Thin wrapper around any OpenAI-compatible chat completion API (Groq by default).
 *
 * Config (server env only):
 *   LLM_BASE_URL        default https://api.groq.com/openai/v1
 *   LLM_MODEL           model for summon (and narrate unless overridden)
 *   LLM_NARRATE_MODEL   optional model for narrate, e.g. openai/gpt-oss-20b, which
 *                       has its own tokens-per-minute bucket on Groq
 *   LLM_API_KEY         secret key
 *
 * Retries owned here (callers own the "one silent retry" for bad answers):
 *   - network failure ("fetch failed"): one retry
 *   - HTTP 429 with retry-after ≤ 10 s: wait that long, retry once
 * Failures are thrown as LlmError with a kind the handlers can branch on.
 */

import { withNetworkRetry } from '../../src/lib/retry.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  response_format?: { type: 'json_object' }
  temperature?: number
  max_tokens?: number
  reasoning_effort?: 'low' | 'medium' | 'high'
}

interface ChatCompletionResponse {
  choices: Array<{ message: { role: string; content: string }; finish_reason: string }>
}

/**
 *   rate-limited  429 we could not wait out, or 503     → handlers answer 429 (busy)
 *   bad-json      provider rejected the model's JSON    → handlers use their one retry
 *   http          anything else non-2xx                 → handlers answer 502
 */
export type LlmErrorKind = 'rate-limited' | 'bad-json' | 'http'

export class LlmError extends Error {
  readonly kind: LlmErrorKind
  readonly status: number
  readonly retryAfterSec?: number
  constructor(kind: LlmErrorKind, status: number, message: string, retryAfterSec?: number) {
    super(message)
    this.name = 'LlmError'
    this.kind = kind
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

export interface LlmConfig {
  baseUrl: string
  model: string
  apiKey: string
  /** Groq reasoning models (gpt-oss) only; sent as reasoning_effort when set */
  reasoningEffort?: 'low' | 'medium' | 'high'
}

export type LlmPurpose = 'summon' | 'narrate'

/** Reads LLM config from env. Narration may use LLM_NARRATE_MODEL; it falls back to LLM_MODEL. */
export function getLlmConfig(purpose: LlmPurpose = 'summon'): LlmConfig {
  const baseUrl = process.env['LLM_BASE_URL'] || 'https://api.groq.com/openai/v1'
  const main = process.env['LLM_MODEL'] ?? ''
  const model = (purpose === 'narrate' && process.env['LLM_NARRATE_MODEL']) || main
  const apiKey = process.env['LLM_API_KEY'] ?? ''

  if (!model) throw new Error('LLM_MODEL environment variable is not set')
  if (!apiKey) throw new Error('LLM_API_KEY environment variable is not set')

  // Narration on a gpt-oss model needs low reasoning effort: at Groq's default
  // effort, gpt-oss-20b spent its whole output budget reasoning and returned no
  // JSON (Groq reports that as 400 json_validate_failed). Summon is unchanged.
  if (purpose === 'narrate' && /(^|\/)gpt-oss/.test(model)) {
    return { baseUrl, model, apiKey, reasoningEffort: 'low' }
  }
  return { baseUrl, model, apiKey }
}

/** Longest retry-after we will wait inside one request. */
export const MAX_RETRY_AFTER_SEC = 10

/** retry-after is either delay-seconds or an HTTP date. Returns seconds, or undefined. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined
  const value = header.trim()
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
  const at = Date.parse(value)
  return Number.isNaN(at) ? undefined : Math.max(0, (at - now) / 1000)
}

/** Groq answers 400 when json_object mode rejects what the model generated. */
function isBadJson(status: number, text: string): boolean {
  return status === 400 && (/json_validate_failed/.test(text) || /Failed to (validate|generate) JSON/i.test(text))
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Sends a chat completion request and returns the first choice's text.
 * @throws LlmError (see LlmErrorKind), or the network error after its one retry
 */
export async function chatComplete(messages: ChatMessage[], config: LlmConfig, jsonMode = true): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const body: ChatCompletionRequest = { model: config.model, messages, temperature: 0.2 }
  if (jsonMode) body.response_format = { type: 'json_object' }
  if (config.reasoningEffort) body.reasoning_effort = config.reasoningEffort

  const send = () => withNetworkRetry(() => fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))

  let response = await send()

  // 429: wait out a short retry-after once; a long or missing one is "busy"
  if (response.status === 429) {
    const wait = parseRetryAfter(response.headers?.get('retry-after') ?? null)
    if (wait !== undefined && wait <= MAX_RETRY_AFTER_SEC) {
      await response.text().catch(() => '') // release the body
      await sleep(wait * 1000)
      response = await send()
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const message = `LLM API returned ${response.status}: ${text.slice(0, 500)}`
    if (response.status === 429 || response.status === 503) {
      throw new LlmError('rate-limited', response.status, message, parseRetryAfter(response.headers?.get('retry-after') ?? null))
    }
    if (isBadJson(response.status, text)) throw new LlmError('bad-json', response.status, message)
    throw new LlmError('http', response.status, message)
  }

  const data = (await response.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM returned an empty response')
  return content
}

/**
 * Extracts a JSON object from a string that may be wrapped in markdown code
 * fences (```json ... ```), which some providers emit despite response_format.
 */
export function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)
  if (fenced?.[1]) return fenced[1].trim()
  return raw.trim()
}
