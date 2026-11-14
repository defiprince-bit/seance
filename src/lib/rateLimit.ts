/**
 * src/lib/rateLimit.ts
 * Sliding-window rate limiter (Req 12.3): at most `limit` hits per key in any
 * `windowMs`. In memory and best effort: each serverless instance keeps its
 * own counts. The clock is injected so tests and properties need no timers.
 * Pure: no I/O.
 */

export type RateDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number }

export interface RateLimiter {
  /** Records a hit for `key` at `now` (ms) if allowed. Rejected hits are not recorded. */
  hit(key: string, now?: number): RateDecision
  /** Number of keys currently tracked (for the memory bound). */
  size(): number
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
  /** Most keys kept at once; the least recently seen keys are dropped first. */
  maxKeys?: number
}

export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }: RateLimitOptions): RateLimiter {
  // key -> ascending hit times inside the window; Map order = least recently seen first
  const hits = new Map<string, number[]>()

  function prune(times: number[], now: number): number[] {
    let i = 0
    while (i < times.length && times[i] <= now - windowMs) i++
    return i === 0 ? times : times.slice(i)
  }

  return {
    hit(key, now = Date.now()) {
      const times = prune(hits.get(key) ?? [], now)
      hits.delete(key) // re-insert below so this key becomes the most recently seen
      if (times.length >= limit) {
        hits.set(key, times)
        // the oldest hit leaves the window at times[0] + windowMs
        const retryAfterSec = Math.max(1, Math.ceil((times[0] + windowMs - now) / 1000))
        return { allowed: false, retryAfterSec }
      }
      times.push(now)
      hits.set(key, times)
      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value as string
        hits.delete(oldest)
      }
      return { allowed: true, remaining: limit - times.length }
    },
    size: () => hits.size,
  }
}
