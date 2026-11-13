/**
 * api/summon.ts
 * Vercel Function: POST /api/summon
 *
 * Validates the request, calls the LLM to generate a COBOL program,
 * validates the response against the Program schema, and retries once
 * on invalid JSON. Returns a SummonRes.
 *
 * Requirements: 3.1, 3.4, 3.5, 3.7, 12.1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SummonReqSchema, SummonResSchema, isSummonSuccess } from '../src/lib/schemas.ts'
import type { SummonRes } from '../src/lib/schemas.ts'
import { lintFixedFormat } from '../src/lib/cobolFormat.ts'
import { getLlmConfig, chatComplete, extractJson } from '../server/llm/client.ts'
import type { ChatMessage } from '../server/llm/client.ts'
import {
  SUMMON_SYSTEM_PROMPT,
  buildSummonUserPrompt,
  buildSummonRepairPrompt,
} from '../server/llm/prompts/summon.ts'

// ---------------------------------------------------------------------------
// In-memory response cache  (Req 12.4)
// Key: SHA-256 hex of the JSON-serialised request body.
// Lifetime: the function instance (warm lambda).
// ---------------------------------------------------------------------------

const responseCache = new Map<string, unknown>()

async function cacheKey(body: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(body))
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Defense-in-depth body-size limit (Req 3.7) ────────────────────────────
  const contentLength = req.headers['content-length']
  if (contentLength && parseInt(contentLength, 10) > 70_000) {
    return res.status(413).json({ error: 'Request body too large (limit: 70 KB)' })
  }

  // ── Schema validation ──────────────────────────────────────────────────────
  const parsed = SummonReqSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
  }

  const summonReq = parsed.data

  // ── Response cache (Req 12.4) ──────────────────────────────────────────────
  const key = await cacheKey(summonReq)
  if (responseCache.has(key)) {
    return res.status(200).json(responseCache.get(key))
  }

  // ── LLM config (keys from env only — Req 12.1) ────────────────────────────
  let llmConfig
  try {
    llmConfig = getLlmConfig()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: message })
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SUMMON_SYSTEM_PROMPT },
    { role: 'user', content: buildSummonUserPrompt(summonReq) },
  ]

  // ── LLM call with one retry (Req 3.4) ─────────────────────────────────────
  // Invalid JSON / schema → plain retry. Fixed-format column problems → repair
  // retry that lists the bad lines. If the repair still has column problems,
  // the program is returned anyway so the real compiler error reaches the UI.
  let lastError = ''
  let unlinted: SummonRes | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string
    try {
      raw = await chatComplete(messages, llmConfig, /* jsonMode= */ true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      // Surface 429 / 5xx from the LLM provider
      if (message.includes('429') || message.includes('503')) {
        return res.status(429).json({ error: 'LLM provider is busy. Try again shortly.' })
      }
      return res.status(502).json({ error: `LLM error: ${message}` })
    }

    // Parse the JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(extractJson(raw))
    } catch {
      lastError = `Invalid JSON from LLM (attempt ${attempt + 1}): ${raw.slice(0, 200)}`
      continue // retry
    }

    // Validate against SummonRes schema
    const validated = SummonResSchema.safeParse(parsed)
    if (!validated.success) {
      lastError = `Schema validation failed (attempt ${attempt + 1}): ${validated.error.issues[0]?.message}`
      continue // retry
    }

    // Fixed-format column check (not run for unsupported answers)
    if (isSummonSuccess(validated.data)) {
      const issues = lintFixedFormat(validated.data.program.lines)
      if (issues.length > 0) {
        unlinted = validated.data
        lastError = `Fixed-format issues (attempt ${attempt + 1}): line ${issues[0].line} ${issues[0].detail}`
        messages.push({ role: 'assistant', content: raw })
        messages.push({ role: 'user', content: buildSummonRepairPrompt(issues) })
        continue // repair retry
      }
    }

    // Success — cache and return
    responseCache.set(key, validated.data)
    return res.status(200).json(validated.data)
  }

  // Repair still had column problems: return it uncached and let the compiler speak
  if (unlinted) return res.status(200).json(unlinted)

  // Both attempts failed (Req 3.4: return 502 with plain message)
  return res.status(502).json({
    error: `The ghost mumbled. ${lastError}`,
  })
}
