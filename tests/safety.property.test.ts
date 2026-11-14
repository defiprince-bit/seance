// Property 8: Rate limit holds in every window — Validates: Requirements 12.3
// Property 9: The response cache stays bounded — Validates: Requirements 12.4
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createRateLimiter } from '../src/lib/rateLimit.ts'
import { LruCache } from '../src/lib/lruCache.ts'

describe('Property 8: rate limit holds in every window', () => {
  it('never allows more than `limit` hits in any window, and rejects with Retry-After >= 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 120_000 }),
        fc.array(fc.integer({ min: 0, max: 5_000 }), { maxLength: 80 }),
        (limit, windowMs, gaps) => {
          const limiter = createRateLimiter({ limit, windowMs })
          let now = 1_000_000
          const allowed: number[] = []
          for (const gap of gaps) {
            now += gap
            const d = limiter.hit('ip', now)
            if (d.allowed) allowed.push(now)
            else expect(d.retryAfterSec).toBeGreaterThanOrEqual(1)
          }
          // every window (t - windowMs, t] ending at an allowed hit holds <= limit allowed hits
          for (const t of allowed) {
            expect(allowed.filter(a => a > t - windowMs && a <= t).length).toBeLessThanOrEqual(limit)
          }
        },
      ),
    )
  })

  it('keys are independent and the key map stays bounded', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 50 }), { maxLength: 200 }), keys => {
        const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, maxKeys: 20 })
        for (const k of keys) limiter.hit(`ip-${k}`, 0)
        expect(limiter.size()).toBeLessThanOrEqual(20)
        // a never-seen key is always allowed
        expect(limiter.hit('fresh', 0).allowed).toBe(true)
      }),
    )
  })
})

describe('Property 9: the response cache stays bounded', () => {
  it('holds at most `max` entries and returns the latest value for keys it keeps', () => {
    type Op = { set: true; key: number; value: number } | { set: false; key: number }
    const op: fc.Arbitrary<Op> = fc.oneof(
      fc.record({ set: fc.constant(true as const), key: fc.integer({ min: 0, max: 15 }), value: fc.integer() }),
      fc.record({ set: fc.constant(false as const), key: fc.integer({ min: 0, max: 15 }) }),
    )
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.array(op, { maxLength: 100 }), (max, ops) => {
        const cache = new LruCache<number>(max)
        const latest = new Map<string, number>()
        for (const o of ops) {
          const key = String(o.key)
          if (o.set) {
            cache.set(key, o.value)
            latest.set(key, o.value)
            expect(cache.get(key)).toBe(o.value) // just set: always kept
          } else {
            const got = cache.get(key)
            if (got !== undefined) expect(got).toBe(latest.get(key))
          }
          expect(cache.size).toBeLessThanOrEqual(max)
        }
      }),
    )
  })

  it('evicts the least recently used entry first', () => {
    const cache = new LruCache<string>(2)
    cache.set('a', 'A')
    cache.set('b', 'B')
    cache.get('a') // a is now most recent
    cache.set('c', 'C')
    expect(cache.has('b')).toBe(false)
    expect(cache.get('a')).toBe('A')
    expect(cache.get('c')).toBe('C')
  })
})
