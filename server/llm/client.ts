/**
 * server/llm/client.ts
 * Thin wrapper around any OpenAI-compatible chat completion API.
 *
 * Config (all read from env — never from client code):
 *   LLM_BASE_URL  e.g. https://api.groq.com/openai/v1  (default)
 *   LLM_MODEL     e.g. llama-3.3-70b-versatile
 *   LLM_API_KEY   secret key
 *
 * Design constraints (tech.md):
 *   - JSON response mode is requested when the provider supports it
 *     (sent as response_format: { type: "json_object" }).
 *   - No retry logic here — callers own retry strategy.
 *   - Throws on network or non-2xx errors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
}

interface ChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
}

// ---------------------------------------------------------------------------
// LlmClient
// ---------------------------------------------------------------------------

export interface LlmConfig {
  baseUrl: string
  model: string
  apiKey: string
}

/**
 * Reads LLM config from environment variables.
 * Throws if required variables are missing.
 */
export function getLlmConfig(): LlmConfig {
  const baseUrl = process.env['LLM_BASE_URL'] || 'https://api.groq.com/openai/v1'
  const model = process.env['LLM_MODEL'] ?? ''
  const apiKey = process.env['LLM_API_KEY'] ?? ''

  if (!model) throw new Error('LLM_MODEL environment variable is not set')
  if (!apiKey) throw new Error('LLM_API_KEY environment variable is not set')

  return { baseUrl, model, apiKey }
}

/**
 * Sends a chat completion request and returns the raw text of the first choice.
 *
 * @param messages   The conversation messages to send.
 * @param config     LLM config (base URL, model, API key).
 * @param jsonMode   If true, requests JSON response mode. Default: true.
 * @returns          The raw assistant message content.
 * @throws           On network errors, non-2xx responses, or empty choices.
 */
export async function chatComplete(
  messages: ChatMessage[],
  config: LlmConfig,
  jsonMode = true,
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`

  const body: ChatCompletionRequest = {
    model: config.model,
    messages,
    temperature: 0.2,
  }

  if (jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`LLM API returned ${response.status}: ${text}`)
  }

  const data = (await response.json()) as ChatCompletionResponse

  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('LLM returned an empty response')
  }

  return content
}

/**
 * Extracts a JSON object from a string that may be wrapped in markdown code
 * fences (```json ... ```) — common with some providers that ignore
 * response_format.
 *
 * Returns the inner JSON string ready for JSON.parse.
 */
export function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)
  if (fenced?.[1]) return fenced[1].trim()

  // If no fences, assume the whole string is JSON (may have leading/trailing whitespace)
  return raw.trim()
}
