/**
 * api/run.ts
 * Vercel Function: POST /api/run
 *
 * Validates the request body, applies the "resting spirit" guard for
 * fortran/basic, enforces character limits, calls the runner adapter,
 * and returns a Run object. Never exposes runner API keys to the client.
 *
 * Requirements: 4.1, 4.2, 4.2a, 4.6, 12.1, 12.2
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { RunReqSchema } from '../src/lib/schemas.ts'
import { runCobol } from '../server/runners/onlinecompiler.ts'

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Defense-in-depth: reject bodies > 70 KB (Req 3.7 / 12.2) ─────────────
  // Vercel parses JSON bodies automatically; raw size check via Content-Length.
  const contentLength = req.headers['content-length']
  if (contentLength && parseInt(contentLength, 10) > 70_000) {
    return res.status(413).json({ error: 'Request body too large (limit: 70 KB)' })
  }

  // ── Schema validation ──────────────────────────────────────────────────────
  const parsed = RunReqSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
  }

  const { language, source, stdin } = parsed.data

  // ── Resting spirit guard (Req 4.2a, Decision A) ───────────────────────────
  if (language === 'fortran' || language === 'basic') {
    return res.status(400).json({ error: 'This spirit is resting.' })
  }

  // ── Character-level size limits (Req 12.2) ────────────────────────────────
  // The zod schema already enforces these; this is belt-and-suspenders.
  if (source.length > 20_000) {
    return res.status(413).json({ error: 'Source exceeds 20 000 character limit' })
  }
  if (stdin.length > 70_000) {
    return res.status(413).json({ error: 'stdin exceeds 70 000 character limit' })
  }

  // ── Read runner config from env (Req 12.1 — keys server-only) ─────────────
  const runnerKind = process.env['RUNNER_KIND'] ?? 'onlinecompiler'
  const apiKey = process.env['ONLINECOMPILER_API_KEY'] ?? ''

  try {
    let run

    if (runnerKind === 'onlinecompiler') {
      if (!apiKey) {
        return res.status(500).json({ error: 'Runner not configured' })
      }
      run = await runCobol(source, stdin, apiKey)
    } else {
      // selfhost and fixtures adapters are implemented in later tasks
      return res.status(503).json({ error: 'Runner adapter not available' })
    }

    return res.status(200).json(run)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    // Surface 429 / 5xx from the upstream runner as our own 502 so the client
    // shows the "busy" state (Req 8.2)
    if (message.includes('429') || message.includes('503') || message.includes('502')) {
      return res.status(502).json({ error: 'Runner is busy. Try a cached séance.' })
    }

    return res.status(502).json({ error: `Runner error: ${message}` })
  }
}
