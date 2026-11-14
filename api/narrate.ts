/**
 * api/narrate.ts
 * Vercel Function: POST /api/narrate
 *
 * Validates the request, calls the LLM for ghost steps + Python translation,
 * validates steps with validateSteps, and on failure sends one repair retry
 * with the specific validation errors as a follow-up user message.
 *
 * Requirements: 5.1, 6.1, 6.3
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { NarrateReqSchema, NarrateResSchema, describeIssue, describeIssues } from '../src/lib/schemas.js'
import type { NarrateRes } from '../src/lib/schemas.js'
import { validateSteps } from '../src/lib/ranges.js'
import { missingImports, importFixes } from '../src/lib/pythonImports.js'
import { getLlmConfig, chatComplete, extractJson, LlmError } from '../server/llm/client.js'
import type { ChatMessage } from '../server/llm/client.js'
import {
  NARRATE_SYSTEM_PROMPT,
  buildNarrateUserPrompt,
  buildRepairPrompt,
  buildSchemaRepairPrompt,
  buildImportRepairPrompt,
} from '../server/llm/prompts/narrate.js'
import { LruCache } from '../src/lib/lruCache.js'
import { newEndpointLimiter, allowRequest, requestHash, CACHE_MAX_ENTRIES } from '../server/safety.js'

/** Vercel: room for a 15 s retry-after wait plus two LLM calls (Hobby allows 60 s). */
export const config = { maxDuration: 60 }

// ---------------------------------------------------------------------------
// Per-IP limit (Req 12.3) and bounded in-memory response cache (Req 12.4)
// ---------------------------------------------------------------------------

const limiter = newEndpointLimiter()
const responseCache = new LruCache<NarrateRes>(CACHE_MAX_ENTRIES)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Per-IP limit: 429 + Retry-After above 10/min (Req 12.3) ───────────────
  if (!allowRequest(limiter, req, res)) return

  // ── Schema validation ──────────────────────────────────────────────────────
  const parsed = NarrateReqSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
  }

  const narrateReq = parsed.data

  // ── Response cache (Req 12.4) ──────────────────────────────────────────────
  const key = requestHash(narrateReq)
  const cached = responseCache.get(key)
  if (cached) return res.status(200).json(cached)

  // ── LLM config (keys from env only) ───────────────────────────────────────
  let llmConfig
  try {
    llmConfig = getLlmConfig('narrate') // LLM_NARRATE_MODEL, falling back to LLM_MODEL
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: message })
  }

  // Build the conversation. The repair retry appends to this same thread so
  // the LLM has full context when correcting its mistakes.
  const messages: ChatMessage[] = [
    { role: 'system', content: NARRATE_SYSTEM_PROMPT },
    { role: 'user', content: buildNarrateUserPrompt(narrateReq) },
  ]

  let lastError = ''
  let pending: NarrateRes | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    // ── LLM call ────────────────────────────────────────────────────────────
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

    // ── JSON parse ───────────────────────────────────────────────────────────
    let rawParsed: unknown
    try {
      rawParsed = JSON.parse(extractJson(raw))
    } catch {
      lastError = `Invalid JSON from LLM (attempt ${attempt + 1}): ${raw.slice(0, 200)}`
      // For a JSON parse failure, add the assistant turn + a repair prompt
      messages.push({ role: 'assistant', content: raw })
      messages.push({
        role: 'user',
        content: 'The response was not valid JSON. Please return only a JSON object.',
      })
      continue
    }

    // ── Schema validation ────────────────────────────────────────────────────
    const validated = NarrateResSchema.safeParse(rawParsed)
    if (!validated.success) {
      // name the exact failing fields, e.g. "steps[2].range: …"
      lastError = `Schema validation failed (attempt ${attempt + 1}): ${describeIssue(validated.error.issues[0])}`
      messages.push({ role: 'assistant', content: raw })
      messages.push({ role: 'user', content: buildSchemaRepairPrompt(describeIssues(validated.error)) })
      continue
    }

    const { steps, python, note } = validated.data

    // ── validateSteps (Req 5.1 — ranges must be valid) ─────────────────────
    const rangeErrors = validateSteps(steps, narrateReq.lineCount)
    if (rangeErrors.length > 0) {
      lastError = `Step validation failed (attempt ${attempt + 1}): ${rangeErrors[0].kind} at index ${rangeErrors[0].index}`
      // Repair retry: append assistant response + targeted repair prompt
      messages.push({ role: 'assistant', content: raw })
      messages.push({ role: 'user', content: buildRepairPrompt(rangeErrors) })
      continue
    }

    // ── The translation imports what it uses ─────────────────────────────────
    const missing = missingImports(python.map(l => l.text).join('\n'))
    if (missing.length > 0) {
      pending = { steps, python, note }
      lastError = `Missing imports (attempt ${attempt + 1}): ${importFixes(missing).join('; ')}`
      messages.push({ role: 'assistant', content: raw })
      messages.push({ role: 'user', content: buildImportRepairPrompt(importFixes(missing)) })
      continue
    }

    // ── Success ──────────────────────────────────────────────────────────────
    const result = { steps, python, note }
    responseCache.set(key, result)
    return res.status(200).json(result)
  }

  // The repair still misses an import: return it uncached so the Python
  // runtime error (NameError) shows in the output pane rather than a mumble.
  if (pending) return res.status(200).json(pending)

  // Both attempts exhausted
  return res.status(502).json({
    // code lets the client tell this apart from a busy 5xx
    code: 'ghost-mumbled',
    error: `The ghost mumbled. ${lastError}`,
  })
}
