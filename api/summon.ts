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
import { SummonReqSchema, SummonResSchema, isSummonSuccess, describeIssue, describeIssues } from '../src/lib/schemas.js'
import type { SummonRes } from '../src/lib/schemas.js'
import { lintFixedFormat } from '../src/lib/cobolFormat.js'
import { getLlmConfig, chatComplete, extractJson, LlmError } from '../server/llm/client.js'
import type { ChatMessage } from '../server/llm/client.js'
import {
  SUMMON_SYSTEM_PROMPT,
  buildSummonUserPrompt,
  buildSummonRepairPrompt,
} from '../server/llm/prompts/summon.js'
import { LruCache } from '../src/lib/lruCache.js'
import { newEndpointLimiter, allowRequest, requestHash, CACHE_MAX_ENTRIES } from '../server/safety.js'

/** Vercel: room for a 15 s retry-after wait plus two LLM calls (Hobby allows 60 s). */
export const config = { maxDuration: 60 }

// ---------------------------------------------------------------------------
// Per-IP limit (Req 12.3) and bounded in-memory response cache (Req 12.4)
// Key: SHA-256 hex of the validated request. Lifetime: the function instance.
// ---------------------------------------------------------------------------

const limiter = newEndpointLimiter()
const responseCache = new LruCache<SummonRes>(CACHE_MAX_ENTRIES)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Per-IP limit: 429 + Retry-After above 10/min (Req 12.3) ───────────────
  if (!allowRequest(limiter, req, res)) return

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
  const key = requestHash(summonReq)
  const cached = responseCache.get(key)
  if (cached) return res.status(200).json(cached)

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
      // the provider rejected the model's JSON: same as invalid JSON, use the retry
      if (err instanceof LlmError && err.kind === 'bad-json') {
        lastError = `The provider rejected the model's JSON (attempt ${attempt + 1})`
        continue
      }
      if (err instanceof LlmError && err.kind === 'rate-limited') {
        return res.status(429).json({ error: 'LLM provider is busy. Try again shortly.' })
      }
      const message = err instanceof Error ? err.message : String(err)
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
      // name the exact failing fields, e.g. "program.lines: Array must contain at most 120 element(s)"
      lastError = `Schema validation failed (attempt ${attempt + 1}): ${describeIssue(validated.error.issues[0])}`
      messages.push({ role: 'assistant', content: raw })
      messages.push({
        role: 'user',
        content: `The JSON did not match the required shape. Fix these fields and return the complete JSON again:\n${describeIssues(validated.error)}`,
      })
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
    // code lets the client tell this apart from a busy 5xx
    code: 'ghost-mumbled',
    error: `The ghost mumbled. ${lastError}`,
  })
}
