/**
 * server/safety.ts
 * Abuse limits shared by api/summon, api/run and api/narrate (Req 12.3, 12.4):
 * the per-IP limit check with a 429 + Retry-After answer, and the request
 * hash used as the response-cache key. Server only.
 */
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createRateLimiter } from '../src/lib/rateLimit.js'
import type { RateLimiter } from '../src/lib/rateLimit.js'

/** Req 12.3: 10 requests per minute per IP, per endpoint. */
export const RATE_LIMIT = 10
export const RATE_WINDOW_MS = 60_000
/** Successful responses kept per instance (summon and narrate each). */
export const CACHE_MAX_ENTRIES = 200

export function newEndpointLimiter(): RateLimiter {
  return createRateLimiter({ limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS })
}

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v?.split(',')[0]?.trim() || undefined
}

/**
 * The caller's IP. Vercel sets x-real-ip and x-forwarded-for itself; the dev
 * server falls back to the socket address. Undefined when none is known.
 */
export function clientIp(req: Pick<VercelRequest, 'headers'> & { socket?: { remoteAddress?: string } }): string | undefined {
  return first(req.headers['x-real-ip']) ?? first(req.headers['x-forwarded-for']) ?? req.socket?.remoteAddress ?? undefined
}

/**
 * Counts this request against the caller's IP. Returns true when the request
 * may go ahead; otherwise it has already answered 429 with Retry-After.
 * Requests with no known IP are not limited (best effort, Req 12.3).
 */
export function allowRequest(limiter: RateLimiter, req: VercelRequest, res: VercelResponse, now = Date.now()): boolean {
  const ip = clientIp(req)
  if (!ip) return true
  const decision = limiter.hit(ip, now)
  if (decision.allowed) return true
  if (typeof res.setHeader === 'function') res.setHeader('Retry-After', String(decision.retryAfterSec))
  res.status(429).json({
    error: `Too many séances at once. Wait ${decision.retryAfterSec} seconds and try again, or pick a sample.`,
  })
  return false
}

/** SHA-256 hex of the JSON of a validated request: the response-cache key. */
export function requestHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex')
}
